import { SummaryTask, UserSummary } from '../scheduler/weekly-summary';
import { Change } from '../tasks/task-changes';

export function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function layout(title: string, body: string, link?: { url: string; text: string }): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#fafafa;font-family:Inter,Arial,sans-serif;color:#18181b">
<div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:32px">
<div style="font-size:13px;color:#71717a;margin-bottom:16px">Acuérdalo</div>
<h1 style="font-size:18px;font-weight:600;margin:0 0 16px">${esc(title)}</h1>
${body}
${link ? `<p style="margin-top:24px"><a href="${esc(link.url)}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">${esc(link.text)}</a></p>` : ''}
</div></body></html>`;
}

export function taskUrl(appUrl: string, taskId: string) {
  return `${appUrl.replace(/\/$/, '')}/tasks/${taskId}`;
}

export function noteUrl(appUrl: string, noteId: string) {
  return `${appUrl.replace(/\/$/, '')}/notes/${noteId}`;
}

export function assignedEmail(appUrl: string, task: { id: string; title: string }, actorName: string) {
  return {
    subject: `Se te asignó una tarea: ${task.title}`,
    html: layout(
      'Tienes una nueva tarea',
      `<p style="font-size:14px;line-height:1.6">${esc(actorName)} te asignó la tarea <strong>${esc(task.title)}</strong>.</p>`,
      { url: taskUrl(appUrl, task.id), text: 'Abrir tarea' },
    ),
  };
}

export function mentionEmail(
  appUrl: string,
  task: { id: string; title: string },
  actorName: string,
  comment: { body: string; attachmentNames: string[] },
) {
  const quote = comment.body
    ? `<blockquote style="margin:12px 0;padding:8px 14px;border-left:3px solid #4f46e5;background:#fafafa;color:#3f3f46;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(comment.body)}</blockquote>`
    : '';
  const files = comment.attachmentNames.length
    ? `<p style="font-size:13px;color:#71717a;margin:8px 0 4px">Archivos adjuntos:</p><ul style="margin:0;padding-left:20px;font-size:13px;color:#3f3f46">${comment.attachmentNames.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
    : '';
  return {
    subject: `${actorName} te mencionó en: ${task.title}`,
    html: layout(
      'Te etiquetaron en una tarea',
      `<p style="font-size:14px;line-height:1.6">${esc(actorName)} te mencionó en un comentario de <strong>${esc(task.title)}</strong>:</p>${quote}${files}`,
      { url: taskUrl(appUrl, task.id), text: 'Abrir tarea' },
    ),
  };
}

export function changedEmail(appUrl: string, task: { id: string; title: string }, actorName: string, changes: Change[]) {
  const rows = changes
    .map((c) => {
      const detail =
        c.field === 'comment' || c.field === 'attachment'
          ? `<div style="color:#3f3f46;white-space:pre-wrap">${esc(c.to)}</div>`
          : `<div style="color:#71717a;text-decoration:line-through">${esc(c.from) || '—'}</div><div>${esc(c.to) || '—'}</div>`;
      return `<tr><td style="padding:8px 12px 8px 0;vertical-align:top;font-size:13px;color:#71717a;white-space:nowrap">${esc(c.label)}</td><td style="padding:8px 0;font-size:14px">${detail}</td></tr>`;
    })
    .join('');
  return {
    subject: `Cambios en la tarea: ${task.title}`,
    html: layout(
      'Una tarea ha cambiado',
      `<p style="font-size:14px;line-height:1.6">${esc(actorName)} actualizó <strong>${esc(task.title)}</strong>:</p><table style="border-collapse:collapse;width:100%">${rows}</table>`,
      { url: taskUrl(appUrl, task.id), text: 'Abrir tarea' },
    ),
  };
}

export function dueEmail(appUrl: string, task: { id: string; title: string }, kind: 'due_soon' | 'overdue', dueDate: Date) {
  const when = dueDate.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
  const soon = kind === 'due_soon';
  return {
    subject: soon ? `Por vencer: ${task.title}` : `Vencida: ${task.title}`,
    html: layout(
      soon ? 'Una tarea está por vencer' : 'Una tarea está vencida',
      `<p style="font-size:14px;line-height:1.6">La tarea <strong>${esc(task.title)}</strong> ${soon ? 'vence en menos de 24 horas' : 'ya venció'}.</p><p style="font-size:14px;color:#71717a">Fecha límite: ${esc(when)}</p>`,
      { url: taskUrl(appUrl, task.id), text: 'Abrir tarea' },
    ),
  };
}

export function activatedEmail(appUrl: string, name: string) {
  return {
    subject: 'Tu cuenta de Acuérdalo fue aprobada',
    html: layout(
      '¡Bienvenido!',
      `<p style="font-size:14px;line-height:1.6">Hola ${esc(name)}, un administrador aprobó tu cuenta. Ya puedes iniciar sesión.</p>`,
      { url: `${appUrl.replace(/\/$/, '')}/login`, text: 'Iniciar sesión' },
    ),
  };
}

export function passwordResetEmail(appUrl: string, token: string, name: string) {
  return {
    subject: 'Restablece tu contraseña de Acuérdalo',
    html: layout(
      'Define una nueva contraseña',
      `<p style="font-size:14px;line-height:1.6">Hola ${esc(name)}, recibimos una solicitud para restablecer tu contraseña.</p><p style="font-size:13px;color:#71717a;line-height:1.6">El enlace sirve una sola vez y expira en 1 hora. Si no lo pediste, ignora este correo: tu contraseña no cambiará.</p>`,
      { url: `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`, text: 'Definir nueva contraseña' },
    ),
  };
}

export function noteAccessRequestEmail(appUrl: string, note: { id: string; title: string }, actorName: string) {
  return {
    subject: `${actorName} solicita acceso a: ${note.title}`,
    html: layout(
      'Solicitud de acceso a una nota',
      `<p style="font-size:14px;line-height:1.6">${esc(actorName)} solicita acceso a tu nota privada <strong>${esc(note.title)}</strong>. Ábrela para aprobar o rechazar la solicitud.</p>`,
      { url: noteUrl(appUrl, note.id), text: 'Abrir nota' },
    ),
  };
}

export function noteSharedEmail(appUrl: string, note: { id: string; title: string }, actorName: string, permission: 'view' | 'edit') {
  const what = permission === 'edit' ? 'editar' : 'ver';
  return {
    subject: `${actorName} te dio acceso a una nota: ${note.title}`,
    html: layout(
      'Te compartieron una nota',
      `<p style="font-size:14px;line-height:1.6">${esc(actorName)} te dio acceso para ${what} la nota <strong>${esc(note.title)}</strong>.</p>`,
      { url: noteUrl(appUrl, note.id), text: 'Abrir nota' },
    ),
  };
}

// ---- Calendario ----

export function eventUrl(appUrl: string, eventId: string) {
  return `${appUrl.replace(/\/$/, '')}/calendar?event=${eventId}`;
}

function detailRows(rows: [string, string][]): string {
  const body = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-size:13px;color:#71717a;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-size:14px">${esc(v)}</td></tr>`,
    )
    .join('');
  return `<table style="border-collapse:collapse;width:100%;margin-top:8px">${body}</table>`;
}

interface EventMailInfo {
  id: string;
  title: string;
  location: string;
  when: string;
  participantNames: string[];
}

export function eventInvitedEmail(appUrl: string, ev: EventMailInfo, actorName: string) {
  return {
    subject: `Invitación: ${ev.title}`,
    html: layout(
      'Te invitaron a un evento',
      `<p style="font-size:14px;line-height:1.6">${esc(actorName)} te invitó a <strong>${esc(ev.title)}</strong>.</p>${detailRows([
        ['Cuándo', ev.when],
        ['Lugar', ev.location],
        ['Participantes', ev.participantNames.join(', ')],
      ])}`,
      { url: eventUrl(appUrl, ev.id), text: 'Ver en el calendario' },
    ),
  };
}

export function eventChangedEmail(appUrl: string, ev: { id: string; title: string }, actorName: string, changes: Change[]) {
  const rows = changes
    .map(
      (c) =>
        `<tr><td style="padding:8px 12px 8px 0;vertical-align:top;font-size:13px;color:#71717a;white-space:nowrap">${esc(c.label)}</td><td style="padding:8px 0;font-size:14px"><div style="color:#71717a;text-decoration:line-through">${esc(c.from) || '—'}</div><div>${esc(c.to) || '—'}</div></td></tr>`,
    )
    .join('');
  return {
    subject: `Cambios en el evento: ${ev.title}`,
    html: layout(
      'Un evento ha cambiado',
      `<p style="font-size:14px;line-height:1.6">${esc(actorName)} actualizó <strong>${esc(ev.title)}</strong>:</p><table style="border-collapse:collapse;width:100%">${rows}</table>`,
      { url: eventUrl(appUrl, ev.id), text: 'Ver en el calendario' },
    ),
  };
}

export function eventCancelledEmail(appUrl: string, ev: { title: string; when: string }, actorName: string) {
  return {
    subject: `Evento cancelado: ${ev.title}`,
    html: layout(
      'Un evento fue cancelado',
      `<p style="font-size:14px;line-height:1.6">${esc(actorName)} canceló <strong>${esc(ev.title)}</strong>.</p>${detailRows([['Estaba previsto', ev.when]])}`,
      { url: `${appUrl.replace(/\/$/, '')}/calendar`, text: 'Abrir el calendario' },
    ),
  };
}

export function eventReminderEmail(appUrl: string, ev: EventMailInfo, minutesLabel: string) {
  return {
    subject: `Recordatorio: ${ev.title} empieza ${minutesLabel}`,
    html: layout(
      `Tu evento empieza ${minutesLabel}`,
      `<p style="font-size:14px;line-height:1.6"><strong>${esc(ev.title)}</strong></p>${detailRows([
        ['Cuándo', ev.when],
        ['Lugar', ev.location],
        ['Participantes', ev.participantNames.join(', ')],
      ])}`,
      { url: eventUrl(appUrl, ev.id), text: 'Ver en el calendario' },
    ),
  };
}

export interface WeeklySummarySection {
  heading: string;
  summary: UserSummary;
}

const SUMMARY_PRIORITIES: { key: string; label: string; color: string }[] = [
  { key: 'high', label: 'Alta', color: '#dc2626' },
  { key: 'medium', label: 'Media', color: '#d97706' },
  { key: 'low', label: 'Baja', color: '#71717a' },
];

function summaryBadge(text: string, bg: string, fg: string) {
  return `<span style="display:inline-block;margin-left:6px;padding:1px 8px;border-radius:10px;background:${bg};color:${fg};font-size:11px;font-weight:600">${esc(text)}</span>`;
}

function summaryTaskRow(appUrl: string, t: SummaryTask, kind: 'closed' | 'inProgress' | 'pending', timeZone: string) {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => new Date(d).toLocaleDateString('es-ES', { ...opts, timeZone });
  const notes: string[] = [];
  if (t.dueDate) notes.push(`Vence ${fmt(t.dueDate, { day: 'numeric', month: 'short', year: 'numeric' })}`);
  if (kind === 'inProgress') {
    if (t.startedLastWeek) notes.push('Iniciada la semana pasada');
    else if (t.startedAt) notes.push(`En progreso desde ${fmt(t.startedAt, { day: 'numeric', month: 'short' })}`);
  }
  let badge = '';
  if (t.overdue) badge = summaryBadge('⚠ Vencida', '#fee2e2', '#b91c1c');
  else if (t.dueThisWeek) badge = summaryBadge('⚠ Vence esta semana', '#fef3c7', '#92400e');
  return `<li style="margin:0 0 6px"><a href="${esc(taskUrl(appUrl, t.id))}" style="color:#18181b;text-decoration:none;font-weight:500">${esc(t.title)}</a>${badge}${
    notes.length ? `<div style="font-size:12px;color:#71717a">${esc(notes.join(' · '))}</div>` : ''
  }</li>`;
}

function summaryBlock(appUrl: string, title: string, tasks: SummaryTask[], kind: 'closed' | 'inProgress' | 'pending', timeZone: string) {
  if (tasks.length === 0) return '';
  const head = `<h3 style="font-size:14px;margin:16px 0 6px">${esc(title)} (${tasks.length})</h3>`;
  const list = (items: SummaryTask[]) =>
    `<ul style="margin:0 0 8px;padding-left:20px;font-size:14px;line-height:1.5">${items.map((t) => summaryTaskRow(appUrl, t, kind, timeZone)).join('')}</ul>`;
  if (kind === 'closed') return head + list(tasks);
  const groups = SUMMARY_PRIORITIES.map((p) => {
    const items = tasks.filter((t) => t.priority === p.key);
    if (items.length === 0) return '';
    return `<div style="font-size:12px;font-weight:600;color:${p.color};margin:8px 0 4px">Prioridad ${p.label}</div>${list(items)}`;
  }).join('');
  return head + groups;
}

export function weeklySummaryEmail(
  appUrl: string,
  data: { name: string; sections: WeeklySummarySection[]; periodLabel: string; timeZone: string },
) {
  const body = data.sections
    .map(({ heading, summary: s }) => {
      const c = s.counts;
      const totals = `${c.closed} cerradas · ${c.startedLastWeek} iniciadas la semana pasada · ${c.inProgress} en progreso · ${c.pending} pendientes · ${c.dueThisWeek} vencen esta semana`;
      const blocks =
        summaryBlock(appUrl, 'Cerradas la semana pasada', s.closed, 'closed', data.timeZone) +
        summaryBlock(appUrl, 'En progreso', s.inProgress, 'inProgress', data.timeZone) +
        summaryBlock(appUrl, 'Pendientes (sin iniciar)', s.pending, 'pending', data.timeZone) ||
        '<p style="font-size:14px;color:#71717a">Sin tareas.</p>';
      return `<div style="margin:0 0 24px"><h2 style="font-size:16px;margin:0 0 4px;padding-top:8px;border-top:1px solid #e4e4e7">${esc(heading)}</h2><p style="font-size:13px;color:#71717a;margin:0">${esc(totals)}</p>${blocks}</div>`;
    })
    .join('');
  return {
    subject: `Resumen semanal de tareas — semana del ${data.periodLabel}`,
    html: layout(
      `Resumen semanal, ${data.name}`,
      `<p style="font-size:14px;line-height:1.6">Así está el panorama de tareas para la semana del ${esc(data.periodLabel)}.</p>${body}`,
      { url: appUrl.replace(/\/$/, '') + '/', text: 'Abrir el tablero' },
    ),
  };
}
