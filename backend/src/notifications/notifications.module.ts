import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module';
import { NotificationsService } from './notifications.service';

@Module({ imports: [PushModule], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
