import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService, hashResetToken } from './auth.service';

describe('AuthService', () => {
  let users: any;
  let jwt: any;
  let audit: any;
  let resetTokens: any;
  let events: any;
  let service: AuthService;

  beforeEach(() => {
    users = {
      findOne: jest.fn(),
      create: jest.fn((x) => ({ id: 'u1', createdAt: new Date(), ...x })),
      save: jest.fn(async (x) => x),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    resetTokens = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      update: jest.fn().mockResolvedValue(undefined),
    };
    events = { emit: jest.fn() };
    service = new AuthService(users, jwt, audit, resetTokens, events);
  });

  it('registra usuarios inactivos, con correo normalizado y contraseña hasheada', async () => {
    users.findOne.mockResolvedValue(null);
    const res = await service.register({ name: 'Ana', email: 'ANA@Test.com', password: 'secreto123' });
    const created = users.create.mock.calls[0][0];
    expect(created.email).toBe('ana@test.com');
    expect(created.isActive).toBe(false);
    expect(created.role).toBe('user');
    expect(created.passwordHash).not.toBe('secreto123');
    expect(await bcrypt.compare('secreto123', created.passwordHash)).toBe(true);
    expect(res.user).not.toHaveProperty('passwordHash');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), 'user.register', 'user', 'u1', null, expect.anything());
  });

  it('rechaza el registro con un correo duplicado', async () => {
    users.findOne.mockResolvedValue({ id: 'x' });
    await expect(service.register({ name: 'Ana', email: 'a@a.com', password: 'secreto123' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza el login de cuentas inactivas', async () => {
    const hash = await bcrypt.hash('secreto123', 4);
    users.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', passwordHash: hash, isActive: false });
    await expect(service.login({ email: 'a@a.com', password: 'secreto123' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rechaza contraseñas incorrectas y usuarios inexistentes', async () => {
    const hash = await bcrypt.hash('secreto123', 4);
    users.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', passwordHash: hash, isActive: true });
    await expect(service.login({ email: 'a@a.com', password: 'mala' })).rejects.toBeInstanceOf(UnauthorizedException);
    users.findOne.mockResolvedValue(null);
    await expect(service.login({ email: 'zz@a.com', password: 'x' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('devuelve un token para credenciales válidas de cuentas activas', async () => {
    const hash = await bcrypt.hash('secreto123', 4);
    users.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', name: 'A', role: 'user', passwordHash: hash, isActive: true });
    const res = await service.login({ email: 'A@a.com', password: 'secreto123' });
    expect(res.token).toBe('signed-token');
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1', role: 'user' });
    expect(res.user).not.toHaveProperty('passwordHash');
  });

  describe('recuperar contraseña', () => {
    const MSG = 'Si el correo está registrado, te enviamos un enlace';

    it('guarda solo el hash SHA-256 del token y envía el original por evento', async () => {
      users.findOne.mockResolvedValue({ id: 'u1', name: 'Ana', email: 'ana@a.com', isActive: true });
      const res = await service.forgotPassword(' ANA@a.com ');
      expect(res).toEqual({ message: MSG });
      const saved = resetTokens.save.mock.calls[0][0];
      const emitted = events.emit.mock.calls[0];
      expect(emitted[0]).toBe('auth.password_reset_requested');
      expect(emitted[1].token).toHaveLength(43);
      expect(saved.tokenHash).toBe(hashResetToken(emitted[1].token));
      expect(saved.tokenHash).not.toBe(emitted[1].token);
      expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 60 * 1000);
      expect(saved.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000);
      expect(resetTokens.update).toHaveBeenCalled();
    });

    it('responde igual si el correo no existe o la cuenta está inactiva, sin generar token', async () => {
      users.findOne.mockResolvedValue(null);
      expect(await service.forgotPassword('nadie@a.com')).toEqual({ message: MSG });
      users.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', isActive: false });
      expect(await service.forgotPassword('a@a.com')).toEqual({ message: MSG });
      expect(resetTokens.save).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('rechaza enlaces inválidos, usados o expirados', async () => {
      resetTokens.findOne.mockResolvedValue(null);
      await expect(service.resetPassword('token-que-no-existe', 'nueva-clave-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(users.save).not.toHaveBeenCalled();
      // la consulta exige token sin usar y vigente
      const where = resetTokens.findOne.mock.calls[0][0].where;
      expect(where.tokenHash).toBe(hashResetToken('token-que-no-existe'));
      expect(where).toHaveProperty('usedAt');
      expect(where).toHaveProperty('expiresAt');
    });

    it('cambia la contraseña, marca el token como usado e inicia sesión', async () => {
      const user = { id: 'u1', email: 'a@a.com', name: 'A', role: 'user', passwordHash: 'viejo', isActive: true };
      const row = { id: 't1', user, usedAt: null as Date | null };
      resetTokens.findOne.mockResolvedValue(row);
      const res = await service.resetPassword('tok', 'nueva-clave-1');
      expect(user.passwordHash).not.toBe('viejo');
      expect(await bcrypt.compare('nueva-clave-1', user.passwordHash)).toBe(true);
      expect(row.usedAt).toBeInstanceOf(Date);
      expect(resetTokens.save).toHaveBeenCalledWith(row);
      expect(res.token).toBe('signed-token');
      expect(res.user).not.toHaveProperty('passwordHash');
      expect(audit.log).toHaveBeenCalledWith(expect.anything(), 'auth.password_reset', 'user', 'u1', null, null);
    });

    it('no inicia sesión si la cuenta está inactiva', async () => {
      resetTokens.findOne.mockResolvedValue({ id: 't1', user: { id: 'u1', isActive: false }, usedAt: null });
      await expect(service.resetPassword('tok', 'nueva-clave-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });
  });
});
