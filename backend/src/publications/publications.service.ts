import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import { DataSource, In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { normalizeMentionIds } from '../comments/mentions';
import { decodeName } from '../comments/comments.service';
import { AuthUser } from '../common/decorators';
import { ByteRange } from '../common/range';
import { Publication } from '../entities/publication.entity';
import { PublicationApproval } from '../entities/publication-approval.entity';
import { PublicationComment } from '../entities/publication-comment.entity';
import { PublicationReviewer } from '../entities/publication-reviewer.entity';
import { PublicationVersionFile } from '../entities/publication-version-file.entity';
import { PublicationVersion } from '../entities/publication-version.entity';
import { User } from '../entities/user.entity';
import { storageKey } from '../storage/storage-key';
import { StorageService } from '../storage/storage.service';
import {
  CreatePublicationCommentDto, CreatePublicationDto, PublicationQueryDto, UpdatePublicationDto,
} from './publications.dto';
import {
  approvalCounts, canDecide, canUploadVersion, Decision, normalizePlatforms, PubFormat, PubStatus, reconcileStatus, reorderIds,
  StatusAction, statusAfterUpload, transition, validateVersionFiles,
} from './publication-status';
import { sweepStaleUploads } from './upload-tmp';

type UserLite = { id: string; name: string };
type Actor = Pick<AuthUser, 'id' | 'email' | 'name' | 'role' | 'ip'>;

const STATUS_LABEL: Record<PubStatus, string> = {
  idea: 'Idea',
  edicion: 'En edición',
  por_publicar: 'Por publicar',
  publicada: 'Publicada',
  cancelada: 'Cancelada',
};

// acción del registro de auditoría -> acción de la actividad que ve el equipo
const ACTIVITY_ACTIONS: Record<string, string> = {
  'publication.create': 'created',
  'publication.version': 'version_uploaded',
  'publication.approve': 'approved',
  'publication.changes': 'changes_requested',
  'publication.comment': 'commented',
  'publication.status': 'status_changed',
};

@Injectable()
export class PublicationsService {
  constructor(
    @InjectRepository(Publication) private pubs: Repository<Publication>,
    @InjectRepository(PublicationReviewer) private reviewers: Repository<PublicationReviewer>,
    @InjectRepository(PublicationVersion) private versions: Repository<PublicationVersion>,
    @InjectRepository(PublicationVersionFile) private files: Repository<PublicationVersionFile>,
    @InjectRepository(PublicationApproval) private approvals: Repository<PublicationApproval>,
    @InjectRepository(PublicationComment) private comments: Repository<PublicationComment>,
    @InjectRepository(User) private users: Repository<User>,
    private dataSource: DataSource,
    private audit: AuditService,
    private storage: StorageService,
    private events: EventEmitter2,
  ) {}

  // ------------------------------------------------------------------ carga

  private async load(id: string): Promise<Publication> {
    const pub = await this.pubs.findOne({ where: { id } });
    if (!pub) throw new NotFoundException('Publicación no encontrada');
    return pub;
  }

  private async latestVersion(publicationId: string): Promise<PublicationVersion | null> {
    return this.versions.findOne({ where: { publicationId }, order: { number: 'DESC' } });
  }

  private async reviewerStates(publicationId: string): Promise<{ userId: string; isActive: boolean }[]> {
    const rows: { user_id: string; is_active: boolean }[] = await this.dataSource.query(
      `SELECT r.user_id, u.is_active FROM publication_reviewers r JOIN users u ON u.id = r.user_id WHERE r.publication_id = $1`,
      [publicationId],
    );
    return rows.map((r) => ({ userId: r.user_id, isActive: r.is_active }));
  }

  private async userMap(ids: (string | null | undefined)[]): Promise<Map<string, User>> {
    const list = [...new Set(ids.filter((i): i is string => !!i))];
    if (!list.length) return new Map();
    return new Map((await this.users.find({ where: { id: In(list) } })).map((u) => [u.id, u]));
  }

  private lite(users: Map<string, User>, id: string | null): UserLite | null {
    const u = id ? users.get(id) : undefined;
    return u ? { id: u.id, name: u.name } : null;
  }

  private async activeUsers(ids: string[]): Promise<User[]> {
    return ids.length ? this.users.find({ where: { id: In(ids), isActive: true } }) : [];
  }

  // --------------------------------------------------------------- resúmenes

  /** Resúmenes de varias publicaciones con un puñado de consultas (sin N+1). */
  private async summaries(rows: Publication[], me: Actor) {
    if (rows.length === 0) return [];
    const ids = rows.map((p) => p.id);
    const [revRows, latestRows, commentRows, clientRows, users] = await Promise.all([
      this.dataSource.query(
        `SELECT r.publication_id AS pid, r.user_id AS uid, u.is_active AS active
           FROM publication_reviewers r JOIN users u ON u.id = r.user_id WHERE r.publication_id = ANY($1::uuid[])`,
        [ids],
      ) as Promise<{ pid: string; uid: string; active: boolean }[]>,
      this.dataSource.query(
        `SELECT DISTINCT ON (publication_id) id, publication_id AS pid, number
           FROM publication_versions WHERE publication_id = ANY($1::uuid[]) ORDER BY publication_id, number DESC`,
        [ids],
      ) as Promise<{ id: string; pid: string; number: number }[]>,
      this.dataSource.query(
        `SELECT publication_id AS pid, count(*)::int AS n FROM publication_comments WHERE publication_id = ANY($1::uuid[]) GROUP BY publication_id`,
        [ids],
      ) as Promise<{ pid: string; n: number }[]>,
      this.dataSource.query(`SELECT id, name FROM clients WHERE id = ANY($1::uuid[])`, [rows.map((p) => p.clientId).filter(Boolean)]) as Promise<
        { id: string; name: string }[]
      >,
      this.userMap(rows.map((p) => p.createdById)),
    ]);
    const versionIds = latestRows.map((v) => v.id);
    const [appRows, thumbRows] = versionIds.length
      ? await Promise.all([
          this.dataSource.query(
            `SELECT version_id AS vid, user_id AS uid, decision FROM publication_approvals WHERE version_id = ANY($1::uuid[])`,
            [versionIds],
          ) as Promise<{ vid: string; uid: string; decision: Decision }[]>,
          this.dataSource.query(
            `SELECT DISTINCT ON (version_id) id, version_id AS vid, mime_type AS mime
               FROM publication_version_files WHERE version_id = ANY($1::uuid[]) ORDER BY version_id, position`,
            [versionIds],
          ) as Promise<{ id: string; vid: string; mime: string }[]>,
        ])
      : [[], []];

    const latestBy = new Map(latestRows.map((v) => [v.pid, v]));
    const commentsBy = new Map(commentRows.map((c) => [c.pid, c.n]));
    const clientsBy = new Map(clientRows.map((c) => [c.id, c]));
    const thumbBy = new Map(thumbRows.map((t) => [t.vid, t]));

    return rows.map((p) => {
      const revs = revRows.filter((r) => r.pid === p.id).map((r) => ({ userId: r.uid, isActive: r.active }));
      const latest = latestBy.get(p.id) ?? null;
      const decisions = latest ? appRows.filter((a) => a.vid === latest.id).map((a) => ({ userId: a.uid, decision: a.decision })) : [];
      const { approved, total } = approvalCounts(revs, decisions);
      const thumb = latest ? thumbBy.get(latest.id) : undefined;
      const client = p.clientId ? clientsBy.get(p.clientId) : undefined;
      return {
        id: p.id,
        title: p.title,
        format: p.format,
        platforms: p.platforms,
        status: p.status,
        scheduledAt: p.scheduledAt,
        client: client ? { id: client.id, name: client.name } : null,
        createdBy: this.lite(users, p.createdById),
        latestVersion: latest?.number ?? null,
        approvals: approved,
        reviewersCount: total,
        myPendingApproval:
          p.status === 'edicion' && !!latest && revs.some((r) => r.userId === me.id) && !decisions.some((d) => d.userId === me.id),
        thumbnailFileId: thumb?.id ?? null,
        thumbnailMime: thumb?.mime ?? null,
        commentsCount: commentsBy.get(p.id) ?? 0,
      };
    });
  }

  async list(q: PublicationQueryDto, me: Actor) {
    const qb = this.pubs.createQueryBuilder('p').orderBy('p.scheduledAt', 'ASC').addOrderBy('p.createdAt', 'ASC');
    if (q.from) qb.andWhere('p.scheduledAt >= :from', { from: q.from });
    if (q.to) qb.andWhere('p.scheduledAt < :to', { to: q.to });
    if (q.clientId) qb.andWhere('p.clientId = :clientId', { clientId: q.clientId });
    if (q.status) qb.andWhere('p.status = :status', { status: q.status });
    if (q.format) qb.andWhere('p.format = :format', { format: q.format });
    const list = await this.summaries(await qb.getMany(), me);
    return q.pendingMine === '1' ? list.filter((p) => p.myPendingApproval) : list;
  }

  async get(id: string, me: Actor) {
    return this.detail(await this.load(id), me);
  }

  private async detail(pub: Publication, me: Actor) {
    const [summary] = await this.summaries([pub], me);
    const versionRows = await this.versions.find({ where: { publicationId: pub.id }, order: { number: 'DESC' } });
    const versionIds = versionRows.map((v) => v.id);
    const [fileRows, approvalRows, commentRows, revRows] = await Promise.all([
      versionIds.length ? this.files.find({ where: { versionId: In(versionIds) }, order: { position: 'ASC' } }) : [],
      versionIds.length ? this.approvals.find({ where: { versionId: In(versionIds) }, order: { createdAt: 'ASC' } }) : [],
      this.comments.find({ where: { publicationId: pub.id }, order: { createdAt: 'ASC' } }),
      this.reviewerStates(pub.id),
    ]);
    const users = await this.userMap([
      ...versionRows.map((v) => v.uploadedById),
      ...commentRows.map((c) => c.authorId),
      ...revRows.map((r) => r.userId),
    ]);
    const numberOf = new Map(versionRows.map((v) => [v.id, v.number]));
    return {
      ...summary,
      caption: pub.caption,
      brief: pub.brief,
      cancelledFrom: pub.cancelledFrom,
      publishedAt: pub.publishedAt,
      createdAt: pub.createdAt,
      updatedAt: pub.updatedAt,
      reviewers: revRows.flatMap((r) => {
        const u = users.get(r.userId);
        return u ? [{ id: u.id, name: u.name, isActive: u.isActive }] : [];
      }),
      versions: versionRows.map((v) => ({
        id: v.id,
        number: v.number,
        note: v.note,
        uploadedBy: this.lite(users, v.uploadedById),
        createdAt: v.createdAt,
        files: fileRows
          .filter((f) => f.versionId === v.id)
          .map((f) => ({ id: f.id, originalName: f.originalName, mimeType: f.mimeType, size: f.size, position: f.position })),
        approvals: approvalRows
          .filter((a) => a.versionId === v.id)
          .map((a) => ({ userId: a.userId, decision: a.decision, createdAt: a.createdAt })),
      })),
      comments: commentRows.map((c) => ({
        id: c.id,
        versionId: c.versionId,
        versionNumber: c.versionId ? numberOf.get(c.versionId) ?? null : null,
        author: this.lite(users, c.authorId),
        body: c.body,
        timecodeSec: c.timecodeSec,
        slideIndex: c.slideIndex,
        mentionIds: c.mentionIds,
        createdAt: c.createdAt,
      })),
      canDelete: pub.createdById === me.id || me.role === 'admin',
    };
  }

  async activity(limit: number) {
    const rows: {
      id: string; created_at: Date; action: string; detail: string | null; pid: string; title: string; actor_id: string | null; actor_name: string | null;
    }[] = await this.dataSource.query(
      `SELECT l.id, l.created_at, l.data->>'action' AS action, l.data->'after'->>'detail' AS detail,
              p.id AS pid, p.title, u.id AS actor_id, u.name AS actor_name
         FROM logs l
         JOIN publications p ON p.id::text = l.data->>'entityId'
         LEFT JOIN users u ON u.id::text = l.data->>'userId'
        WHERE l.data->>'entity' = 'publication' AND l.data->>'action' = ANY($1::text[])
        ORDER BY l.id DESC LIMIT $2`,
      [Object.keys(ACTIVITY_ACTIONS), limit],
    );
    return rows.map((r) => ({
      id: String(r.id),
      publicationId: r.pid,
      publicationTitle: r.title,
      actor: r.actor_id ? { id: r.actor_id, name: r.actor_name ?? '' } : null,
      action: ACTIVITY_ACTIONS[r.action],
      detail: r.detail,
      createdAt: r.created_at,
    }));
  }

  // ----------------------------------------------------------- publicaciones

  private async checkClient(clientId: string | null | undefined) {
    if (!clientId) return;
    const rows = await this.dataSource.query(`SELECT 1 FROM clients WHERE id = $1`, [clientId]);
    if (rows.length === 0) throw new BadRequestException('El cliente no existe');
  }

  /** Revisores válidos: solo usuarios activos. Sin lista, todos los activos. */
  private async resolveReviewers(reviewerIds: string[] | undefined): Promise<string[]> {
    if (reviewerIds === undefined) return (await this.users.find({ where: { isActive: true }, select: { id: true } })).map((u) => u.id);
    return (await this.activeUsers([...new Set(reviewerIds)])).map((u) => u.id);
  }

  async create(dto: CreatePublicationDto, actor: Actor) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('El título es obligatorio');
    const platforms = normalizePlatforms(dto.format, dto.platforms);
    if (!platforms) throw new BadRequestException('Las plataformas no corresponden al formato');
    await this.checkClient(dto.clientId);
    const reviewerIds = await this.resolveReviewers(dto.reviewerIds);
    const saved = await this.dataSource.transaction(async (m) => {
      const row = await m.getRepository(Publication).save(
        m.getRepository(Publication).create({
          title,
          format: dto.format,
          platforms,
          scheduledAt: new Date(dto.scheduledAt),
          clientId: dto.clientId ?? null,
          caption: dto.caption ?? '',
          brief: dto.brief ?? '',
          createdById: actor.id,
        }),
      );
      if (reviewerIds.length) {
        await m.getRepository(PublicationReviewer).insert(reviewerIds.map((userId) => ({ publicationId: row.id, userId })));
      }
      return row;
    });
    await this.audit.log(actor, 'publication.create', 'publication', saved.id, null, { title, format: dto.format });
    return this.get(saved.id, actor);
  }

  async update(id: string, dto: UpdatePublicationDto, actor: Actor) {
    const pub = await this.load(id);
    const changed: string[] = [];
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('El título es obligatorio');
      if (title !== pub.title) { pub.title = title; changed.push('title'); }
    }
    if (dto.format !== undefined && dto.format !== pub.format) {
      const versions = await this.versions.count({ where: { publicationId: id } });
      if (versions > 0) throw new ConflictException('No se puede cambiar el formato de una publicación que ya tiene versiones');
      pub.format = dto.format;
      changed.push('format');
      // al cambiar de formato las plataformas anteriores ya no valen
      if (dto.platforms === undefined) pub.platforms = normalizePlatforms(pub.format, null)!;
    }
    if (dto.platforms !== undefined) {
      const platforms = normalizePlatforms(pub.format, dto.platforms);
      if (!platforms) throw new BadRequestException('Las plataformas no corresponden al formato');
      pub.platforms = platforms;
      changed.push('platforms');
    }
    if (dto.scheduledAt !== undefined) { pub.scheduledAt = new Date(dto.scheduledAt); changed.push('scheduledAt'); }
    if (dto.clientId !== undefined && dto.clientId !== pub.clientId) {
      await this.checkClient(dto.clientId);
      pub.clientId = dto.clientId;
      changed.push('clientId');
    }
    if (dto.caption !== undefined && dto.caption !== pub.caption) { pub.caption = dto.caption; changed.push('caption'); }
    if (dto.brief !== undefined && dto.brief !== pub.brief) { pub.brief = dto.brief; changed.push('brief'); }

    let reviewersChanged = false;
    await this.dataSource.transaction(async (m) => {
      if (dto.reviewerIds !== undefined) {
        const next = await this.resolveReviewers(dto.reviewerIds);
        const current = (await m.getRepository(PublicationReviewer).find({ where: { publicationId: id } })).map((r) => r.userId);
        const add = next.filter((u) => !current.includes(u));
        const drop = current.filter((u) => !next.includes(u));
        if (drop.length) await m.getRepository(PublicationReviewer).delete({ publicationId: id, userId: In(drop) });
        if (add.length) await m.getRepository(PublicationReviewer).insert(add.map((userId) => ({ publicationId: id, userId })));
        reviewersChanged = add.length > 0 || drop.length > 0;
        if (reviewersChanged) changed.push('reviewers');
      }
      if (changed.length) {
        await m.getRepository(Publication).update(id, {
          title: pub.title, format: pub.format, platforms: pub.platforms, scheduledAt: pub.scheduledAt,
          clientId: pub.clientId, caption: pub.caption, brief: pub.brief,
        });
      }
    });
    if (changed.length) await this.audit.log(actor, 'publication.update', 'publication', id, null, { title: pub.title, changed });
    if (reviewersChanged) await this.reconcile(id, actor);
    return this.get(id, actor);
  }

  async remove(id: string, actor: Actor) {
    const pub = await this.load(id);
    if (pub.createdById !== actor.id && actor.role !== 'admin') {
      throw new ForbiddenException('Solo quien creó la publicación o un administrador puede eliminarla');
    }
    const stored: { stored_name: string }[] = await this.dataSource.query(
      `SELECT f.stored_name FROM publication_version_files f JOIN publication_versions v ON v.id = f.version_id WHERE v.publication_id = $1`,
      [id],
    );
    await this.pubs.delete(id);
    await this.storage.delete(stored.map((r) => r.stored_name));
    await this.audit.log(actor, 'publication.delete', 'publication', id, { title: pub.title, files: stored.length }, null);
  }

  // ----------------------------------------------------------------- estado

  /** Recalcula el paso automático edición -> por publicar. Devuelve true si cambió. */
  private async reconcile(id: string, actor: Actor): Promise<boolean> {
    const pub = await this.load(id);
    const latest = await this.latestVersion(id);
    const decisions = latest ? await this.approvals.find({ where: { versionId: latest.id } }) : [];
    const next = reconcileStatus(pub.status, {
      hasVersion: !!latest,
      reviewers: await this.reviewerStates(id),
      latestDecisions: decisions.map((d) => ({ userId: d.userId, decision: d.decision })),
    });
    if (next === pub.status) return false;
    await this.pubs.update(id, { status: next });
    await this.audit.log(actor, 'publication.status', 'publication', id, { status: pub.status }, { status: next, title: pub.title, detail: STATUS_LABEL[next] });
    this.events.emit('publication.approved', {
      publication: { id, title: pub.title },
      actor: { id: actor.id, name: actor.name },
      recipientIds: await this.audience(pub, actor.id),
      detail: latest ? `v${latest.number}` : undefined,
    });
    return true;
  }

  /** Revisores (activos) y creador, sin quien hizo la acción. */
  private async audience(pub: Publication, exceptId: string): Promise<string[]> {
    const revs = (await this.reviewerStates(pub.id)).filter((r) => r.isActive).map((r) => r.userId);
    return [...new Set([...revs, ...(pub.createdById ? [pub.createdById] : [])])].filter((u) => u !== exceptId);
  }

  async changeStatus(id: string, action: StatusAction, actor: Actor) {
    const pub = await this.load(id);
    const t = transition(pub.status, action, pub.cancelledFrom);
    if (!t.ok) throw new ConflictException(t.message);
    await this.dataSource.transaction(async (m) => {
      if (t.clearApprovals) {
        const latest = await this.latestVersion(id);
        // sin esto la pieza volvería a "por publicar" al instante
        if (latest) await m.getRepository(PublicationApproval).delete({ versionId: latest.id });
      }
      await m.getRepository(Publication).update(id, {
        status: t.status,
        cancelledFrom: t.cancelledFrom,
        ...(t.setPublishedAt ? { publishedAt: new Date() } : {}),
      });
    });
    await this.audit.log(actor, 'publication.status', 'publication', id, { status: pub.status }, {
      status: t.status, action, title: pub.title, detail: STATUS_LABEL[t.status],
    });
    this.events.emit('publication.status_changed', {
      publication: { id, title: pub.title },
      actor: { id: actor.id, name: actor.name },
      recipientIds: await this.audience(pub, actor.id),
      detail: STATUS_LABEL[t.status],
    });
    // reactivar a edición puede dejar la pieza ya aprobada
    if (t.status === 'edicion') await this.reconcile(id, actor);
    return this.get(id, actor);
  }

  // --------------------------------------------------------------- versiones

  async uploadVersion(id: string, note: string, uploads: Express.Multer.File[], actor: Actor) {
    void sweepStaleUploads();
    const stored: string[] = [];
    try {
      const pub = await this.load(id);
      if (!canUploadVersion(pub.status)) {
        throw new ConflictException('Solo se pueden subir versiones mientras la publicación está en idea o en edición');
      }
      const incoming = uploads.map((f) => ({ file: f, name: decodeName(f.originalname).slice(0, 255), mime: f.mimetype }));
      const invalid = validateVersionFiles(pub.format as PubFormat, incoming.map((f) => ({ mimeType: f.mime })));
      if (invalid) throw new BadRequestException(invalid);

      const last = await this.latestVersion(id);
      const number = (last?.number ?? 0) + 1;
      const keys = incoming.map((f) => storageKey(`publicaciones/${id}/v${number}`, f.name));
      for (let i = 0; i < incoming.length; i++) {
        await this.storage.putFile(keys[i], incoming[i].file.path, incoming[i].mime);
        stored.push(keys[i]);
      }

      let version: PublicationVersion;
      try {
        version = await this.dataSource.transaction(async (m) => {
          // se vuelve a leer con bloqueo: el estado pudo cambiar durante la subida
          const fresh = await m.getRepository(Publication).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
          if (!fresh) throw new NotFoundException('Publicación no encontrada');
          if (!canUploadVersion(fresh.status)) {
            throw new ConflictException('Solo se pueden subir versiones mientras la publicación está en idea o en edición');
          }
          const row = await m.getRepository(PublicationVersion).save(
            m.getRepository(PublicationVersion).create({ publicationId: id, number, note: note.trim().slice(0, 5000), uploadedById: actor.id }),
          );
          await m.getRepository(PublicationVersionFile).insert(
            incoming.map((f, position) => ({
              versionId: row.id, originalName: f.name, storedName: keys[position], mimeType: f.mime, size: f.file.size, position,
            })),
          );
          await m.getRepository(Publication).update(id, { status: statusAfterUpload(fresh.status) });
          return row;
        });
      } catch (e: any) {
        if (e?.code === '23505') throw new ConflictException('Se subió otra versión al mismo tiempo; vuelve a intentarlo');
        throw e;
      }

      stored.length = 0; // ya confirmado: el catch de abajo no debe borrar lo guardado
      await this.audit.log(actor, 'publication.version', 'publication', id, null, {
        title: pub.title, number, files: incoming.length, detail: `v${number}`,
      });
      if (pub.status === 'idea') {
        await this.audit.log(actor, 'publication.status', 'publication', id, { status: 'idea' }, {
          status: 'edicion', title: pub.title, detail: STATUS_LABEL.edicion,
        });
      }
      const reviewers = (await this.reviewerStates(id)).filter((r) => r.isActive).map((r) => r.userId).filter((u) => u !== actor.id);
      this.events.emit('publication.version_uploaded', {
        publication: { id, title: pub.title },
        actor: { id: actor.id, name: actor.name },
        recipientIds: reviewers,
        detail: `v${version.number}`,
      });
      return this.get(id, actor);
    } catch (e) {
      // lo ya subido al almacenamiento no debe quedar huérfano
      await this.storage.delete(stored);
      throw e;
    } finally {
      await Promise.all(uploads.map((f) => fs.unlink(f.path).catch(() => undefined)));
    }
  }

  async reorderFiles(id: string, versionId: string, fileIds: string[], actor: Actor) {
    const pub = await this.load(id);
    if (!canUploadVersion(pub.status)) throw new ConflictException('El orden solo se puede cambiar mientras la publicación está en idea o en edición');
    if (pub.format !== 'post') throw new BadRequestException('Solo los posts tienen imágenes que ordenar');
    const version = await this.versions.findOne({ where: { id: versionId, publicationId: id } });
    if (!version) throw new NotFoundException('Versión no encontrada');
    const current = await this.files.find({ where: { versionId }, order: { position: 'ASC' } });
    const order = reorderIds(current.map((f) => f.id), fileIds);
    if (!order) throw new BadRequestException('La lista de archivos no coincide con la versión');
    await this.dataSource.transaction(async (m) => {
      for (let position = 0; position < order.length; position++) {
        await m.getRepository(PublicationVersionFile).update(order[position], { position });
      }
    });
    await this.audit.log(actor, 'publication.reorder', 'publication', id, null, { title: pub.title, number: version.number });
    return this.get(id, actor);
  }

  // ------------------------------------------------------------ aprobaciones

  /** Valida que el usuario pueda opinar sobre esta versión y devuelve la publicación y la versión. */
  private async reviewContext(id: string, versionId: string, actor: Actor) {
    const pub = await this.load(id);
    const version = await this.versions.findOne({ where: { id: versionId, publicationId: id } });
    if (!version) throw new NotFoundException('Versión no encontrada');
    if (!canDecide(pub.status)) throw new ConflictException('Solo se puede revisar mientras la publicación está en edición');
    const isReviewer = await this.reviewers.exists({ where: { publicationId: id, userId: actor.id } });
    if (!isReviewer) throw new ForbiddenException('Solo los revisores de la publicación pueden aprobar o pedir cambios');
    const latest = await this.latestVersion(id);
    if (latest?.id !== version.id) throw new ConflictException('Solo se puede revisar la última versión');
    return { pub, version };
  }

  async decide(id: string, versionId: string, decision: Decision, actor: Actor) {
    const { pub, version } = await this.reviewContext(id, versionId, actor);
    await this.approvals.save(this.approvals.create({ versionId, userId: actor.id, decision, createdAt: new Date() }));
    const detail = `v${version.number}`;
    if (decision === 'aprobada') {
      await this.audit.log(actor, 'publication.approve', 'publication', id, null, { title: pub.title, detail });
      await this.reconcile(id, actor);
    } else {
      await this.audit.log(actor, 'publication.changes', 'publication', id, null, { title: pub.title, detail });
      const recipients = [...new Set([pub.createdById, version.uploadedById].filter((u): u is string => !!u))].filter((u) => u !== actor.id);
      this.events.emit('publication.changes_requested', {
        publication: { id, title: pub.title },
        actor: { id: actor.id, name: actor.name },
        recipientIds: recipients,
        detail,
      });
    }
    return this.get(id, actor);
  }

  async undoDecision(id: string, versionId: string, actor: Actor) {
    const { pub, version } = await this.reviewContext(id, versionId, actor);
    await this.approvals.delete({ versionId, userId: actor.id });
    await this.audit.log(actor, 'publication.approval_undo', 'publication', id, null, { title: pub.title, detail: `v${version.number}` });
    return this.get(id, actor);
  }

  // ------------------------------------------------------------ comentarios

  async addComment(id: string, dto: CreatePublicationCommentDto, actor: Actor) {
    const pub = await this.load(id);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('El comentario no puede estar vacío');
    let version: PublicationVersion | null = null;
    if (dto.versionId) {
      version = await this.versions.findOne({ where: { id: dto.versionId, publicationId: id } });
      if (!version) throw new BadRequestException('La versión no pertenece a esta publicación');
    }
    const mentioned = await this.activeUsers(normalizeMentionIds(dto.mentionIds, actor.id));
    const comment = await this.comments.save(
      this.comments.create({
        publicationId: id,
        versionId: version?.id ?? null,
        authorId: actor.id,
        body,
        // el minuto solo aplica al video y la lámina solo al carrusel
        timecodeSec: pub.format === 'video' ? dto.timecodeSec ?? null : null,
        slideIndex: pub.format === 'post' ? dto.slideIndex ?? null : null,
        mentionIds: mentioned.map((u) => u.id),
      }),
    );
    await this.audit.log(actor, 'publication.comment', 'publication', id, null, { title: pub.title, commentId: comment.id });
    if (mentioned.length) {
      this.events.emit('publication.mentioned', {
        publication: { id, title: pub.title },
        actor: { id: actor.id, name: actor.name },
        recipientIds: mentioned.map((u) => u.id),
        detail: body,
      });
    }
    return this.get(id, actor);
  }

  async removeComment(id: string, commentId: string, actor: Actor) {
    const comment = await this.comments.findOne({ where: { id: commentId, publicationId: id } });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    if (comment.authorId !== actor.id && actor.role !== 'admin') {
      throw new ForbiddenException('Solo el autor o un administrador puede eliminar el comentario');
    }
    await this.comments.delete(commentId);
    await this.audit.log(actor, 'publication.comment_delete', 'publication', id, { commentId }, null);
    return this.get(id, actor);
  }

  // --------------------------------------------------------------- archivos

  async getFile(fileId: string) {
    const file = await this.files.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Archivo no encontrado');
    return file;
  }

  openFile(file: PublicationVersionFile, range: ByteRange | null) {
    return this.storage.getStream(file.storedName, range ?? undefined);
  }
}
