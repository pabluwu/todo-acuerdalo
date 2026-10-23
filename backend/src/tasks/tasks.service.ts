import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators';
import { Comment } from '../entities/comment.entity';
import { TaskType } from '../entities/task-type.entity';
import { Task, TaskPriority, TaskStatus } from '../entities/task.entity';
import { User } from '../entities/user.entity';
import { CreateTaskDto, MoveTaskDto, TaskQueryDto, UpdateTaskDto } from './tasks.dto';
import { applyStatusDates, detectChanges, newlyAssigned, snapshotTask } from './task-changes';

function parseDate(v: string | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) throw new BadRequestException('Fecha límite inválida');
  return d;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private tasks: Repository<Task>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(TaskType) private types: Repository<TaskType>,
    @InjectRepository(Comment) private comments: Repository<Comment>,
    private audit: AuditService,
    private events: EventEmitter2,
    private config: ConfigService,
  ) {}

  async list(q: TaskQueryDto) {
    const qb = this.tasks
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignees', 'assignee')
      .leftJoinAndSelect('task.type', 'type')
      .leftJoinAndSelect('task.createdBy', 'createdBy');
    if (q.assigneeId)
      qb.andWhere('task.id IN (SELECT ta.task_id FROM task_assignees ta WHERE ta.user_id = :aid)', { aid: q.assigneeId });
    if (q.priority) qb.andWhere('task.priority = :p', { p: q.priority });
    if (q.typeId) qb.andWhere('task.type_id = :t', { t: q.typeId });
    qb.orderBy('task.position', 'ASC').addOrderBy('task.createdAt', 'DESC');
    const rows = await qb.getMany();
    return rows.map((t) => this.present(t));
  }

  async get(id: string) {
    return this.present(await this.getOrFail(id));
  }

  async getOrFail(id: string): Promise<Task> {
    const task = await this.tasks.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    return task;
  }

  present(t: Task) {
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      type: t.type ? { id: t.type.id, name: t.type.name, isActive: t.type.isActive } : null,
      dueDate: t.dueDate,
      position: t.position,
      createdBy: t.createdBy ? { id: t.createdBy.id, name: t.createdBy.name } : null,
      assignees: (t.assignees ?? []).map((u) => ({ id: u.id, name: u.name, email: u.email })),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private async loadAssignees(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const users = await this.users.find({ where: { id: In([...new Set(ids)]), isActive: true } });
    if (users.length !== new Set(ids).size) throw new BadRequestException('Algún usuario asignado no existe o no está activo');
    return users;
  }

  private async loadType(id: string, mustBeActive = true): Promise<TaskType> {
    const type = await this.types.findOne({ where: { id } });
    if (!type || (mustBeActive && !type.isActive)) throw new BadRequestException('Tipo de tarea inválido');
    return type;
  }

  private async nextPosition(status: string): Promise<number> {
    const row = await this.tasks
      .createQueryBuilder('t')
      .select('COALESCE(MAX(t.position), -1) + 1', 'next')
      .where('t.status = :status', { status })
      .getRawOne();
    return Number(row?.next ?? 0);
  }

  async create(dto: CreateTaskDto, actor: AuthUser) {
    const type = await this.loadType(dto.typeId);
    const assignees = await this.loadAssignees(dto.assigneeIds ?? []);
    const status = (dto.status ?? 'not_started') as TaskStatus;
    const dates = { startedAt: null as Date | null, completedAt: null as Date | null };
    applyStatusDates(dates, status, new Date());
    const created = await this.tasks.save(
      this.tasks.create({
        ...dates,
        title: dto.title.trim(),
        description: dto.description ?? '',
        status,
        priority: (dto.priority ?? 'medium') as TaskPriority,
        type,
        typeId: type.id,
        dueDate: parseDate(dto.dueDate),
        position: await this.nextPosition(status),
        createdBy: { id: actor.id } as User,
        createdById: actor.id,
        assignees,
      }),
    );
    const task = await this.getOrFail(created.id);
    const presented = this.present(task);
    await this.audit.log(actor, 'task.create', 'task', task.id, null, presented);
    if (assignees.length > 0) {
      this.events.emit('task.assigned', {
        task: { id: task.id, title: task.title },
        actor: { id: actor.id, name: actor.name },
        newAssignees: assignees.map((u) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive })),
      });
    }
    return presented;
  }

  async update(id: string, dto: UpdateTaskDto, actor: AuthUser) {
    const task = await this.getOrFail(id);
    const before = snapshotTask(task);
    const beforePresented = this.present(task);

    if (dto.title !== undefined) task.title = dto.title.trim();
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.priority !== undefined) task.priority = dto.priority as TaskPriority;
    if (dto.typeId !== undefined && dto.typeId !== task.typeId) {
      const type = await this.loadType(dto.typeId);
      task.type = type;
      task.typeId = type.id;
    }
    if (dto.dueDate !== undefined) {
      const newDue = parseDate(dto.dueDate);
      const oldTime = task.dueDate ? new Date(task.dueDate).getTime() : null;
      if ((newDue ? newDue.getTime() : null) !== oldTime) {
        task.dueDate = newDue;
        task.dueSoonNotifiedAt = null;
        task.overdueNotifiedAt = null;
      }
    }
    if (dto.status !== undefined && dto.status !== task.status) {
      applyStatusDates(task, dto.status, new Date());
      task.status = dto.status as TaskStatus;
      task.position = await this.nextPosition(dto.status);
    }
    if (dto.assigneeIds !== undefined) task.assignees = await this.loadAssignees(dto.assigneeIds);

    await this.tasks.save(task);
    const updated = await this.getOrFail(id);
    const after = snapshotTask(updated);
    const changes = detectChanges(before, after);
    const added = newlyAssigned(before, updated.assignees);
    const presented = this.present(updated);

    await this.audit.log(actor, 'task.update', 'task', id, beforePresented, presented);
    this.emitChanges(updated, actor, changes, added);
    return presented;
  }

  async move(id: string, dto: MoveTaskDto, actor: AuthUser) {
    const task = await this.getOrFail(id);
    const before = snapshotTask(task);
    const beforePresented = this.present(task);

    const column = await this.tasks.find({
      where: { status: dto.status as TaskStatus },
      order: { position: 'ASC', createdAt: 'DESC' },
    });
    const others = column.filter((t) => t.id !== id);
    let index = Math.min(dto.position, others.length);
    if (dto.beforeId) {
      const i = others.findIndex((t) => t.id === dto.beforeId);
      if (i >= 0) index = i;
    }
    const statusChanged = task.status !== dto.status;
    if (statusChanged) applyStatusDates(task, dto.status, new Date());
    task.status = dto.status as TaskStatus;
    others.splice(index, 0, task);
    for (let i = 0; i < others.length; i++) {
      if (others[i].id === id) continue;
      if (others[i].position !== i) await this.tasks.update(others[i].id, { position: i });
    }
    await this.tasks.update(
      id,
      statusChanged
        ? { status: task.status, position: index, startedAt: task.startedAt, completedAt: task.completedAt }
        : { status: task.status, position: index },
    );

    const updated = await this.getOrFail(id);
    const changes = detectChanges(before, snapshotTask(updated));
    const presented = this.present(updated);
    await this.audit.log(actor, 'task.move', 'task', id, beforePresented, presented);
    this.emitChanges(updated, actor, changes, []);
    return presented;
  }

  async remove(id: string, actor: AuthUser) {
    const task = await this.getOrFail(id);
    if (task.createdById !== actor.id && actor.role !== 'admin')
      throw new ForbiddenException('Solo el creador o un administrador puede eliminar la tarea');
    const comments = await this.comments.find({ where: { taskId: id } });
    const files = comments.flatMap((c) => c.attachments.map((a) => a.storedName));
    const before = this.present(task);
    await this.tasks.delete(id);
    const dir = this.config.get('UPLOAD_DIR', '/app/uploads');
    await Promise.all(files.map((f) => fs.unlink(join(dir, f)).catch(() => undefined)));
    await this.audit.log(actor, 'task.delete', 'task', id, before, null);
    return { ok: true };
  }

  private emitChanges(task: Task, actor: AuthUser, changes: ReturnType<typeof detectChanges>, added: User[]) {
    const payloadTask = {
      id: task.id,
      title: task.title,
      assignees: task.assignees.map((u) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive })),
    };
    const a = { id: actor.id, name: actor.name };
    if (added.length > 0) {
      this.events.emit('task.assigned', {
        task: { id: task.id, title: task.title },
        actor: a,
        newAssignees: added.map((u) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive })),
      });
    }
    if (changes.length > 0) {
      this.events.emit('task.changed', { task: payloadTask, actor: a, changes, excludeUserIds: added.map((u) => u.id) });
    }
  }
}
