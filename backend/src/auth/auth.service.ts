import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { publicUser, User } from '../entities/user.entity';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private jwt: JwtService,
    private audit: AuditService,
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

  async me(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return publicUser(user);
  }
}
