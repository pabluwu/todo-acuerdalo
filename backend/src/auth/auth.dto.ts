import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @IsEmail() @MaxLength(200)
  email!: string;

  @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' }) @MaxLength(100)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString() @MaxLength(100)
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail() @MaxLength(200)
  email!: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(10) @MaxLength(200)
  token!: string;

  @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' }) @MaxLength(100)
  password!: string;
}
