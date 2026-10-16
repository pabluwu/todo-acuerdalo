import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsIn(['admin', 'user'])
  role?: 'admin' | 'user';
}
