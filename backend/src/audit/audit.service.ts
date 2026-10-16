import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from '../entities/log.entity';

export interface Actor {
  id: string | null;
  email: string | null;
  ip?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectRepository(Log) private logs: Repository<Log>) {}

  async log(
    actor: Actor | null,
    action: string,
    entity: string,
    entityId: string | null,
    before: unknown = null,
    after: unknown = null,
  ): Promise<void> {
    try {
      const data = {
        userId: actor?.id ?? null,
        userEmail: actor?.email ?? null,
        action,
        entity,
        entityId,
        before: before ?? null,
        after: after ?? null,
        ip: actor?.ip ?? null,
        at: new Date().toISOString(),
      };
      await this.logs.insert({ data: JSON.parse(JSON.stringify(data)) });
    } catch (err) {
      this.logger.error(`No se pudo registrar el log: ${(err as Error).message}`);
    }
  }

  async list(page: number, pageSize: number) {
    const [items, total] = await this.logs.findAndCount({
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }
}
