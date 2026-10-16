import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob } from 'cron';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Between, In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CalendarEvent } from '../entities/event.entity';
import { Task } from '../entities/task.entity';
import { notificationPayload } from '../events/events.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Task) private tasks: Repository<Task>,
    @InjectRepository(CalendarEvent) private calendarEvents: Repository<CalendarEvent>,
    private events: EventEmitter2,
    private audit: AuditService,
    private registry: SchedulerRegistry,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    const expr = this.config.get('DUE_ALERT_CRON', '0 * * * *');
    const job = new CronJob(expr, () => {
      this.runDueAlerts().catch((e) => this.logger.error(`Error en alertas de vencimiento: ${e.message}`));
    });
    this.registry.addCronJob('due-alerts', job);
    job.start();
    this.logger.log(`Alertas de vencimiento programadas con cron "${expr}"`);
  }

  async runDueAlerts(now = new Date()) {
    const soon = new Date(now.getTime() + 24 * 3600 * 1000);
    const notCompleted = Not(In(['completed']));

    const overdue = await this.tasks.find({
      where: { status: notCompleted, dueDate: LessThan(now), overdueNotifiedAt: IsNull() },
    });
    for (const t of overdue) await this.notify(t, 'overdue', now);

    const dueSoon = await this.tasks.find({
      where: { status: notCompleted, dueDate: Between(now, soon), dueSoonNotifiedAt: IsNull() },
    });
    for (const t of dueSoon) await this.notify(t, 'due_soon', now);
    return { overdue: overdue.length, dueSoon: dueSoon.length };
  }

  /** Cada minuto: envía una sola vez el recordatorio de los eventos que están por empezar. */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'event-reminders' })
  async tickReminders() {
    try {
      await this.runEventReminders();
    } catch (e) {
      this.logger.error(`Error en recordatorios de eventos: ${(e as Error).message}`);
    }
  }

  async runEventReminders(now = new Date()) {
    const due = await this.calendarEvents
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.participants', 'p')
      .leftJoinAndSelect('e.createdBy', 'cb')
      .where('e.reminder_minutes IS NOT NULL')
      .andWhere('e.reminder_sent_at IS NULL')
      .andWhere('e.start_at > :now', { now })
      .andWhere(`e.start_at - (e.reminder_minutes * interval '1 minute') <= :now`, { now })
      .getMany();
    let sent = 0;
    for (const ev of due) {
      // reclamo atómico: si otra ejecución ya lo marcó, no se vuelve a enviar
      const claim = await this.calendarEvents
        .createQueryBuilder()
        .update(CalendarEvent)
        .set({ reminderSentAt: now })
        .where('id = :id AND reminder_sent_at IS NULL', { id: ev.id })
        .execute();
      if (!claim.affected) continue;
      sent++;
      const payload = notificationPayload(ev);
      this.events.emit('event.reminder', { event: payload, minutes: ev.reminderMinutes });
      await this.audit.log(null, 'event.reminder', 'event', ev.id, null, {
        startAt: payload.startAt,
        reminderMinutes: ev.reminderMinutes,
        recipients: [...payload.participants, ...(payload.createdBy ? [payload.createdBy] : [])].map((u) => u.email),
      });
    }
    return { sent };
  }

  private async notify(t: Task, kind: 'due_soon' | 'overdue', now: Date) {
    const patch = kind === 'overdue' ? { overdueNotifiedAt: now, dueSoonNotifiedAt: t.dueSoonNotifiedAt ?? now } : { dueSoonNotifiedAt: now };
    await this.tasks.update(t.id, patch);
    this.events.emit('task.due', {
      task: {
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        assignees: t.assignees.map((u) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive })),
      },
      kind,
    });
    await this.audit.log(null, kind === 'overdue' ? 'task.overdue_alert' : 'task.due_soon_alert', 'task', t.id, null, {
      dueDate: t.dueDate,
      recipients: t.assignees.map((u) => u.email),
    });
  }
}
