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
import { User } from '../entities/user.entity';
import { WeeklySummarySection } from '../mail/templates';
import { notificationPayload } from '../events/events.service';
import { buildUserSummary, isSummaryEmpty, weekBounds } from './weekly-summary';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Task) private tasks: Repository<Task>,
    @InjectRepository(User) private users: Repository<User>,
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

    const weeklyExpr = this.config.get('WEEKLY_SUMMARY_CRON', '0 9 * * 1');
    const timeZone = this.config.get('APP_TIMEZONE', 'America/Santiago');
    const weekly = CronJob.from({
      cronTime: weeklyExpr,
      timeZone,
      onTick: () => {
        this.runWeeklySummary().catch((e) => this.logger.error(`Error en el resumen semanal: ${e.message}`));
      },
    });
    this.registry.addCronJob('weekly-summary', weekly);
    weekly.start();
    this.logger.log(`Resumen semanal programado con cron "${weeklyExpr}" (${timeZone})`);
  }

  /** Arma y envía el resumen semanal: cada usuario el suyo; los admins además el del equipo. */
  async runWeeklySummary(now = new Date()) {
    const timeZone = this.config.get('APP_TIMEZONE', 'America/Santiago');
    const bounds = weekBounds(now, timeZone);
    const users = await this.users.find({ where: { isActive: true }, order: { name: 'ASC' } });
    const tasks = await this.tasks
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignees', 'assignee')
      .where('task.status <> :done', { done: 'completed' })
      .orWhere('task.status = :done AND task.completed_at >= :from AND task.completed_at < :to', {
        done: 'completed', from: bounds.prevStart, to: bounds.thisStart,
      })
      .getMany();

    const summaries = new Map(users.map((u) => [u.id, buildUserSummary(u.id, tasks, bounds, now)]));
    const unassigned = buildUserSummary(null, tasks, bounds, now);
    const recipients: { user: { id: string; name: string; email: string; isActive: boolean }; sections: WeeklySummarySection[] }[] = [];
    for (const u of users) {
      const own = summaries.get(u.id)!;
      const sections: WeeklySummarySection[] = [{ heading: u.role === 'admin' ? 'Tu resumen' : 'Tus tareas', summary: own }];
      let teamHasContent = false;
      if (u.role === 'admin') {
        const team: WeeklySummarySection[] = [];
        for (const other of users) {
          if (other.id === u.id || isSummaryEmpty(summaries.get(other.id)!)) continue;
          team.push({ heading: other.name, summary: summaries.get(other.id)! });
        }
        if (!isSummaryEmpty(unassigned)) team.push({ heading: 'Sin asignar', summary: unassigned });
        teamHasContent = team.length > 0;
        sections.push(...team);
      }
      if (isSummaryEmpty(own) && !teamHasContent) continue;
      recipients.push({ user: { id: u.id, name: u.name, email: u.email, isActive: u.isActive }, sections });
    }

    const periodLabel = bounds.thisStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone });
    this.events.emit('task.weekly_summary', { periodLabel, recipients });
    const emails = recipients.map((r) => r.user.email);
    await this.audit.log(null, 'task.weekly_summary', 'task', null, null, { periodLabel, recipients: emails });
    return { recipients: emails.length, emails };
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
