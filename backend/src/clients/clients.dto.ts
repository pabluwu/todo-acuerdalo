import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

/** Campos de la ficha, todos opcionales: vacío o `null` los borra. */
class ClientFieldsDto {
  @IsOptional() @IsString() @MaxLength(30)
  rut?: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  claveUnica?: string | null;

  @IsOptional() @IsString() @MaxLength(300)
  address?: string | null;

  // el correo vacío ('' o null) se trata como "sin correo" en el servicio
  @ValidateIf((_o, v) => !(v == null || (typeof v === 'string' && v.trim() === ''))) @IsEmail() @MaxLength(320)
  email?: string | null;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string | null;

  @IsOptional() @IsString() @MaxLength(150)
  occupation?: string | null;

  @IsOptional() @IsString() @MaxLength(40)
  maritalStatus?: string | null;

  @IsOptional() @IsString() @MaxLength(300)
  matter?: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  defendantName?: string | null;

  @IsOptional() @IsString() @MaxLength(30)
  defendantRut?: string | null;

  @IsOptional() @IsString() @MaxLength(300)
  defendantAddress?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  defendantIncome?: string | null;

  @IsOptional() @IsString() @MaxLength(100_000)
  caseHistory?: string | null;
}

export class CreateClientDto extends ClientFieldsDto {
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;
}

export class UpdateClientDto extends ClientFieldsDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;
}

export class ClientQueryDto {
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;
}

export class CreateClientNoteDto {
  @IsString() @MinLength(1) @MaxLength(300)
  title!: string;

  @IsOptional() @IsString() @MaxLength(200_000)
  body?: string;
}

export class UpdateClientNoteDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300)
  title?: string;

  @IsOptional() @IsString() @MaxLength(200_000)
  body?: string;
}

export class CreateFolderDto {
  @IsString() @MaxLength(500)
  name!: string;

  @IsOptional() @IsUUID()
  parentId?: string;
}

export class RenameDto {
  @IsString() @MaxLength(500)
  name!: string;
}
