import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { decodeName } from '../comments/comments.service';
import { AuthUser } from '../common/decorators';
import { ClientFile } from '../entities/client-file.entity';
import { ClientFolder } from '../entities/client-folder.entity';
import { ClientNote } from '../entities/client-note.entity';
import { Client } from '../entities/client.entity';
import { ExternalContact } from '../entities/external-contact.entity';
import { User } from '../entities/user.entity';
import { storageKey } from '../storage/storage-key';
import { StorageService } from '../storage/storage.service';
import { planContactSync } from './contact-sync';
import {
  ClientQueryDto, CreateClientDto, CreateClientNoteDto, CreateFolderDto, RenameDto, UpdateClientDto, UpdateClientNoteDto,
} from './clients.dto';
import { validateFolderName } from '../common/folder-name';
import { isValidRut, normalizeRut } from './rut';

const lite = (u: User | null) => (u ? { id: u.id, name: u.name } : null);

/** Escapa los comodines de LIKE para que la búsqueda sea literal. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;

/** Vacío o solo espacios cuenta como "sin dato". */
const clean = (v: string | null | undefined): string | null | undefined => (v === undefined ? undefined : (v?.trim() || null));

/** Campos de texto de la ficha (además del nombre, el RUT y el correo, que se tratan aparte). */
const TEXT_FIELDS = [
  'claveUnica', 'address', 'phone', 'occupation', 'maritalStatus', 'matter',
  'defendantName', 'defendantAddress', 'defendantIncome',
] as const;

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private clients: Repository<Client>,
    @InjectRepository(ClientNote) private notes: Repository<ClientNote>,
    @InjectRepository(ClientFolder) private folders: Repository<ClientFolder>,
    @InjectRepository(ClientFile) private files: Repository<ClientFile>,
    private dataSource: DataSource,
    private audit: AuditService,
    private storage: StorageService,
  ) {}

  // ---------------------------------------------------------------- clientes

  present(c: Client) {
    return {
      id: c.id,
      name: c.name,
      rut: c.rut,
      claveUnica: c.claveUnica,
      address: c.address,
      email: c.email,
      phone: c.phone,
      occupation: c.occupation,
      maritalStatus: c.maritalStatus,
      matter: c.matter,
      defendantName: c.defendantName,
      defendantRut: c.defendantRut,
      defendantAddress: c.defendantAddress,
      defendantIncome: c.defendantIncome,
      caseHistory: c.caseHistory,
      createdBy: lite(c.createdBy),
      updatedBy: lite(c.updatedBy),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private async load(id: string): Promise<Client> {
    const client = await this.clients.findOne({ where: { id } });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  /** Normaliza y valida un RUT opcional; devuelve `null` si viene vacío. */
  private rut(value: string | null | undefined, label: string): string | null | undefined {
    const v = clean(value);
    if (!v) return v;
    if (!isValidRut(v)) throw new BadRequestException(`${label} no es válido`);
    return normalizeRut(v);
  }

  async list(dto: ClientQueryDto) {
    const qb = this.clients.createQueryBuilder('c').leftJoinAndSelect('c.updatedBy', 'ub');
    const term = (dto.q ?? '').trim().slice(0, 100);
    if (term) {
      // el RUT se guarda sin puntos: se busca también tal como lo escribe quien tipea
      qb.where(
        `(c.name ILIKE :q ESCAPE '\\' OR c.rut ILIKE :qr ESCAPE '\\' OR c.matter ILIKE :q ESCAPE '\\' OR c.defendant_name ILIKE :q ESCAPE '\\')`,
        { q: likePattern(term), qr: likePattern(term.replace(/\./g, '')) },
      );
    }
    qb.orderBy('c.updatedAt', 'DESC');
    const rows = await qb.getMany();
    const ids = rows.map((c) => c.id);
    const [notes, files] = ids.length
      ? await Promise.all([
          this.counts('client_notes', ids),
          this.counts('client_files', ids),
        ])
      : [new Map<string, number>(), new Map<string, number>()];
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      rut: c.rut,
      matter: c.matter,
      defendantName: c.defendantName,
      updatedBy: lite(c.updatedBy),
      noteCount: notes.get(c.id) ?? 0,
      fileCount: files.get(c.id) ?? 0,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  private async counts(table: 'client_notes' | 'client_files', ids: string[]) {
    const rows: { client_id: string; n: number }[] = await this.dataSource.query(
      `SELECT client_id, count(*)::int AS n FROM ${table} WHERE client_id = ANY($1::uuid[]) GROUP BY client_id`,
      [ids],
    );
    return new Map(rows.map((r) => [r.client_id, r.n]));
  }

  async get(id: string) {
    return this.present(await this.load(id));
  }

  async create(dto: CreateClientDto, actor: AuthUser) {
    const email = clean(dto.email) ?? null;
    const client = this.clients.create({
      name: dto.name.trim(),
      rut: this.rut(dto.rut, 'El RUT') ?? null,
      email,
      defendantRut: this.rut(dto.defendantRut, 'El RUT del demandado') ?? null,
      caseHistory: dto.caseHistory ?? '',
      createdById: actor.id,
      updatedById: actor.id,
    });
    if (!client.name) throw new BadRequestException('El nombre es obligatorio');
    for (const f of TEXT_FIELDS) client[f] = clean(dto[f]) ?? null;
    const saved = await this.dataSource.transaction(async (m) => {
      const row = await m.getRepository(Client).save(client);
      await this.syncContact(m, row, actor);
      return row;
    });
    await this.audit.log(actor, 'client.create', 'client', saved.id, null, { name: saved.name, rut: saved.rut });
    return this.present(await this.load(saved.id));
  }

  async update(id: string, dto: UpdateClientDto, actor: AuthUser) {
    const client = await this.load(id);
    const changed: string[] = [];
    const set = <K extends keyof Client>(key: K, value: Client[K] | undefined) => {
      if (value !== undefined && value !== client[key]) {
        client[key] = value;
        changed.push(key as string);
      }
    };
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('El nombre es obligatorio');
      set('name', dto.name.trim());
    }
    set('rut', this.rut(dto.rut, 'El RUT'));
    set('email', clean(dto.email));
    set('defendantRut', this.rut(dto.defendantRut, 'El RUT del demandado'));
    for (const f of TEXT_FIELDS) set(f, clean(dto[f]));
    if (dto.caseHistory !== undefined) set('caseHistory', dto.caseHistory ?? '');
    if (changed.length === 0) return this.present(client);

    client.updatedById = actor.id;
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(Client).update(id, {
        name: client.name, rut: client.rut, claveUnica: client.claveUnica, address: client.address, email: client.email,
        phone: client.phone, occupation: client.occupation, maritalStatus: client.maritalStatus, matter: client.matter,
        defendantName: client.defendantName, defendantRut: client.defendantRut, defendantAddress: client.defendantAddress,
        defendantIncome: client.defendantIncome, caseHistory: client.caseHistory, updatedById: actor.id,
      });
      // el contacto del calendario solo depende del nombre y del correo
      if (changed.includes('name') || changed.includes('email')) await this.syncContact(m, client, actor);
    });
    // solo los nombres de los campos: ni la clave única ni la historia del caso pasan al registro
    await this.audit.log(actor, 'client.update', 'client', id, null, { name: client.name, changed });
    return this.present(await this.load(id));
  }

  async remove(id: string, actor: AuthUser) {
    const client = await this.load(id);
    const rows: { stored_name: string }[] = await this.dataSource.query(
      'SELECT stored_name FROM client_files WHERE client_id = $1',
      [id],
    );
    // notas, carpetas y archivos caen en cascada; el contacto del calendario queda sin vincular
    await this.clients.delete(id);
    await this.storage.delete(rows.map((r) => r.stored_name));
    await this.audit.log(actor, 'client.delete', 'client', id, { name: client.name, rut: client.rut, files: rows.length }, null);
    return { ok: true };
  }

  /**
   * Deja al cliente reflejado como contacto externo del calendario (misma transacción que el cliente).
   * Un correo que ya es de otro contacto impide guardar: devuelve 409 y se deshace todo.
   */
  private async syncContact(m: EntityManager, client: Client, actor: AuthUser) {
    const contacts = m.getRepository(ExternalContact);
    const linked = await contacts.findOne({ where: { clientId: client.id } });
    const found = client.email
      ? await contacts.createQueryBuilder('c').where('lower(c.email) = lower(:e)', { e: client.email }).getOne()
      : null;
    const owner = found?.clientId && found.clientId !== client.id
      ? await m.getRepository(Client).findOne({ where: { id: found.clientId } })
      : null;
    const plan = planContactSync({
      clientId: client.id,
      name: client.name,
      email: client.email,
      linked: linked && { id: linked.id, clientId: linked.clientId },
      byEmail: found && { id: found.id, clientId: found.clientId, clientName: owner?.name },
    });
    switch (plan.kind) {
      case 'conflict':
        throw new ConflictException(plan.message);
      case 'create':
        await contacts.save(contacts.create({ name: plan.name, email: plan.email, clientId: client.id, createdById: actor.id }));
        break;
      case 'update':
        await contacts.update(plan.contactId, { name: plan.name, email: plan.email });
        break;
      case 'adopt':
        await contacts.update(plan.contactId, { name: plan.name, clientId: client.id });
        break;
    }
  }

  // ------------------------------------------------------------------ notas

  private presentNote(n: ClientNote, withBody: boolean) {
    return {
      id: n.id,
      clientId: n.clientId,
      title: n.title,
      ...(withBody ? { body: n.body } : { excerpt: n.body.slice(0, 300) }),
      author: lite(n.author),
      updatedBy: lite(n.updatedBy),
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    };
  }

  private async loadNote(clientId: string, noteId: string): Promise<ClientNote> {
    const note = await this.notes.findOne({ where: { id: noteId, clientId } });
    if (!note) throw new NotFoundException('Nota no encontrada');
    return note;
  }

  async listNotes(clientId: string) {
    await this.load(clientId);
    const rows = await this.notes.find({ where: { clientId }, order: { updatedAt: 'DESC' } });
    return rows.map((n) => this.presentNote(n, false));
  }

  async getNote(clientId: string, noteId: string) {
    return this.presentNote(await this.loadNote(clientId, noteId), true);
  }

  async createNote(clientId: string, dto: CreateClientNoteDto, actor: AuthUser) {
    await this.load(clientId);
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('El título es obligatorio');
    const note = await this.notes.save(
      this.notes.create({ clientId, title, body: dto.body ?? '', authorId: actor.id, updatedById: actor.id }),
    );
    await this.audit.log(actor, 'client_note.create', 'client_note', note.id, null, { clientId, title });
    return this.presentNote(await this.loadNote(clientId, note.id), true);
  }

  async updateNote(clientId: string, noteId: string, dto: UpdateClientNoteDto, actor: AuthUser) {
    const note = await this.loadNote(clientId, noteId);
    const changed: string[] = [];
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('El título es obligatorio');
      if (title !== note.title) { note.title = title; changed.push('title'); }
    }
    if (dto.body !== undefined && dto.body !== note.body) { note.body = dto.body; changed.push('body'); }
    if (changed.length === 0) return this.presentNote(note, true);
    await this.notes.update(noteId, { title: note.title, body: note.body, updatedById: actor.id });
    // el cuerpo no se copia al registro de auditoría
    await this.audit.log(actor, 'client_note.update', 'client_note', noteId, null, { clientId, title: note.title, changed });
    return this.presentNote(await this.loadNote(clientId, noteId), true);
  }

  async removeNote(clientId: string, noteId: string, actor: AuthUser) {
    const note = await this.loadNote(clientId, noteId);
    await this.notes.delete(noteId);
    await this.audit.log(actor, 'client_note.delete', 'client_note', noteId, { clientId, title: note.title }, null);
    return { ok: true };
  }

  // --------------------------------------------------------------- carpetas

  private async loadFolder(clientId: string, folderId: string): Promise<ClientFolder> {
    const folder = await this.folders.findOne({ where: { id: folderId, clientId } });
    if (!folder) throw new NotFoundException('Carpeta no encontrada');
    return folder;
  }

  private presentFolder(f: ClientFolder, itemCount = 0) {
    return { id: f.id, name: f.name, parentId: f.parentId, itemCount, createdBy: lite(f.createdBy), createdAt: f.createdAt };
  }

  private presentFile(f: ClientFile) {
    return {
      id: f.id,
      folderId: f.folderId,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      uploadedBy: lite(f.uploadedBy),
      createdAt: f.createdAt,
    };
  }

  /** Contenido de una carpeta (o de la raíz) con su ruta de navegación. */
  async listFolder(clientId: string, parentId: string | undefined) {
    await this.load(clientId);
    const folder = parentId ? await this.loadFolder(clientId, parentId) : null;
    const breadcrumb: { id: string; name: string }[] = folder
      ? await this.dataSource.query(
          `WITH RECURSIVE up AS (
             SELECT id, parent_id, name, 1 AS depth FROM client_folders WHERE id = $1 AND client_id = $2
             UNION ALL
             SELECT f.id, f.parent_id, f.name, up.depth + 1 FROM client_folders f JOIN up ON f.id = up.parent_id
           ) SELECT id, name FROM up ORDER BY depth DESC`,
          [folder.id, clientId],
        )
      : [];
    const rows = await this.folders.find({
      where: { clientId, parentId: folder ? folder.id : IsNull() },
    });
    // cuántos elementos (carpetas y archivos, a cualquier profundidad) hay dentro de cada carpeta
    const sizes: { id: string; folders: number; files: number }[] = await this.dataSource.query(
      `WITH RECURSIVE tree AS (
         SELECT id AS root, id FROM client_folders WHERE client_id = $1 AND parent_id IS NOT DISTINCT FROM $2::uuid
         UNION ALL
         SELECT t.root, f.id FROM client_folders f JOIN tree t ON f.parent_id = t.id
       )
       SELECT t.root AS id, count(*)::int - 1 AS folders,
              (SELECT count(*)::int FROM client_files cf WHERE cf.folder_id IN (SELECT x.id FROM tree x WHERE x.root = t.root)) AS files
       FROM tree t GROUP BY t.root`,
      [clientId, folder ? folder.id : null],
    );
    const size = new Map(sizes.map((s) => [s.id, s.folders + s.files]));
    const files = await this.files.find({ where: { clientId, folderId: folder ? folder.id : IsNull() } });
    const byName = (a: { name?: string; originalName?: string }, b: { name?: string; originalName?: string }) =>
      (a.name ?? a.originalName ?? '').localeCompare(b.name ?? b.originalName ?? '', 'es', { sensitivity: 'base' });
    return {
      folder: folder && { id: folder.id, name: folder.name, parentId: folder.parentId },
      breadcrumb,
      folders: rows.sort(byName).map((f) => this.presentFolder(f, size.get(f.id) ?? 0)),
      files: files.sort(byName).map((f) => this.presentFile(f)),
    };
  }

  private nameOrThrow(raw: unknown, max?: number) {
    const v = validateFolderName(raw, max);
    if (v.error) throw new BadRequestException(v.error);
    return v.name;
  }

  private rethrowDuplicate(e: unknown): never {
    if ((e as { code?: string })?.code === '23505') throw new ConflictException('Ya existe una carpeta con ese nombre aquí');
    throw e;
  }

  async createFolder(clientId: string, dto: CreateFolderDto, actor: AuthUser) {
    await this.load(clientId);
    const name = this.nameOrThrow(dto.name);
    if (dto.parentId) await this.loadFolder(clientId, dto.parentId);
    let folder: ClientFolder;
    try {
      folder = await this.folders.save(this.folders.create({ clientId, parentId: dto.parentId ?? null, name, createdById: actor.id }));
    } catch (e) {
      this.rethrowDuplicate(e);
    }
    await this.audit.log(actor, 'client_folder.create', 'client_folder', folder.id, null, { clientId, name, parentId: folder.parentId });
    return this.presentFolder(await this.loadFolder(clientId, folder.id));
  }

  async renameFolder(clientId: string, folderId: string, dto: RenameDto, actor: AuthUser) {
    const folder = await this.loadFolder(clientId, folderId);
    const name = this.nameOrThrow(dto.name);
    if (name === folder.name) return this.presentFolder(folder);
    try {
      await this.folders.update(folderId, { name });
    } catch (e) {
      this.rethrowDuplicate(e);
    }
    await this.audit.log(actor, 'client_folder.rename', 'client_folder', folderId, { clientId, name: folder.name }, { clientId, name });
    return this.presentFolder(await this.loadFolder(clientId, folderId));
  }

  async removeFolder(clientId: string, folderId: string, actor: AuthUser) {
    const folder = await this.loadFolder(clientId, folderId);
    // los archivos de esta carpeta y de todas las de abajo: se borran de storage tras borrar las filas
    const rows: { stored_name: string }[] = await this.dataSource.query(
      `WITH RECURSIVE tree AS (
         SELECT id FROM client_folders WHERE id = $1
         UNION ALL
         SELECT f.id FROM client_folders f JOIN tree t ON f.parent_id = t.id
       ) SELECT stored_name FROM client_files WHERE folder_id IN (SELECT id FROM tree)`,
      [folderId],
    );
    await this.folders.delete(folderId);
    await this.storage.delete(rows.map((r) => r.stored_name));
    await this.audit.log(actor, 'client_folder.delete', 'client_folder', folderId, { clientId, name: folder.name, files: rows.length }, null);
    return { ok: true };
  }

  // --------------------------------------------------------------- archivos

  async upload(clientId: string, folderId: string | undefined, uploads: Express.Multer.File[], actor: AuthUser) {
    await this.load(clientId);
    if (uploads.length === 0) throw new BadRequestException('No se recibió ningún archivo');
    if (folderId) await this.loadFolder(clientId, folderId);
    // primero al almacenamiento y luego las filas; si algo falla se borran los objetos subidos
    const stored = uploads.map((f) => ({
      file: f,
      name: storageKey(`clientes/${clientId}`, decodeName(f.originalname)),
    }));
    let rows: ClientFile[];
    try {
      await Promise.all(stored.map((s) => this.storage.put(s.name, s.file.buffer, s.file.mimetype)));
      rows = await this.files.save(
        stored.map(({ file: f, name }) =>
          this.files.create({
            clientId,
            folderId: folderId ?? null,
            originalName: decodeName(f.originalname).slice(0, 300),
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
      await this.audit.log(actor, 'client_file.create', 'client_file', r.id, null, {
        clientId, folderId: r.folderId, originalName: r.originalName, size: r.size,
      });
    }
    const full = await this.files.find({ where: rows.map((r) => ({ id: r.id })) });
    return full.map((f) => this.presentFile(f));
  }

  private async loadFile(clientId: string, fileId: string): Promise<ClientFile> {
    const file = await this.files.findOne({ where: { id: fileId, clientId } });
    if (!file) throw new NotFoundException('Archivo no encontrado');
    return file;
  }

  async getFile(clientId: string, fileId: string) {
    const file = await this.loadFile(clientId, fileId);
    return { file, stream: await this.storage.getStream(file.storedName) };
  }

  async renameFile(clientId: string, fileId: string, dto: RenameDto, actor: AuthUser) {
    const file = await this.loadFile(clientId, fileId);
    const name = this.nameOrThrow(dto.name, 300);
    if (name !== file.originalName) {
      await this.files.update(fileId, { originalName: name });
      await this.audit.log(actor, 'client_file.rename', 'client_file', fileId, { clientId, originalName: file.originalName }, { clientId, originalName: name });
    }
    return this.presentFile(await this.loadFile(clientId, fileId));
  }

  async removeFile(clientId: string, fileId: string, actor: AuthUser) {
    const file = await this.loadFile(clientId, fileId);
    await this.files.delete(fileId);
    await this.storage.delete([file.storedName]);
    await this.audit.log(actor, 'client_file.delete', 'client_file', fileId, { clientId, originalName: file.originalName, size: file.size }, null);
    return { ok: true };
  }
}
