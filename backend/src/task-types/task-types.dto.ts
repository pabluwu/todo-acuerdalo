import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTaskTypeDto {
  @IsString() @MinLength(1) @MaxLength(80)
  name!: string;
}

export class UpdateTaskTypeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  name?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
