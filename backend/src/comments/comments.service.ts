import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators';
import { Attachment } from '../entities/attachment.entity';
import { Comment } from '../entities/comment.entity';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';
import { Change } from '../tasks/task-changes';
import { normalizeMentionIds } from './mentions';

export function decodeName(name: string): string {
  // multer interpreta los nombres como latin1; los reconvertimos a UTF-8
  return Buffer.from(name, 'latin1').toString('utf8');
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private comments: Repository<Comment>,
    @InjectRepository(Attachment) private attachments: Repository<Attachment>,
    @InjectRepository(Task) private tasks: Repository<Task>,
    @InjectRepository(User) private users: Repository<User>,
    private audit: AuditService,
    private events: EventEmitter2,
    private config: ConfigService,
  ) {}

  present(c: Comment) {
    return {
      id: c.id,
      taskId: c.taskId,
      body: c.body,
      createdAt: c.createdAt,
      author: c.author ? { id: c.author.id, name: c.author.name } : null,
      attachments: (c.attachments ?? []).map((a) => ({
        id: a.id,
        originalName: a.originalName,
        mimeType: a.mimeType,
        size: a.size,
      })),
    };
  }

  async list(taskId: string) {
    if (!(await this.tasks.exists({ where: { id: taskId } }))) throw new NotFoundException('Tarea no encontrada');
    const rows = await this.comments.find({ where: { taskId }, order: { createdAt: 'ASC' } });
    return rows.map((c) => this.present(c));
  }

  async create(taskId: string, body: string, files: Express.Multer.File[], actor: AuthUser, mentionIds?: string | string[]) {
    const task = await this.tasks.findOne({ where: { id: taskId } });
    const cleanup = () => Promise.all(files.map((f) => fs.unlink(f.path).catch(() => undefined)));
    if (!task) {
      await cleanup();
      throw new NotFoundException('Tarea no encontrada');
    }
    const text = (body ?? '').trim();
    if (!text && files.length === 0) {
      throw new BadRequestException('El comentario no puede estar vacío');
    }
    // etiquetados: solo usuarios activos existentes (nunca el propio autor)
    const ids = normalizeMentionIds(mentionIds, actor.id);
    const mentioned = ids.length ? await this.users.find({ where: { id: In(ids), isActive: true } }) : [];
    const comment = await this.comments.save(
      this.comments.create({ taskId, authorId: actor.id, body: text }),
    );
    if (files.length > 0) {
      await this.attachments.save(
        files.map((f) =>
          this.attachments.create({
            commentId: comment.id,
            originalName: decodeName(f.originalname).slice(0, 300),
            mimeType: f.mimetype,
            size: f.size,
            storedName: f.filename,
          }),
        ),
      );
    }
    const full = await this.comments.findOneOrFail({ where: { id: comment.id } });
    const presented = this.present(full);
    await this.audit.log(actor, 'comment.create', 'comment', comment.id, null, { ...presented, taskId, mentions: mentioned.map((u) => u.id) });
    for (const a of presented.attachments) {
      await this.audit.log(actor, 'attachment.create', 'attachment', a.id, null, { ...a, commentId: comment.id, taskId });
    }

    const changes: Change[] = [];
    if (text) changes.push({ field: 'comment', label: 'Nuevo comentario', from: null, to: text.length > 500 ? text.slice(0, 500) + '…' : text });
    if (presented.attachments.length > 0)
      changes.push({ field: 'attachment', label: 'Archivos adjuntos', from: null, to: presented.attachments.map((a) => a.originalName).join(', ') });
    this.events.emit('task.changed', {
      task: {
        id: task.id,
        title: task.title,
        assignees: task.assignees.map((u) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive })),
      },
      actor: { id: actor.id, name: actor.name },
      changes,
      excludeUserIds: mentioned.map((u) => u.id),
    });
    if (mentioned.length > 0) {
      this.events.emit('task.mentioned', {
        task: { id: task.id, title: task.title },
        actor: { id: actor.id, name: actor.name },
        comment: { body: text, attachmentNames: presented.attachments.map((a) => a.originalName) },
        users: mentioned.map((u) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive })),
      });
    }
    return presented;
  }

  async getAttachment(id: string) {
    const a = await this.attachments.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Adjunto no encontrado');
    return { attachment: a, path: join(this.config.get('UPLOAD_DIR', '/app/uploads'), a.storedName) };
  }
}
