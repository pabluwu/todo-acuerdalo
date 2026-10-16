import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { buildIcs, IcsMethod, parseAddress } from '../mail/ics';
import { MailService } from '../mail/mail.service';
import {
  activatedEmail, assignedEmail, changedEmail, dueEmail,
  eventCancelledEmail, eventChangedEmail, eventInvitedEmail, eventReminderEmail,
} from '../mail/templates';
import {
  computeEventRecipients, detectEventChanges, EventSnapshot, formatEventWhen, snapshotFromPayload,
} from '../events/event-changes';
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
export interface TaskDueEvent {
  task: { id: string; title: string; dueDate: Date; assignees: U[] };
  kind: 'due_soon' | 'overdue';
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
  ) {
    this.appUrl = config.get('APP_URL', 'http://localhost:3000');
    this.timeZone = config.get('APP_TIMEZONE', 'America/Santiago');
    this.organizer = parseAddress(config.get('SMTP_FROM', ''), config.get('SMTP_USER') || 'no-reply@acuerdalo.local');
    this.uidDomain = new URL(this.appUrl).hostname;
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
      for (const u of e.newAssignees) {
        if (!u.isActive) continue;
        await this.mail.send(u.email, subject, html);
      }
    } catch (err) {
      this.logger.error(`task.assigned: ${(err as Error).message}`);
    }
  }

  @OnEvent('task.changed', { async: true })
  async onChanged(e: TaskChangedEvent) {
    try {
      const admins = await this.users.find({ where: { role: 'admin', isActive: true } });
      const recipients = computeRecipients(e.task.assignees, admins, e.excludeUserIds ?? []);
      const { subject, html } = changedEmail(this.appUrl, e.task, e.actor.name, e.changes);
      for (const u of recipients) await this.mail.send(u.email, subject, html);
    } catch (err) {
      this.logger.error(`task.changed: ${(err as Error).message}`);
    }
  }

  @OnEvent('task.due', { async: true })
  async onDue(e: TaskDueEvent) {
    try {
      const { subject, html } = dueEmail(this.appUrl, e.task, e.kind, new Date(e.task.dueDate));
      for (const u of e.task.assignees) {
        if (u.isActive) await this.mail.send(u.email, subject, html);
      }
    } catch (err) {
      this.logger.error(`task.due: ${(err as Error).message}`);
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
      for (const u of e.newParticipants) {
        if (!u.isActive) continue;
        await this.mail.send(u.email, subject, html, invite);
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
      const invite = this.invite(e.event, 'REQUEST');
      for (const u of recipients) await this.mail.send(u.email, subject, html, invite);
    } catch (err) {
      this.logger.error(`event.changed: ${(err as Error).message}`);
    }
  }

  @OnEvent('event.cancelled', { async: true })
  async onEventCancelled(e: EventCancelledEvent) {
    try {
      const recipients = computeEventRecipients(e.event.participants, e.event.createdBy);
      const { subject, html } = eventCancelledEmail(this.appUrl, this.mailInfo(e.event), e.actor.name);
      const invite = this.invite(e.event, 'CANCEL');
      for (const u of recipients) await this.mail.send(u.email, subject, html, invite);
    } catch (err) {
      this.logger.error(`event.cancelled: ${(err as Error).message}`);
    }
  }

  @OnEvent('event.reminder', { async: true })
  async onEventReminder(e: EventReminderEvent) {
    try {
      const recipients = computeEventRecipients(e.event.participants, e.event.createdBy);
      const { subject, html } = eventReminderEmail(this.appUrl, this.mailInfo(e.event), reminderLabel(e.minutes));
      const invite = this.invite(e.event, 'REQUEST');
      for (const u of recipients) await this.mail.send(u.email, subject, html, invite);
    } catch (err) {
      this.logger.error(`event.reminder: ${(err as Error).message}`);
    }
  }

  @OnEvent('user.activated', { async: true })
  async onUserActivated(e: { user: { name: string; email: string } }) {
    try {
      const { subject, html } = activatedEmail(this.appUrl, e.user.name);
      await this.mail.send(e.user.email, subject, html);
    } catch (err) {
      this.logger.error(`user.activated: ${(err as Error).message}`);
    }
  }
}
