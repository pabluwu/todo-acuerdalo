export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      message = Array.isArray(data.message) ? data.message.join('. ') : (data.message ?? message);
    } catch {
      /* respuesta sin JSON */
    }
    if (res.status === 401 && typeof window !== 'undefined' && !['/login', '/register'].includes(window.location.pathname)) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000_000], ['month', 2_592_000_000], ['day', 86_400_000], ['hour', 3_600_000], ['minute', 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'ahora mismo';
}

/** Estado del plazo: vencida, o con vencimiento en las próximas 24 h. Las completadas no cuentan. */
export function dueState(task: { dueDate: string | null; status: string }): 'overdue' | 'soon' | null {
  if (!task.dueDate || task.status === 'completed') return null;
  const left = new Date(task.dueDate).getTime() - Date.now();
  if (left < 0) return 'overdue';
  return left <= 86_400_000 ? 'soon' : null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
