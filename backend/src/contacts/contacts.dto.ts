import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContactDto {
  @IsString() @MinLength(1) @MaxLength(200)
  name!: string;

  @IsEmail() @MaxLength(320)
  email!: string;
}

export class UpdateContactDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @IsOptional() @IsEmail() @MaxLength(320)
  email?: string;
}

export class ContactQueryDto {
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;
}
