import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({ imports: [ContactsModule], controllers: [EventsController], providers: [EventsService], exports: [EventsService] })
export class EventsModule {}
