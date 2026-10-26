import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export const STATUSES = ['not_started', 'in_progress', 'completed'];
export const PRIORITIES = ['high', 'medium', 'low'];

export class CreateTaskDto {
  @IsString() @MinLength(1) @MaxLength(300)
  title!: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsIn(STATUSES)
  status?: string;

  @IsOptional() @IsIn(PRIORITIES)
  priority?: string;

  @IsUUID()
  typeId!: string;

  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString()
  dueDate?: string | null;

  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  assigneeIds?: string[];

  @IsOptional() @IsUUID()
  clientId?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300)
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsIn(STATUSES)
  status?: string;

  @IsOptional() @IsIn(PRIORITIES)
  priority?: string;

  @IsOptional() @IsUUID()
  typeId?: string;

  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString()
  dueDate?: string | null;

  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  assigneeIds?: string[];

  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsUUID()
  clientId?: string | null;
}

export class MoveTaskDto {
  @IsIn(STATUSES)
  status!: string;

  @Type(() => Number) @IsInt() @Min(0)
  position!: number;

  /** Opcional: colocar justo antes de esta tarea (útil cuando el tablero está filtrado). */
  @IsOptional() @IsUUID()
  beforeId?: string;
}

export class TaskQueryDto {
  @IsOptional() @IsUUID()
  assigneeId?: string;

  @IsOptional() @IsIn(PRIORITIES)
  priority?: string;

  @IsOptional() @IsUUID()
  typeId?: string;

  @IsOptional() @IsUUID()
  clientId?: string;
}
