import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { buildIcs, IcsMethod, parseAddress } from '../mail/ics';
import { CalendarInvite, MailService } from '../mail/mail.service';
import {
  activatedEmail, assignedEmail, changedEmail, dueEmail,
  eventCancelledEmail, eventChangedEmail, eventInvitedEmail, eventReminderEmail, mentionEmail, noteAccessRequestEmail, noteSharedEmail, passwordResetEmail, publicationEmail, weeklySummaryEmail, WeeklySummarySection,
} from '../mail/templates';
import {
  computeEventRecipients, detectEventChanges, EventSnapshot, formatEventWhen, snapshotFromPayload,
} from '../events/event-changes';
import { PushService } from '../push/push.service';
import { Change, computeRecipients } from '../tasks/task-changes';

type U = { id: string; name: string; email: string; isActive: boolean };

export interface TaskAssignedEvent {
  task: { id: string; title: string };
  actor: { id: string; name: string };
  newAssignees: U[];
}
export interface TaskChangedEvent {
  task: { id: string; title: string; assignees: U[] };
  actor: { id: string; name: string };
  changes: Change[];
  excludeUserIds?: string[];
}
export interface TaskMentionedEvent {
  task: { id: string; title: string };
  actor: { id: string; name: string };
  comment: { body: string; attachmentNames: string[] };
  users: U[];
}
export interface TaskDueEvent {
  task: { id: string; title: string; dueDate: Date; assignees: U[] };
  kind: 'due_soon' | 'overdue';
}

export interface TaskWeeklySummaryEvent {
  periodLabel: string;
  recipients: { user: U; sections: WeeklySummarySection[] }[];
}

/** Datos de un evento para los correos: solo usuarios internos, nunca contactos externos. */
export interface EventInfo {
  id: string;
  title: string;
  description?: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  participants: U[];
  createdBy: U | null;
}
export interface EventInvitedEvent { event: EventInfo; actor: { id: string; name: string }; newParticipants: U[] }
export interface EventChangedEvent { event: EventInfo; before: EventSnapshot; actor: { id: string; name: string }; excludeUserIds?: string[] }
export interface EventCancelledEvent { event: EventInfo; actor: { id: string; name: string } }
export interface EventReminderEvent { event: EventInfo; minutes: number }

export interface NoteSharedEvent {
  note: { id: string; title: string };
  actor: { id: string; name: string };
  user: U;
  permission: 'view' | 'edit';
}
export interface NoteAccessRequestedEvent {
  note: { id: string; title: string };
  actor: { id: string; name: string };
  owner: U;
}

/** Aviso de una publicación: quién lo origina, a quiénes llega y un detalle (versión, estado o comentario). */
export interface PublicationNotifyEvent {
  publication: { id: string; title: string };
  actor: { id: string; name: string };
  recipientIds: string[];
  detail?: string;
}

/** Resumen corto de los cambios para el cuerpo del push: etiquetas de los campos modificados. */
export function changesSummary(changes: Change[]): string {
  const labels = [...new Set(changes.map((c) => c.label))];
  return labels.length > 3 ? `${labels.slice(0, 3).join(', ')} y más` : labels.join(', ');
}

export function reminderLabel(minutes: number): string {
  if (minutes >= 1440) return 'mañana';
  if (minutes >= 60) return minutes === 60 ? 'en 1 hora' : `en ${minutes / 60} horas`;
  return `en ${minutes} minutos`;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private appUrl: string;
  private timeZone: string;
  private organizer: { name: string; email: string };
  private uidDomain: string;

  constructor(
    private mail: MailService,
    config: ConfigService,
    @InjectRepository(User) private users: Repository<User>,
    private push: PushService,
  ) {
    this.appUrl = config.get('APP_URL', 'http://localhost:3000');
    this.timeZone = config.get('APP_TIMEZONE', 'America/Santiago');
    this.organizer = parseAddress(config.get('SMTP_FROM', ''), config.get('SMTP_USER') || 'no-reply@acuerdalo.local');
    this.uidDomain = new URL(this.appUrl).hostname;
  }

  /** Envía al usuario y, en copia (CC), a los correos que él o un admin configuró. */
  private async sendTo(u: Pick<U, 'id' | 'email'>, subject: string, html: string, invite?: CalendarInvite) {
    const row = await this.users.findOne({ where: { id: u.id }, select: { id: true, copyEmails: true } });
    return this.mail.send(u.email, subject, html, invite, row?.copyEmails ?? []);
  }

  /** Invitación .ics del evento: solo usuarios internos como asistentes, nunca externos. */
  private invite(e: EventInfo, method: IcsMethod) {
    const attendees = new Map<string, { name: string; email: string }>();
    for (const u of [...e.participants, ...(e.createdBy ? [e.createdBy] : [])]) {
      if (u.isActive) attendees.set(u.id, { name: u.name, email: u.email });
    }
    const content = buildIcs(
      {
        uid: `${e.id}@${this.uidDomain}`,
        title: e.title,
        description: e.description,
        location: e.location,
        startAt: e.startAt,
        endAt: e.endAt,
        allDay: e.allDay,
        url: `${this.appUrl.replace(/\/$/, '')}/calendar?event=${e.id}`,
        organizer: this.organizer,
        attendees: [...attendees.values()],
      },
      method,
    );
    return { method, content };
  }

  @OnEvent('task.assigned', { async: true })
  async onAssigned(e: TaskAssignedEvent) {
    try {
      const { subject, html } = assignedEmail(this.appUrl, e.task, e.actor.name);
      void this.push.sendToUsers(e.newAssignees.filter((u) => u.isActive).map((u) => u.id), {
        title: 'Se te asignó una tarea', body: `${e.actor.name}: ${e.task.title}`, url: `/tasks/${e.task.id}`,
      });
      for (const u of e.newAssignees) {
        if (!u.isActive) continue;
        await this.sendTo(u, subject, html);
      }
    } catch (err) {
      this.logger.error(`task.assigned: ${(err as Error).message}`);
    }
  }

  @OnEvent('task.mentioned', { async: true })
  async onMentioned(e: TaskMentionedEvent) {
    try {
      const { subject, html } = mentionEmail(this.appUrl, e.task, e.actor.name, e.comment);
      void this.push.sendToUsers(e.users.filter((u) => u.isActive).map((u) => u.id), {
        title: `${e.actor.name} te mencionó`, body: e.task.title, url: `/tasks/${e.task.id}`,
      });
      for (const u of e.users) {
        if (!u.isActive) continue;
        await this.sendTo(u, subject, html);
      }
    } catch (err) {
      this.logger.error(`task.mentioned: ${(err as Error).message}`);
    }
  }

  @OnEvent('task.changed', { async: true })
  async onChanged(e: TaskChangedEvent) {
    try {
      const admins = await this.users.find({ where: { role: 'admin', isActive: true } });
      const recipients = computeRecipients(e.task.assignees, admins, e.excludeUserIds ?? []);
      const { subject, html } = changedEmail(this.appUrl, e.task, e.actor.name, e.changes);
      void this.push.sendToUsers(recipients.map((u) => u.id), {
        title: `Cambios en: ${e.task.title}`, body: `${e.actor.name} modificó ${changesSummary(e.changes)}`, url: `/tasks/${e.task.id}`,
      });
      for (const u of recipients) await this.sendTo(u, subject, html);
    } catch (err) {
      this.logger.error(`task.changed: ${(err as Error).message}`);
    }
  }

  @OnEvent('task.due', { async: true })
  async onDue(e: TaskDueEvent) {
    try {
      const { subject, html } = dueEmail(this.appUrl, e.task, e.kind, new Date(e.task.dueDate));
      void this.push.sendToUsers(e.task.assignees.filter((u) => u.isActive).map((u) => u.id), {
        title: e.kind === 'due_soon' ? 'Tarea por vencer' : 'Tarea vencida', body: e.task.title, url: `/tasks/${e.task.id}`,
      });
      for (const u of e.task.assignees) {
        if (u.isActive) await this.sendTo(u, subject, html);
      }
    } catch (err) {
      this.logger.error(`task.due: ${(err as Error).message}`);
    }
  }

  @OnEvent('task.weekly_summary', { async: true })
  async onWeeklySummary(e: TaskWeeklySummaryEvent) {
    for (const r of e.recipients) {
      try {
        const { subject, html } = weeklySummaryEmail(this.appUrl, {
          name: r.user.name, sections: r.sections, periodLabel: e.periodLabel, timeZone: this.timeZone,
        });
        await this.sendTo(r.user, subject, html);
      } catch (err) {
        this.logger.error(`task.weekly_summary (${r.user.email}): ${(err as Error).message}`);
      }
    }
  }

  private mailInfo(e: EventInfo) {
    return {
      id: e.id,
      title: e.title,
      location: e.location,
      when: formatEventWhen(e.startAt, e.endAt, e.allDay, this.timeZone),
      participantNames: e.participants.map((p) => p.name),
    };
  }

  @OnEvent('event.invited', { async: true })
  async onEventInvited(e: EventInvitedEvent) {
    try {
      const { subject, html } = eventInvitedEmail(this.appUrl, this.mailInfo(e.event), e.actor.name);
      const invite = this.invite(e.event, 'REQUEST');
      void this.push.sendToUsers(e.newParticipants.filter((u) => u.isActive).map((u) => u.id), {
        title: 'Te invitaron a un evento', body: `${e.event.title} · ${this.mailInfo(e.event).when}`, url: `/calendar?event=${e.event.id}`,
      });
      for (const u of e.newParticipants) {
        if (!u.isActive) continue;
        await this.sendTo(u, subject, html, invite);
      }
    } catch (err) {
      this.logger.error(`event.invited: ${(err as Error).message}`);
    }
  }

  @OnEvent('event.changed', { async: true })
  async onEventChanged(e: EventChangedEvent) {
    try {
      const changes = detectEventChanges(e.before, snapshotFromPayload(e.event), this.timeZone);
      if (changes.length === 0) return;
      const recipients = computeEventRecipients(e.event.participants, e.event.createdBy, e.excludeUserIds ?? []);
      const { subject, html } = eventChangedEmail(this.appUrl, e.event, e.actor.name, changes);
      void this.push.sendToUsers(recipients.map((u) => u.id), {
        title: `Cambios en el evento: ${e.event.title}`, body: `${e.actor.name} modificó ${changesSummary(changes)}`, url: `/calendar?event=${e.event.id}`,
      });
      const invite = this.invite(e.event, 'REQUEST');
      for (const u of recipients) await this.sendTo(u, subject, html, invite);
    } catch (err) {
      this.logger.error(`event.changed: ${(err as Error).message}`);
    }
  }

  @OnEvent('event.cancelled', { async: true })
  async onEventCancelled(e: EventCancelledEvent) {
    try {
      const recipients = computeEventRecipients(e.event.participants, e.event.createdBy);
      const { subject, html } = eventCancelledEmail(this.appUrl, this.mailInfo(e.event), e.actor.name);
      void this.push.sendToUsers(recipients.map((u) => u.id), {
        title: 'Evento cancelado', body: `${e.actor.name} canceló ${e.event.title}`, url: '/calendar',
      });
      const invite = this.invite(e.event, 'CANCEL');
      for (const u of recipients) await this.sendTo(u, subject, html, invite);
    } catch (err) {
      this.logger.error(`event.cancelled: ${(err as Error).message}`);
    }
  }

  @OnEvent('event.reminder', { async: true })
  async onEventReminder(e: EventReminderEvent) {
    try {
      const recipients = computeEventRecipients(e.event.participants, e.event.createdBy);
      const { subject, html } = eventReminderEmail(this.appUrl, this.mailInfo(e.event), reminderLabel(e.minutes));
      void this.push.sendToUsers(recipients.map((u) => u.id), {
        title: `Recordatorio: ${e.event.title}`, body: `Empieza ${reminderLabel(e.minutes)}`, url: `/calendar?event=${e.event.id}`,
      });
      const invite = this.invite(e.event, 'REQUEST');
      for (const u of recipients) await this.sendTo(u, subject, html, invite);
    } catch (err) {
      this.logger.error(`event.reminder: ${(err as Error).message}`);
    }
  }

  @OnEvent('user.activated', { async: true })
  async onUserActivated(e: { user: { id: string; name: string; email: string } }) {
    try {
      const { subject, html } = activatedEmail(this.appUrl, e.user.name);
      await this.sendTo(e.user, subject, html);
    } catch (err) {
      this.logger.error(`user.activated: ${(err as Error).message}`);
    }
  }

  @OnEvent('note.access_requested', { async: true })
  async onNoteAccessRequested(e: NoteAccessRequestedEvent) {
    try {
      if (!e.owner.isActive) return;
      const { subject, html } = noteAccessRequestEmail(this.appUrl, e.note, e.actor.name);
      void this.push.sendToUsers([e.owner.id], {
        title: 'Solicitud de acceso a una nota', body: `${e.actor.name} solicita acceso a ${e.note.title}`, url: `/notes/${e.note.id}`,
      });
      await this.sendTo(e.owner, subject, html);
    } catch (err) {
      this.logger.error(`note.access_requested: ${(err as Error).message}`);
    }
  }

  /** Al compartir y al aprobar una solicitud: el invitado recibe el mismo aviso. */
  @OnEvent('note.shared', { async: true })
  @OnEvent('note.access_granted', { async: true })
  async onNoteShared(e: NoteSharedEvent) {
    try {
      if (!e.user.isActive) return;
      const { subject, html } = noteSharedEmail(this.appUrl, e.note, e.actor.name, e.permission);
      void this.push.sendToUsers([e.user.id], {
        title: 'Te dieron acceso a una nota', body: `${e.actor.name}: ${e.note.title}`, url: `/notes/${e.note.id}`,
      });
      await this.sendTo(e.user, subject, html);
    } catch (err) {
      this.logger.error(`note.shared: ${(err as Error).message}`);
    }
  }

  private async notifyPublication(
    kind: 'version_uploaded' | 'changes_requested' | 'approved' | 'mentioned' | 'status_changed',
    e: PublicationNotifyEvent,
    push: { title: string; body: string },
  ) {
    try {
      const ids = [...new Set(e.recipientIds)].filter((id) => id !== e.actor.id);
      if (ids.length === 0) return;
      const recipients = await this.users.find({ where: { id: In(ids), isActive: true } });
      if (recipients.length === 0) return;
      const { subject, html } = publicationEmail(this.appUrl, kind, e.publication, e.actor.name, e.detail);
      void this.push.sendToUsers(recipients.map((u) => u.id), { ...push, url: `/publicaciones/${e.publication.id}` });
      for (const u of recipients) await this.sendTo(u, subject, html);
    } catch (err) {
      this.logger.error(`publication.${kind}: ${(err as Error).message}`);
    }
  }

  @OnEvent('publication.version_uploaded', { async: true })
  onPublicationVersionUploaded(e: PublicationNotifyEvent) {
    return this.notifyPublication('version_uploaded', e, {
      title: 'Nueva versión para revisar', body: `${e.actor.name}: ${e.publication.title} ${e.detail ?? ''}`.trim(),
    });
  }

  @OnEvent('publication.changes_requested', { async: true })
  onPublicationChangesRequested(e: PublicationNotifyEvent) {
    return this.notifyPublication('changes_requested', e, {
      title: 'Piden cambios', body: `${e.actor.name} en ${e.publication.title}`,
    });
  }

  @OnEvent('publication.approved', { async: true })
  onPublicationApproved(e: PublicationNotifyEvent) {
    return this.notifyPublication('approved', e, {
      title: 'Lista para publicar', body: `${e.publication.title} fue aprobada por todos`,
    });
  }

  @OnEvent('publication.mentioned', { async: true })
  onPublicationMentioned(e: PublicationNotifyEvent) {
    return this.notifyPublication('mentioned', e, {
      title: `${e.actor.name} te mencionó`, body: e.publication.title,
    });
  }

  @OnEvent('publication.status_changed', { async: true })
  onPublicationStatusChanged(e: PublicationNotifyEvent) {
    return this.notifyPublication('status_changed', e, {
      title: `${e.publication.title}: ${e.detail ?? 'cambio de estado'}`, body: `${e.actor.name} cambió el estado`,
    });
  }

  /** Sin CC: el enlace es sensible y solo debe llegar al correo de la cuenta. */
  @OnEvent('auth.password_reset_requested', { async: true })
  async onPasswordResetRequested(e: { user: { id: string; name: string; email: string }; token: string }) {
    try {
      const { subject, html } = passwordResetEmail(this.appUrl, e.token, e.user.name);
      const sent = await this.mail.send(e.user.email, subject, html);
      if (!sent) this.logger.warn(`auth.password_reset_requested: no se pudo enviar el enlace a ${e.user.email}`);
    } catch (err) {
      this.logger.error(`auth.password_reset_requested: ${(err as Error).message}`);
    }
  }
}
