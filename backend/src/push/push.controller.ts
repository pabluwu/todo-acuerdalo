import { Body, Controller, Delete, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { SubscribeDto, UnsubscribeDto } from './push.dto';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private push: PushService) {}

  /** La clave pública no es secreta; es pública para que el front no necesite variables en el build. */
  @Public()
  @Get('vapid-public-key')
  vapidPublicKey() {
    return { key: this.push.publicKey };
  }

  @Post('subscriptions')
  @HttpCode(204)
  async subscribe(@Body() dto: SubscribeDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    await this.push.subscribe(user.id, dto.endpoint, dto.keys, req.headers['user-agent']);
  }

  @Delete('subscriptions')
  @HttpCode(204)
  async unsubscribe(@Body() dto: UnsubscribeDto, @CurrentUser() user: AuthUser) {
    await this.push.unsubscribe(user.id, dto.endpoint);
  }
}
