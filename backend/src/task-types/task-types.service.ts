import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators';
import { TaskType } from '../entities/task-type.entity';
import { CreateTaskTypeDto, UpdateTaskTypeDto } from './task-types.dto';

@Injectable()
export class TaskTypesService {
  constructor(@InjectRepository(TaskType) private types: Repository<TaskType>, private audit: AuditService) {}

  list(all: boolean) {
    return this.types.find({ where: all ? {} : { isActive: true }, order: { name: 'ASC' } });
  }

  async create(dto: CreateTaskTypeDto, actor: AuthUser) {
    const name = dto.name.trim();
    if (await this.types.findOne({ where: { name } })) throw new ConflictException('Ya existe un tipo con ese nombre');
    const saved = await this.types.save(this.types.create({ name, isActive: true }));
    await this.audit.log(actor, 'task_type.create', 'task_type', saved.id, null, saved);
    return saved;
  }

  async update(id: string, dto: UpdateTaskTypeDto, actor: AuthUser) {
    const type = await this.types.findOne({ where: { id } });
    if (!type) throw new NotFoundException('Tipo no encontrado');
    const before = { ...type };
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const dup = await this.types.findOne({ where: { name } });
      if (dup && dup.id !== id) throw new ConflictException('Ya existe un tipo con ese nombre');
      type.name = name;
    }
    if (dto.isActive !== undefined) type.isActive = dto.isActive;
    const saved = await this.types.save(type);
    await this.audit.log(actor, 'task_type.update', 'task_type', id, before, saved);
    return saved;
  }
}
