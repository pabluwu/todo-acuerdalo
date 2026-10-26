import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { decodeName } from '../comments/comments.service';
import { AuthUser } from '../common/decorators';
import { validateFolderName } from '../common/folder-name';
import { Note, NoteVisibility } from '../entities/note.entity';
import { NoteAccessRequest } from '../entities/note-access-request.entity';
import { NoteFile } from '../entities/note-file.entity';
import { NoteFolder } from '../entities/note-folder.entity';
import { NotePermission, NoteShare } from '../entities/note-share.entity';
import { User } from '../entities/user.entity';
import { storageKey } from '../storage/storage-key';
import { StorageService } from '../storage/storage.service';
import { accessFor, canDeleteNote, canEditNote, canManageFolder, canMoveNote, folderFitsNote, NoteAccess } from './note-access';
import {
  CreateNoteDto, CreateNoteFolderDto, RenameNoteFolderDto, ResolveRequestDto, SetSharesDto, UpdateNoteDto,
} from './notes.dto';

const person = (u: User) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive });
const lite = (u: User | null) => (u ? { id: u.id, name: u.name } : null);

/** Escapa los comodines de LIKE para que la búsqueda sea literal. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note) private notes: Repository<Note>,
    @InjectRepository(NoteShare) private shares: Repository<NoteShare>,
    @InjectRepository(NoteAccessRequest) private requests: Repository<NoteAccessRequest>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(NoteFolder) private folders: Repository<NoteFolder>,
    @InjectRepository(NoteFile) private files: Repository<NoteFile>,
    @InjectDataSource() private dataSource: DataSource,
    private storage: StorageService,
    private audit: AuditService,
    private events: EventEmitter2,
  ) {}

  private shareOf(note: Note, userId: string) {
    return (note.shares ?? []).find((s) => s.userId === userId) ?? null;
  }

  private accessOf(note: Note, actor: AuthUser): NoteAccess {
    return accessFor(note, actor.id, this.shareOf(note, actor.id));
  }

  /** Resumen para listados: nunca incluye más que un extracto del cuerpo. */
  private summary(n: Note, actor: AuthUser) {
    const access = this.accessOf(n, actor);
    return {
      id: n.id,
      title: n.title,
      excerpt: n.body.slice(0, 300),
      visibility: n.visibility,
      folderId: this.visibleFolderId(n, access),
      fileCount: n.fileCount ?? 0,
      owner: lite(n.owner),
      updatedBy: lite(n.updatedBy),
      myAccess: access,
      // solo el dueño ve con quién comparte; el resto, apenas si está compartida
      shared: n.visibility === 'private' && (n.shares ?? []).length > 0,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    };
  }

  /** Solo se llama con acceso confirmado: es la única función que serializa el cuerpo. */
  present(n: Note, access: NoteAccess, actor: AuthUser) {
    return {
      id: n.id,
      title: n.title,
      body: n.body,
      visibility: n.visibility,
      folderId: this.visibleFolderId(n, access),
      owner: lite(n.owner),
      updatedBy: lite(n.updatedBy),
      myAccess: access,
      canDelete: canDeleteNote(n, actor.id, actor.role),
      canMove: canMoveNote(n, access),
      files: [...(n.files ?? [])]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((f) => this.presentFile(f)),
      shares:
        access === 'owner' && n.visibility === 'private'
          ? [...(n.shares ?? [])]
              .sort((a, b) => a.user.name.localeCompare(b.user.name))
              .map((s) => ({ userId: s.userId, name: s.user.name, email: s.user.email, permission: s.permission }))
          : [],
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    };
  }

  /** La carpeta de una privada es del dueño: a quien se la compartieron no se le muestra. */
  private visibleFolderId(n: Note, access: NoteAccess) {
    return n.visibility === 'common' || access === 'owner' ? n.folderId : null;
  }

  private presentFile(f: NoteFile) {
    return { id: f.id, originalName: f.originalName, mimeType: f.mimeType, size: f.size, uploadedBy: lite(f.uploadedBy), createdAt: f.createdAt };
  }

  private presentFolder(f: NoteFolder, itemCount = 0) {
    return { id: f.id, name: f.name, parentId: f.parentId, visibility: f.visibility, itemCount, createdAt: f.createdAt };
  }

  private async load(id: string): Promise<Note> {
    const note = await this.notes.findOne({ where: { id }, relations: { shares: { user: true }, files: true } });
    if (!note) throw new NotFoundException('Nota no encontrada');
    return note;
  }

  private notesQuery() {
    return this.notes
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.owner', 'o')
      .leftJoinAndSelect('n.updatedBy', 'ub')
      .leftJoinAndSelect('n.shares', 's')
      .orderBy('n.updated_at', 'DESC');
  }

  /** Completa `fileCount` de un listado con una sola consulta. */
  private async withFileCounts(notes: Note[]): Promise<Note[]> {
    if (notes.length === 0) return notes;
    const rows: { note_id: string; count: number }[] = await this.dataSource.query(
      'SELECT note_id, count(*)::int AS count FROM note_files WHERE note_id = ANY($1::uuid[]) GROUP BY note_id',
      [notes.map((n) => n.id)],
    );
    const count = new Map(rows.map((r) => [r.note_id, r.count]));
    for (const n of notes) n.fileCount = count.get(n.id) ?? 0;
    return notes;
  }

  /**
   * Contenido de una carpeta (o de la raíz) de la pestaña pedida.
   * Con búsqueda, en cambio, devuelve todas las coincidencias de la pestaña sin importar la carpeta.
   */
  async list(scope: string | undefined, folderId: string | undefined, q: string | undefined, actor: AuthUser) {
    const visibility: NoteVisibility = scope === 'private' ? 'private' : 'common';
    const term = (q ?? '').trim().slice(0, 100);
    if (term) {
      const qb = this.notesQuery();
      if (visibility === 'private') {
        qb.where("n.visibility = 'private'").andWhere(
          '(n.owner_id = :uid OR n.id IN (SELECT ns.note_id FROM note_shares ns WHERE ns.user_id = :uid))',
          { uid: actor.id },
        );
      } else {
        qb.where("n.visibility = 'common'");
      }
      qb.andWhere("(n.title ILIKE :q ESCAPE '\\' OR n.body ILIKE :q ESCAPE '\\')", { q: likePattern(term) });
      return { folder: null, breadcrumb: [], folders: [], notes: (await this.withFileCounts(await qb.getMany())).map((n) => this.summary(n, actor)), sharedWithMe: [] };
    }

    const folder = folderId ? await this.loadFolder(folderId, actor) : null;
    if (folder && folder.visibility !== visibility) throw new NotFoundException('Carpeta no encontrada');
    const ownerId = visibility === 'private' ? actor.id : null;
    const breadcrumb: { id: string; name: string }[] = folder
      ? await this.dataSource.query(
          `WITH RECURSIVE up AS (
             SELECT id, parent_id, name, 1 AS depth FROM note_folders WHERE id = $1
             UNION ALL
             SELECT f.id, f.parent_id, f.name, up.depth + 1 FROM note_folders f JOIN up ON f.id = up.parent_id
           ) SELECT id, name FROM up ORDER BY depth DESC`,
          [folder.id],
        )
      : [];
    const rows = await this.folders.find({
      where: { visibility, ownerId: ownerId ?? IsNull(), parentId: folder ? folder.id : IsNull() },
    });
    // cuántos elementos (subcarpetas y notas, a cualquier profundidad) hay dentro de cada carpeta
    const sizes: { id: string; folders: number; notes: number }[] = rows.length
      ? await this.dataSource.query(
          `WITH RECURSIVE tree AS (
             SELECT id AS root, id FROM note_folders WHERE id = ANY($1::uuid[])
             UNION ALL
             SELECT t.root, f.id FROM note_folders f JOIN tree t ON f.parent_id = t.id
           )
           SELECT t.root AS id, count(*)::int - 1 AS folders,
                  (SELECT count(*)::int FROM notes n WHERE n.folder_id IN (SELECT x.id FROM tree x WHERE x.root = t.root)) AS notes
           FROM tree t GROUP BY t.root`,
          [rows.map((f) => f.id)],
        )
      : [];
    const size = new Map(sizes.map((r) => [r.id, r.folders + r.notes]));

    const qb = this.notesQuery().where('n.visibility = :visibility', { visibility });
    if (ownerId) qb.andWhere('n.owner_id = :uid', { uid: ownerId });
    if (folder) qb.andWhere('n.folder_id = :fid', { fid: folder.id });
    else qb.andWhere('n.folder_id IS NULL');
    const notes = await this.withFileCounts(await qb.getMany());

    // las privadas de otros que me compartieron no están en mis carpetas: van aparte, en la raíz
    const shared =
      visibility === 'private' && !folder
        ? await this.notesQuery()
            .where("n.visibility = 'private'")
            .andWhere('(n.owner_id IS NULL OR n.owner_id <> :uid)', { uid: actor.id })
            .andWhere('n.id IN (SELECT ns.note_id FROM note_shares ns WHERE ns.user_id = :uid)', { uid: actor.id })
            .getMany()
            .then((rows) => this.withFileCounts(rows))
        : [];

    return {
      folder: folder && this.presentFolder(folder),
      breadcrumb,
      folders: rows
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
        .map((f) => this.presentFolder(f, size.get(f.id) ?? 0)),
      notes: notes.map((n) => this.summary(n, actor)),
      sharedWithMe: shared.map((n) => this.summary(n, actor)),
    };
  }

  async get(id: string, actor: AuthUser) {
    const note = await this.load(id);
    const access = this.accessOf(note, actor);
    if (access === 'none') {
      // solo título y dueño: lo justo para ofrecer "Solicitar acceso"; el cuerpo nunca sale de aquí
      const last = await this.requests.findOne({ where: { noteId: id, userId: actor.id }, order: { createdAt: 'DESC' } });
      throw new ForbiddenException({
        code: 'NO_ACCESS',
        message: 'Esta nota es privada',
        title: note.title,
        owner: lite(note.owner),
        requestStatus: last && last.status !== 'approved' ? last.status : null,
      });
    }
    return this.present(note, access, actor);
  }

  async create(dto: CreateNoteDto, actor: AuthUser) {
    const folderId = await this.folderFor(dto.folderId, { visibility: dto.visibility, ownerId: actor.id }, actor);
    const note = await this.notes.save(
      this.notes.create({
        title: dto.title.trim(),
        body: dto.body ?? '',
        visibility: dto.visibility,
        folderId,
        ownerId: actor.id,
        updatedById: actor.id,
      }),
    );
    await this.audit.log(actor, 'note.create', 'note', note.id, null, { title: note.title, visibility: note.visibility, folderId });
    return this.present(await this.load(note.id), 'owner', actor);
  }

  async update(id: string, dto: UpdateNoteDto, actor: AuthUser) {
    const note = await this.load(id);
    const access = this.accessOf(note, actor);
    if (!canEditNote(access)) throw new ForbiddenException('No tienes permiso para editar esta nota');
    const before = { title: note.title, visibility: note.visibility, folderId: note.folderId };
    const changed: string[] = [];
    if (dto.title !== undefined && dto.title.trim() !== note.title) {
      note.title = dto.title.trim();
      changed.push('title');
    }
    if (dto.body !== undefined && dto.body !== note.body) {
      note.body = dto.body;
      changed.push('body');
    }
    if (dto.visibility !== undefined && dto.visibility !== note.visibility) {
      if (access !== 'owner') throw new ForbiddenException('Solo el dueño puede cambiar la visibilidad');
      note.visibility = dto.visibility;
      changed.push('visibility');
      if (dto.visibility === 'common') {
        // al hacerse común ya no hay accesos individuales ni solicitudes que atender
        await this.shares.delete({ noteId: id });
        await this.requests.delete({ noteId: id });
        note.shares = [];
      }
      // las carpetas son de cada pestaña: al cambiar de pestaña la nota vuelve a la raíz
      if (dto.folderId === undefined) note.folderId = null;
    }
    if (dto.folderId !== undefined && (dto.folderId ?? null) !== note.folderId) {
      if (!canMoveNote(note, access)) throw new ForbiddenException('No puedes mover esta nota de carpeta');
      note.folderId = await this.folderFor(dto.folderId, note, actor);
    }
    if (note.folderId !== before.folderId) changed.push('folder');
    if (changed.length === 0) return this.present(note, access, actor);
    await this.notes.update(id, { title: note.title, body: note.body, visibility: note.visibility, folderId: note.folderId, updatedById: actor.id });
    // el cuerpo no se copia al registro de auditoría: las privadas no deben filtrarse por ahí
    await this.audit.log(actor, 'note.update', 'note', id, before, { title: note.title, visibility: note.visibility, folderId: note.folderId, changed });
    return this.present(await this.load(id), access, actor);
  }

  async remove(id: string, actor: AuthUser) {
    const note = await this.load(id);
    if (this.accessOf(note, actor) === 'none') throw new ForbiddenException('No tienes acceso a esta nota');
    if (!canDeleteNote(note, actor.id, actor.role)) throw new ForbiddenException('Solo el autor o un administrador puede eliminar esta nota');
    // los adjuntos caen en cascada; sus objetos se borran del almacenamiento después
    await this.notes.delete(id);
    await this.storage.delete((note.files ?? []).map((f) => f.storedName));
    await this.audit.log(actor, 'note.delete', 'note', id, { title: note.title, visibility: note.visibility, files: (note.files ?? []).length }, null);
    return { ok: true };
  }

  async setShares(id: string, dto: SetSharesDto, actor: AuthUser) {
    const note = await this.load(id);
    if (this.accessOf(note, actor) !== 'owner') throw new ForbiddenException('Solo el dueño puede compartir esta nota');
    if (note.visibility !== 'private') throw new BadRequestException('Solo las notas privadas se comparten por persona');

    const wanted = new Map<string, NotePermission>();
    for (const s of dto.shares) if (s.userId !== actor.id) wanted.set(s.userId, s.permission);
    const active = wanted.size ? await this.users.find({ where: { id: In([...wanted.keys()]), isActive: true } }) : [];
    const valid = new Map(active.map((u) => [u.id, u]));

    const existing = new Map((note.shares ?? []).map((s) => [s.userId, s]));
    const removed = [...existing.keys()].filter((uid) => !valid.has(uid));
    if (removed.length) await this.shares.delete({ noteId: id, userId: In(removed) });
    const added: User[] = [];
    for (const [uid, user] of valid) {
      const permission = wanted.get(uid)!;
      if (existing.get(uid)?.permission === permission) continue;
      await this.shares.save(this.shares.create({ noteId: id, userId: uid, permission }));
      if (!existing.has(uid)) added.push(user);
    }
    // quien recibe acceso por esta vía ya no necesita su solicitud pendiente
    if (valid.size) {
      await this.requests.update(
        { noteId: id, userId: In([...valid.keys()]), status: 'pending' },
        { status: 'approved', resolvedAt: new Date() },
      );
    }
    await this.audit.log(
      actor,
      'note.share',
      'note',
      id,
      { shares: [...existing.values()].map((s) => ({ userId: s.userId, permission: s.permission })) },
      { shares: [...valid.keys()].map((uid) => ({ userId: uid, permission: wanted.get(uid) })) },
    );
    for (const user of added) {
      this.events.emit('note.shared', {
        note: { id, title: note.title },
        actor: { id: actor.id, name: actor.name },
        user: person(user),
        permission: wanted.get(user.id),
      });
    }
    return this.present(await this.load(id), 'owner', actor);
  }

  async requestAccess(id: string, actor: AuthUser) {
    const note = await this.load(id);
    if (note.visibility !== 'private') throw new BadRequestException('Esta nota no es privada');
    if (this.accessOf(note, actor) !== 'none') throw new BadRequestException('Ya tienes acceso a esta nota');
    if (!note.owner) throw new BadRequestException('Esta nota ya no tiene dueño');
    const pending = await this.requests.findOne({ where: { noteId: id, userId: actor.id, status: 'pending' } });
    if (pending) return { status: pending.status };
    const req = await this.requests.save(this.requests.create({ noteId: id, userId: actor.id, status: 'pending' }));
    await this.audit.log(actor, 'note.access_request', 'note', id, null, { requestId: req.id });
    if (note.owner.isActive) {
      this.events.emit('note.access_requested', {
        note: { id, title: note.title },
        actor: { id: actor.id, name: actor.name },
        owner: person(note.owner),
      });
    }
    return { status: req.status };
  }

  async listRequests(id: string, actor: AuthUser) {
    const note = await this.load(id);
    if (this.accessOf(note, actor) !== 'owner') throw new ForbiddenException('Solo el dueño ve las solicitudes de acceso');
    const rows = await this.requests.find({ where: { noteId: id, status: 'pending' }, order: { createdAt: 'ASC' } });
    return rows.map((r) => ({ id: r.id, noteId: r.noteId, user: { id: r.user.id, name: r.user.name, email: r.user.email }, createdAt: r.createdAt }));
  }

  async resolveRequest(requestId: string, dto: ResolveRequestDto, actor: AuthUser) {
    const req = await this.requests.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Solicitud no encontrada');
    const note = await this.load(req.noteId);
    if (this.accessOf(note, actor) !== 'owner') throw new ForbiddenException('Solo el dueño puede resolver solicitudes');
    if (req.status !== 'pending') throw new BadRequestException('La solicitud ya fue resuelta');
    const permission: NotePermission = dto.permission ?? 'view';
    req.status = dto.approve ? 'approved' : 'rejected';
    req.resolvedAt = new Date();
    await this.requests.save(req);
    if (dto.approve) {
      await this.shares.save(this.shares.create({ noteId: note.id, userId: req.userId, permission }));
    }
    await this.audit.log(actor, 'note.access_resolve', 'note', note.id, null, {
      requestId, userId: req.userId, approved: dto.approve, ...(dto.approve && { permission }),
    });
    if (dto.approve && req.user.isActive) {
      this.events.emit('note.access_granted', {
        note: { id: note.id, title: note.title },
        actor: { id: actor.id, name: actor.name },
        user: person(req.user),
        permission,
      });
    }
    return { id: req.id, status: req.status };
  }

  async pendingCount(actor: AuthUser) {
    const count = await this.requests
      .createQueryBuilder('r')
      .innerJoin('r.note', 'n')
      .where("r.status = 'pending'")
      .andWhere('n.owner_id = :uid', { uid: actor.id })
      .getCount();
    return { count };
  }

  // --------------------------------------------------------------- carpetas

  /** Carpeta visible para el usuario: las privadas ajenas se responden como inexistentes. */
  private async loadFolder(id: string, actor: AuthUser): Promise<NoteFolder> {
    const folder = await this.folders.findOne({ where: { id } });
    if (!folder || !canManageFolder(folder, actor.id)) throw new NotFoundException('Carpeta no encontrada');
    return folder;
  }

  /** Valida el destino de una nota (`null`/ausente = raíz) y devuelve el id que se guarda. */
  private async folderFor(
    folderId: string | null | undefined,
    note: { visibility: NoteVisibility; ownerId: string | null },
    actor: AuthUser,
  ): Promise<string | null> {
    if (!folderId) return null;
    const folder = await this.loadFolder(folderId, actor);
    if (!folderFitsNote(folder, note)) throw new BadRequestException('Esa carpeta no corresponde a esta nota');
    return folder.id;
  }

  private nameOrThrow(raw: unknown) {
    const v = validateFolderName(raw);
    if (v.error !== undefined) throw new BadRequestException(v.error);
    return v.name;
  }

  private rethrowDuplicate(e: unknown): never {
    if ((e as { code?: string })?.code === '23505') throw new ConflictException('Ya existe una carpeta con ese nombre aquí');
    throw e;
  }

  /** Todas las carpetas de la pestaña, con su ruta completa: para elegir a dónde mover una nota. */
  async allFolders(scope: string | undefined, actor: AuthUser) {
    const visibility: NoteVisibility = scope === 'private' ? 'private' : 'common';
    const rows = await this.folders.find({ where: { visibility, ownerId: visibility === 'private' ? actor.id : IsNull() } });
    const byId = new Map(rows.map((f) => [f.id, f]));
    const path = (f: NoteFolder): string[] => {
      const names: string[] = [];
      for (let cur: NoteFolder | undefined = f; cur && names.length < 50; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
        names.unshift(cur.name);
      }
      return names;
    };
    return rows
      .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId, path: path(f).join(' / ') }))
      .sort((a, b) => a.path.localeCompare(b.path, 'es', { sensitivity: 'base' }));
  }

  async createFolder(dto: CreateNoteFolderDto, actor: AuthUser) {
    const name = this.nameOrThrow(dto.name);
    const ownerId = dto.visibility === 'private' ? actor.id : null;
    if (dto.parentId) {
      const parent = await this.loadFolder(dto.parentId, actor);
      if (parent.visibility !== dto.visibility) throw new BadRequestException('La carpeta superior es de otra pestaña');
    }
    let folder: NoteFolder;
    try {
      folder = await this.folders.save(
        this.folders.create({ visibility: dto.visibility, ownerId, parentId: dto.parentId ?? null, name, createdById: actor.id }),
      );
    } catch (e) {
      this.rethrowDuplicate(e);
    }
    await this.audit.log(actor, 'note_folder.create', 'note_folder', folder.id, null, { name, visibility: folder.visibility, parentId: folder.parentId });
    return this.presentFolder(folder);
  }

  async renameFolder(id: string, dto: RenameNoteFolderDto, actor: AuthUser) {
    const folder = await this.loadFolder(id, actor);
    const name = this.nameOrThrow(dto.name);
    if (name === folder.name) return this.presentFolder(folder);
    try {
      await this.folders.update(id, { name });
    } catch (e) {
      this.rethrowDuplicate(e);
    }
    await this.audit.log(actor, 'note_folder.rename', 'note_folder', id, { name: folder.name }, { name });
    return this.presentFolder({ ...folder, name });
  }

  /** Borra la carpeta y sus subcarpetas; las notas que contenían quedan en la raíz. */
  async removeFolder(id: string, actor: AuthUser) {
    const folder = await this.loadFolder(id, actor);
    const [{ notes }]: { notes: number }[] = await this.dataSource.query(
      `WITH RECURSIVE tree AS (
         SELECT id FROM note_folders WHERE id = $1
         UNION ALL
         SELECT f.id FROM note_folders f JOIN tree t ON f.parent_id = t.id
       ) SELECT count(*)::int AS notes FROM notes WHERE folder_id IN (SELECT id FROM tree)`,
      [id],
    );
    await this.folders.delete(id);
    await this.audit.log(actor, 'note_folder.delete', 'note_folder', id, { name: folder.name, visibility: folder.visibility, notesMovedToRoot: notes }, null);
    return { ok: true, notesMovedToRoot: notes };
  }

  // --------------------------------------------------------------- archivos

  private async editable(noteId: string, actor: AuthUser) {
    const note = await this.load(noteId);
    if (!canEditNote(this.accessOf(note, actor))) throw new ForbiddenException('No tienes permiso para editar esta nota');
    return note;
  }

  async upload(noteId: string, uploads: Express.Multer.File[], actor: AuthUser) {
    const note = await this.editable(noteId, actor);
    if (uploads.length === 0) throw new BadRequestException('No se recibió ningún archivo');
    // primero al almacenamiento y luego las filas; si algo falla se borran los objetos subidos
    const stored = uploads.map((f) => {
      const originalName = decodeName(f.originalname).slice(0, 300);
      return { file: f, originalName, name: storageKey(`notas/${noteId}`, originalName) };
    });
    let rows: NoteFile[];
    try {
      await Promise.all(stored.map((s) => this.storage.put(s.name, s.file.buffer, s.file.mimetype)));
      rows = await this.files.save(
        stored.map(({ file: f, originalName, name }) =>
          this.files.create({
            noteId,
            originalName,
            mimeType: (f.mimetype || 'application/octet-stream').slice(0, 150),
            size: f.size,
            storedName: name,
            uploadedById: actor.id,
          }),
        ),
      );
    } catch (e) {
      await this.storage.delete(stored.map((s) => s.name));
      throw e;
    }
    for (const r of rows) {
      await this.audit.log(actor, 'note_file.create', 'note_file', r.id, null, { noteId, title: note.title, originalName: r.originalName, size: r.size });
    }
    const full = await this.files.find({ where: rows.map((r) => ({ id: r.id })), order: { createdAt: 'ASC' } });
    return full.map((f) => this.presentFile(f));
  }

  async getFile(noteId: string, fileId: string, actor: AuthUser) {
    const note = await this.load(noteId);
    if (this.accessOf(note, actor) === 'none') throw new ForbiddenException('No tienes acceso a esta nota');
    const file = (note.files ?? []).find((f) => f.id === fileId);
    if (!file) throw new NotFoundException('Archivo no encontrado');
    return { file, stream: await this.storage.getStream(file.storedName) };
  }

  async removeFile(noteId: string, fileId: string, actor: AuthUser) {
    const note = await this.editable(noteId, actor);
    const file = (note.files ?? []).find((f) => f.id === fileId);
    if (!file) throw new NotFoundException('Archivo no encontrado');
    await this.files.delete(fileId);
    await this.storage.delete([file.storedName]);
    await this.audit.log(actor, 'note_file.delete', 'note_file', fileId, { noteId, title: note.title, originalName: file.originalName, size: file.size }, null);
    return { ok: true };
  }
}
