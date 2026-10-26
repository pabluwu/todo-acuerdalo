import { ChevronsDown, ChevronsUp, Circle, CircleCheck, CircleDashed, Equal, type LucideIcon } from 'lucide-react';

export type Role = 'admin' | 'user';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  copyEmails: string[];
  createdAt: string;
}

export interface UserLite {
  id: string;
  name: string;
  email: string;
}

export interface TaskType {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType | null;
  dueDate: string | null;
  position: number;
  createdBy: { id: string; name: string } | null;
  assignees: UserLite[];
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface Comment {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string } | null;
  attachments: Attachment[];
}

export interface LogEntry {
  id: string;
  createdAt: string;
  data: {
    userId: string | null;
    userEmail: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    before: unknown;
    after: unknown;
    ip: string | null;
    at: string;
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExternalContact {
  id: string;
  name: string;
  /** Los contactos de un cliente pueden no tener correo */
  email: string | null;
  /** Cliente al que está vinculado; se edita desde su ficha */
  clientId: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  reminderMinutes: number | null;
  createdBy: { id: string; name: string } | null;
  participants: UserLite[];
  externalContacts: ExternalContact[];
  createdAt: string;
  updatedAt: string;
}

export type NoteVisibility = 'common' | 'private';
export type NotePermission = 'view' | 'edit';
/** Nivel de acceso del usuario actual a una nota. */
export type NoteAccess = 'owner' | 'edit' | 'view';

export interface NoteSummary {
  id: string;
  title: string;
  excerpt: string;
  visibility: NoteVisibility;
  /** Nulo en la raíz, o si es una privada ajena (la carpeta es del dueño) */
  folderId: string | null;
  fileCount: number;
  owner: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
  myAccess: NoteAccess;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteShare {
  userId: string;
  name: string;
  email: string;
  permission: NotePermission;
}

export interface Note extends Omit<NoteSummary, 'excerpt' | 'shared' | 'fileCount'> {
  body: string;
  canDelete: boolean;
  canMove: boolean;
  files: NoteFile[];
  /** Solo el dueño de una nota privada recibe la lista */
  shares: NoteShare[];
}

export interface NoteFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface NoteFolder {
  id: string;
  name: string;
  parentId: string | null;
  visibility: NoteVisibility;
  /** Subcarpetas y notas que contiene, a cualquier profundidad */
  itemCount: number;
  createdAt: string;
}

/** Carpeta para elegir destino al mover una nota; `path` es la ruta completa («A / B / C»). */
export interface NoteFolderOption {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
}

export interface NoteListing {
  folder: NoteFolder | null;
  /** De la carpeta de primer nivel hasta la actual (vacío en la raíz o al buscar) */
  breadcrumb: { id: string; name: string }[];
  folders: NoteFolder[];
  notes: NoteSummary[];
  /** Privadas de otros compartidas conmigo: solo en la raíz de Privadas */
  sharedWithMe: NoteSummary[];
}

export interface NoteAccessRequest {
  id: string;
  noteId: string;
  user: UserLite;
  createdAt: string;
}

/** Cuerpo del 403 al abrir una nota privada sin acceso: nunca incluye el contenido. */
export interface NoteNoAccess {
  code: 'NO_ACCESS';
  title: string;
  owner: { id: string; name: string } | null;
  requestStatus: 'pending' | 'rejected' | null;
}

export interface ClientSummary {
  id: string;
  name: string;
  rut: string | null;
  matter: string | null;
  defendantName: string | null;
  updatedBy: { id: string; name: string } | null;
  noteCount: number;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  rut: string | null;
  claveUnica: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  matter: string | null;
  defendantName: string | null;
  defendantRut: string | null;
  defendantAddress: string | null;
  defendantIncome: string | null;
  caseHistory: string;
  createdBy: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientNoteSummary {
  id: string;
  clientId: string;
  title: string;
  excerpt: string;
  author: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientNote extends Omit<ClientNoteSummary, 'excerpt'> {
  body: string;
}

export interface ClientFolder {
  id: string;
  name: string;
  parentId: string | null;
  /** Carpetas y archivos que contiene, a cualquier profundidad */
  itemCount: number;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface ClientFile {
  id: string;
  folderId: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface FolderListing {
  folder: { id: string; name: string; parentId: string | null } | null;
  /** De la carpeta de primer nivel hasta la actual (vacío en la raíz) */
  breadcrumb: { id: string; name: string }[];
  folders: ClientFolder[];
  files: ClientFile[];
}

/** `tint` pinta el fondo de la columna; `fg` el ícono y la insignia de estado. */
export const STATUSES: { id: TaskStatus; label: string; dot: string; icon: LucideIcon; tint: string; fg: string; badge: string }[] = [
  { id: 'not_started', label: 'Sin iniciar', dot: 'bg-zinc-400', icon: Circle, tint: 'bg-stone-100/80', fg: 'text-zinc-500', badge: 'bg-white text-zinc-600 ring-zinc-200' },
  { id: 'in_progress', label: 'En proceso', dot: 'bg-accent', icon: CircleDashed, tint: 'bg-indigo-50/80', fg: 'text-accent', badge: 'bg-white text-indigo-700 ring-indigo-200' },
  { id: 'completed', label: 'Completada', dot: 'bg-emerald-500', icon: CircleCheck, tint: 'bg-emerald-50/80', fg: 'text-emerald-600', badge: 'bg-white text-emerald-700 ring-emerald-200' },
];

export const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Inició sesión',
  'auth.login_failed': 'Intento de acceso fallido',
  'auth.password_reset_requested': 'Pidió restablecer su contraseña',
  'auth.password_reset': 'Restableció su contraseña',
  'user.register': 'Se registró',
  'user.activate': 'Activó usuario',
  'user.deactivate': 'Desactivó usuario',
  'user.role_change': 'Cambió el rol de un usuario',
  'user.copy_emails_change': 'Cambió las copias de correo de un usuario',
  'user.make_admin': 'Promovió a administrador',
  'task.create': 'Creó tarea',
  'task.update': 'Editó tarea',
  'task.move': 'Movió tarea',
  'task.delete': 'Eliminó tarea',
  'task.due_soon_alert': 'Aviso de vencimiento próximo',
  'task.overdue_alert': 'Aviso de tarea vencida',
  'event.create': 'Creó evento',
  'event.update': 'Editó evento',
  'event.move': 'Movió evento',
  'event.delete': 'Eliminó evento',
  'event.reminder': 'Recordatorio de evento',
  'contact.create': 'Creó contacto externo',
  'contact.update': 'Editó contacto externo',
  'contact.delete': 'Eliminó contacto externo',
  'task_type.create': 'Creó tipo de tarea',
  'task_type.update': 'Editó tipo de tarea',
  'note.create': 'Creó nota',
  'note.update': 'Editó nota',
  'note.delete': 'Eliminó nota',
  'note.share': 'Compartió nota',
  'note.access_request': 'Solicitó acceso a una nota',
  'note.access_resolve': 'Resolvió una solicitud de acceso a nota',
  'client.create': 'Registró cliente',
  'client.update': 'Editó cliente',
  'client.delete': 'Eliminó cliente',
  'client_note.create': 'Creó nota de cliente',
  'client_note.update': 'Editó nota de cliente',
  'client_note.delete': 'Eliminó nota de cliente',
  'client_folder.create': 'Creó carpeta de cliente',
  'client_folder.rename': 'Renombró carpeta de cliente',
  'client_folder.delete': 'Eliminó carpeta de cliente',
  'client_file.create': 'Subió archivo de cliente',
  'client_file.rename': 'Renombró archivo de cliente',
  'client_file.delete': 'Eliminó archivo de cliente',
  'comment.create': 'Comentó',
  'attachment.create': 'Adjuntó archivo',
  'http.request': 'Petición HTTP',
};

export const ENTITY_LABELS: Record<string, string> = {
  task: 'Tarea',
  task_type: 'Tipo de tarea',
  event: 'Evento',
  contact: 'Contacto externo',
  user: 'Usuario',
  note: 'Nota',
  client: 'Cliente',
  client_note: 'Nota de cliente',
  client_folder: 'Carpeta de cliente',
  client_file: 'Archivo de cliente',
  comment: 'Comentario',
  attachment: 'Adjunto',
  http: 'HTTP',
};

export const PRIORITIES: { id: TaskPriority; label: string; dot: string; icon: LucideIcon; fg: string; soft: string }[] = [
  { id: 'high', label: 'Alta', dot: 'bg-red-500', icon: ChevronsUp, fg: 'text-red-600', soft: 'bg-red-50' },
  { id: 'medium', label: 'Media', dot: 'bg-amber-400', icon: Equal, fg: 'text-amber-600', soft: 'bg-amber-50' },
  { id: 'low', label: 'Baja', dot: 'bg-zinc-300', icon: ChevronsDown, fg: 'text-zinc-500', soft: 'bg-zinc-100' },
];

/** Orden para ordenar por prioridad. */
export const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** Texto plano para extractos: sin marcas de markdown. */
export function plainExcerpt(md: string, max = 160): string {
  const text = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}
