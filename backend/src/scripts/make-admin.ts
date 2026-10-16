import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuditService } from '../audit/audit.service';
import { typeOrmConfig } from '../database/typeorm.config';
import { EntitiesModule } from '../database/entities.module';
import { publicUser, User } from '../entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: typeOrmConfig }),
    EntitiesModule,
    AuditModule,
  ],
})
class ScriptModule {}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Uso: npm run make-admin -- correo@dominio.com');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(ScriptModule, { logger: ['error', 'warn'] });
  const logger = new Logger('make-admin');
  try {
    const users = app.get<Repository<User>>(getRepositoryToken(User));
    const audit = app.get(AuditService);
    const user = await users.findOne({ where: { email } });
    if (!user) {
      console.error(`No existe ningún usuario con el correo ${email}`);
      process.exitCode = 1;
      return;
    }
    const before = publicUser(user);
    user.isActive = true;
    user.role = 'admin';
    const saved = await users.save(user);
    await audit.log({ id: null, email: 'cli:make-admin' }, 'user.make_admin', 'user', saved.id, before, publicUser(saved));
    logger.log(`${email} ahora es administrador y está activo`);
    console.log(`OK: ${email} ahora es administrador y está activo`);
  } finally {
    await app.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
