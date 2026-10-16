import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export function typeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.get('DB_HOST', 'localhost'),
    port: parseInt(config.get('DB_PORT', '5432'), 10),
    username: config.get('DB_USER', 'acuerdalo'),
    password: config.get('DB_PASSWORD', 'acuerdalo'),
    database: config.get('DB_NAME', 'acuerdalo'),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: true,
    migrations: [join(__dirname, '..', 'migrations', '*.{js,ts}')],
  };
}
