import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from '../entities/attachment.entity';
import { CalendarEvent } from '../entities/event.entity';
import { ExternalContact } from '../entities/external-contact.entity';
import { Comment } from '../entities/comment.entity';
import { Log } from '../entities/log.entity';
import { TaskType } from '../entities/task-type.entity';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';

const features = TypeOrmModule.forFeature([User, TaskType, Task, Comment, Attachment, Log, CalendarEvent, ExternalContact]);

@Global()
@Module({ imports: [features], exports: [features] })
export class EntitiesModule {}
