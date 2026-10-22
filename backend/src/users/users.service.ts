import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actor, AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators';
import { publicUser, User } from '../entities/user.entity';
import { normalizeCopyEmails } from './copy-emails';
import { UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private audit: AuditService,
    private events: EventEmitter2,
  ) {}

  async listActive() {
    const users = await this.users.find({ where: { isActive: true }, order: { name: 'ASC' } });
    return users.map((u) => ({ id: u.id, name: u.name, email: u.email }));
  }

  async listAdmin(status?: string) {
    const where: any = {};
    if (status === 'pending') where.isActive = false;
    else if (status === 'active') where.isActive = true;
    const users = await this.users.find({ where, order: { createdAt: 'DESC' } });
    return users.map(publicUser);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (id === actor.id && (dto.isActive === false || dto.role === 'user')) {
      throw new BadRequestException('No puedes desactivarte ni quitarte el rol de administrador a ti mismo');
    }
    const before = publicUser(user);
    const wasActive = user.isActive;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.copyEmails !== undefined) user.copyEmails = normalizeCopyEmails(dto.copyEmails, user.email);
    const saved = await this.users.save(user);
    const after = publicUser(saved);
    const a: Actor = { id: actor.id, email: actor.email, ip: actor.ip };
    if (dto.isActive !== undefined && dto.isActive !== wasActive) {
      await this.audit.log(a, dto.isActive ? 'user.activate' : 'user.deactivate', 'user', id, before, after);
      if (dto.isActive) this.events.emit('user.activated', { user: after });
    }
    if (dto.role !== undefined && dto.role !== before.role) {
      await this.audit.log(a, 'user.role_change', 'user', id, before, after);
    }
    if (dto.copyEmails !== undefined && !sameList(before.copyEmails, after.copyEmails)) {
      await this.audit.log(a, 'user.copy_emails_change', 'user', id, before, after);
    }
    return after;
  }

  /** Cada usuario edita sus propias copias de correo. */
  async updateCopyEmails(id: string, emails: string[], actor: AuthUser) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const before = publicUser(user);
    user.copyEmails = normalizeCopyEmails(emails, user.email);
    const after = publicUser(await this.users.save(user));
    const a: Actor = { id: actor.id, email: actor.email, ip: actor.ip };
    if (!sameList(before.copyEmails, after.copyEmails)) {
      await this.audit.log(a, 'user.copy_emails_change', 'user', id, before, after);
    }
    return after;
  }
}

const sameList = (x: string[], y: string[]) => x.length === y.length && x.every((v, i) => v === y[i]);
