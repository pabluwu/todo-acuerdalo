import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsIn(['admin', 'user'])
  role?: 'admin' | 'user';

  @IsOptional()
  @IsArray({ message: 'La lista de copias no es válida' })
  @ArrayMaxSize(10, { message: 'Máximo 10 correos de copia' })
  @IsEmail({}, { each: true, message: 'Hay un correo de copia con formato inválido' })
  copyEmails?: string[];
}

export class UpdateCopyEmailsDto {
  @IsArray({ message: 'La lista de copias no es válida' })
  @ArrayMaxSize(10, { message: 'Máximo 10 correos de copia' })
  @IsEmail({}, { each: true, message: 'Hay un correo de copia con formato inválido' })
  copyEmails!: string[];
}
