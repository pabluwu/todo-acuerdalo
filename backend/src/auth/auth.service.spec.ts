import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let users: any;
  let jwt: any;
  let audit: any;
  let service: AuthService;

  beforeEach(() => {
    users = {
      findOne: jest.fn(),
      create: jest.fn((x) => ({ id: 'u1', createdAt: new Date(), ...x })),
      save: jest.fn(async (x) => x),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(users, jwt, audit);
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
});
