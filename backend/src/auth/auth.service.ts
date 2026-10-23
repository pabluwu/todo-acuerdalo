import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { publicUser, User } from '../entities/user.entity';
import { LoginDto, RegisterDto } from './auth.dto';

const RESET_TTL_MS = 60 * 60 * 1000;

export const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private jwt: JwtService,
    private audit: AuditService,
    @InjectRepository(PasswordResetToken) private resetTokens: Repository<PasswordResetToken>,
    private events: EventEmitter2,
  ) {}

  async register(dto: RegisterDto, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.findOne({ where: { email } });
    if (existing) throw new ConflictException('Ya existe una cuenta con ese correo');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.save(
      this.users.create({ name: dto.name.trim(), email, passwordHash, role: 'user', isActive: false }),
    );
    await this.audit.log({ id: user.id, email: user.email, ip }, 'user.register', 'user', user.id, null, publicUser(user));
    return {
      message: 'Tu cuenta quedará activa cuando un administrador la apruebe',
      user: publicUser(user),
    };
  }

  async login(dto: LoginDto, ip?: string) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    const ok = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !ok) {
      await this.audit.log({ id: user?.id ?? null, email, ip }, 'auth.login_failed', 'user', user?.id ?? null, null, { reason: 'credenciales' });
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    if (!user.isActive) {
      await this.audit.log({ id: user.id, email: user.email, ip }, 'auth.login_failed', 'user', user.id, null, { reason: 'cuenta inactiva' });
      throw new ForbiddenException('Tu cuenta aún no ha sido aprobada por un administrador');
    }
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    await this.audit.log({ id: user.id, email: user.email, ip }, 'auth.login', 'user', user.id, null, null);
    return { token, user: publicUser(user) };
  }

  /** Responde siempre igual, exista o no la cuenta, para no revelar qué correos están registrados. */
  async forgotPassword(rawEmail: string, ip?: string) {
    const message = 'Si el correo está registrado, te enviamos un enlace';
    const email = rawEmail.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    if (!user || !user.isActive) return { message };
    // un solo enlace vigente por usuario
    await this.resetTokens.update({ userId: user.id, usedAt: IsNull() }, { usedAt: new Date() });
    const token = randomBytes(32).toString('base64url');
    await this.resetTokens.save(
      this.resetTokens.create({ userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS), usedAt: null }),
    );
    await this.audit.log({ id: user.id, email: user.email, ip }, 'auth.password_reset_requested', 'user', user.id, null, null);
    this.events.emit('auth.password_reset_requested', { user: { id: user.id, name: user.name, email: user.email }, token });
    return { message };
  }

  async resetPassword(token: string, password: string, ip?: string) {
    const row = await this.resetTokens.findOne({
      where: { tokenHash: hashResetToken(token), usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });
    if (!row) throw new BadRequestException('El enlace no es válido o expiró');
    const user = row.user;
    if (!user.isActive) throw new ForbiddenException('Tu cuenta aún no ha sido aprobada por un administrador');
    user.passwordHash = await bcrypt.hash(password, 10);
    await this.users.save(user);
    row.usedAt = new Date();
    await this.resetTokens.save(row);
    const jwt = await this.jwt.signAsync({ sub: user.id, role: user.role });
    await this.audit.log({ id: user.id, email: user.email, ip }, 'auth.password_reset', 'user', user.id, null, null);
    return { token: jwt, user: publicUser(user) };
  }

  async me(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return publicUser(user);
  }
}
