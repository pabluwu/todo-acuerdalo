import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log } from '../entities/log.entity';
import { AuditService } from './audit.service';
import { LogsController } from './logs.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Log])],
  controllers: [LogsController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
