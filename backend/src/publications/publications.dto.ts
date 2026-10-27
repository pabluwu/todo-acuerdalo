import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export class PublicationQueryDto {
  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @IsIn(['idea', 'edicion', 'por_publicar', 'publicada', 'cancelada'])
  status?: string;

  @IsOptional() @IsIn(['video', 'post'])
  format?: string;

  @IsOptional() @IsString() @MaxLength(5)
  pendingMine?: string;
}

export class ActivityQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number;
}

export class CreatePublicationDto {
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsIn(['video', 'post'])
  format!: 'video' | 'post';

  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true })
  platforms?: string[];

  @IsDateString()
  scheduledAt!: string;

  @IsOptional() @IsString() @MaxLength(20_000)
  caption?: string;

  @IsOptional() @IsString() @MaxLength(20_000)
  brief?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true })
  reviewerIds?: string[];
}

export class UpdatePublicationDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @IsIn(['video', 'post'])
  format?: 'video' | 'post';

  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true })
  platforms?: string[];

  @IsOptional() @IsDateString()
  scheduledAt?: string;

  @IsOptional() @IsString() @MaxLength(20_000)
  caption?: string;

  @IsOptional() @IsString() @MaxLength(20_000)
  brief?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true })
  reviewerIds?: string[];
}

export class StatusActionDto {
  @IsIn(['publish', 'cancel', 'restore', 'reopen'])
  action!: 'publish' | 'cancel' | 'restore' | 'reopen';
}

export class ReorderFilesDto {
  @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true })
  fileIds!: string[];
}

export class DecisionDto {
  @IsIn(['aprobada', 'cambios'])
  decision!: 'aprobada' | 'cambios';
}

export class CreatePublicationCommentDto {
  @IsString() @MinLength(1) @MaxLength(5000)
  body!: string;

  @IsOptional() @IsUUID()
  versionId?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999999)
  timecodeSec?: number;

  @IsOptional() @IsInt() @Min(0) @Max(19)
  slideIndex?: number;

  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true })
  mentionIds?: string[];
}
