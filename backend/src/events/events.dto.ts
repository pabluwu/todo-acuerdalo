import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID,
  MaxLength, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';

export const EVENT_COLORS = ['accent', 'emerald', 'amber', 'rose', 'sky', 'zinc'];
export const REMINDER_OPTIONS = [5, 15, 30, 60, 1440];

export class ContactInputDto {
  @IsOptional() @IsUUID()
  id?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @IsOptional() @IsEmail() @MaxLength(320)
  email?: string;
}

export class CreateEventDto {
  @IsString() @MinLength(1) @MaxLength(300)
  title!: string;

  @IsOptional() @IsString() @MaxLength(10000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(300)
  location?: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional() @IsBoolean()
  allDay?: boolean;

  @IsOptional() @IsIn(EVENT_COLORS)
  color?: string;

  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsInt() @IsIn(REMINDER_OPTIONS)
  reminderMinutes?: number | null;

  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  participantIds?: string[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ContactInputDto)
  externalContacts?: ContactInputDto[];
}

export class UpdateEventDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300)
  title?: string;

  @IsOptional() @IsString() @MaxLength(10000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(300)
  location?: string;

  @IsOptional() @IsDateString()
  startAt?: string;

  @IsOptional() @IsDateString()
  endAt?: string;

  @IsOptional() @IsBoolean()
  allDay?: boolean;

  @IsOptional() @IsIn(EVENT_COLORS)
  color?: string;

  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsInt() @IsIn(REMINDER_OPTIONS)
  reminderMinutes?: number | null;

  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  participantIds?: string[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ContactInputDto)
  externalContacts?: ContactInputDto[];
}

export class MoveEventDto {
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsBoolean()
  allDay!: boolean;
}

export class EventQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional() @IsString()
  userIds?: string;

  @IsOptional() @IsString()
  contactIds?: string;

  @IsOptional() @IsString()
  mine?: string;
}

export class ConflictQueryDto {
  @IsString()
  userIds!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional() @IsUUID()
  excludeId?: string;
}
