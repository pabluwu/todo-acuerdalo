import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';

class KeysDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  p256dh!: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  auth!: string;
}

export class SubscribeDto {
  @IsUrl({ require_tld: false, protocols: ['https'] }) @MaxLength(2000)
  endpoint!: string;

  @ValidateNested() @Type(() => KeysDto)
  keys!: KeysDto;
}

export class UnsubscribeDto {
  @IsString() @IsNotEmpty() @MaxLength(2000)
  endpoint!: string;
}
