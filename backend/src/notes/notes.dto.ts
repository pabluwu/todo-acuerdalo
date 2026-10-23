import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';

export const VISIBILITIES = ['common', 'private'];
export const PERMISSIONS = ['view', 'edit'];

export class CreateNoteDto {
  @IsString() @MinLength(1) @MaxLength(300)
  title!: string;

  @IsOptional() @IsString() @MaxLength(200_000)
  body?: string;

  @IsIn(VISIBILITIES)
  visibility!: 'common' | 'private';
}

export class UpdateNoteDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300)
  title?: string;

  @IsOptional() @IsString() @MaxLength(200_000)
  body?: string;

  @IsOptional() @IsIn(VISIBILITIES)
  visibility?: 'common' | 'private';
}

export class ShareItemDto {
  @IsUUID()
  userId!: string;

  @IsIn(PERMISSIONS)
  permission!: 'view' | 'edit';
}

export class SetSharesDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ShareItemDto)
  shares!: ShareItemDto[];
}

export class ResolveRequestDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional() @IsIn(PERMISSIONS)
  permission?: 'view' | 'edit';
}
