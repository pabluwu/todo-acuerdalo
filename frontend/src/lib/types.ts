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
  email: string;
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

/** `tint` pinta el fondo de la columna; `fg` el ícono y la insignia de estado. */
export const STATUSES: { id: TaskStatus; label: string; dot: string; icon: LucideIcon; tint: string; fg: string; badge: string }[] = [
  { id: 'not_started', label: 'Sin iniciar', dot: 'bg-zinc-400', icon: Circle, tint: 'bg-stone-100/80', fg: 'text-zinc-500', badge: 'bg-white text-zinc-600 ring-zinc-200' },
  { id: 'in_progress', label: 'En proceso', dot: 'bg-accent', icon: CircleDashed, tint: 'bg-indigo-50/80', fg: 'text-accent', badge: 'bg-white text-indigo-700 ring-indigo-200' },
  { id: 'completed', label: 'Completada', dot: 'bg-emerald-500', icon: CircleCheck, tint: 'bg-emerald-50/80', fg: 'text-emerald-600', badge: 'bg-white text-emerald-700 ring-emerald-200' },
];

export const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Inició sesión',
  'auth.login_failed': 'Intento de acceso fallido',
  'user.register': 'Se registró',
  'user.activate': 'Activó usuario',
  'user.deactivate': 'Desactivó usuario',
  'user.role_change': 'Cambió el rol de un usuario',
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
