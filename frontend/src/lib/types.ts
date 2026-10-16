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

export const STATUSES: { id: TaskStatus; label: string; dot: string }[] = [
  { id: 'not_started', label: 'Sin iniciar', dot: 'bg-zinc-400' },
  { id: 'in_progress', label: 'En proceso', dot: 'bg-accent' },
  { id: 'completed', label: 'Completada', dot: 'bg-emerald-500' },
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

export const PRIORITIES: { id: TaskPriority; label: string; dot: string }[] = [
  { id: 'high', label: 'Alta', dot: 'bg-red-500' },
  { id: 'medium', label: 'Media', dot: 'bg-amber-400' },
  { id: 'low', label: 'Baja', dot: 'bg-zinc-300' },
];
