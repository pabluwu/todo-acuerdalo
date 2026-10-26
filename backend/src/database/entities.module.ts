import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from '../entities/attachment.entity';
import { ClientFile } from '../entities/client-file.entity';
import { ClientFolder } from '../entities/client-folder.entity';
import { ClientNote } from '../entities/client-note.entity';
import { Client } from '../entities/client.entity';
import { CalendarEvent } from '../entities/event.entity';
import { ExternalContact } from '../entities/external-contact.entity';
import { Comment } from '../entities/comment.entity';
import { NoteFile } from '../entities/note-file.entity';
import { NoteFolder } from '../entities/note-folder.entity';
import { NoteAccessRequest } from '../entities/note-access-request.entity';
import { NoteShare } from '../entities/note-share.entity';
import { Note } from '../entities/note.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { PushSubscription } from '../entities/push-subscription.entity';
import { Log } from '../entities/log.entity';
import { TaskType } from '../entities/task-type.entity';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';

const features = TypeOrmModule.forFeature([User, TaskType, Task, Comment, Attachment, Log, CalendarEvent, ExternalContact, PasswordResetToken, Note, NoteShare, NoteAccessRequest, NoteFolder, NoteFile, Client, ClientNote, ClientFolder, ClientFile, PushSubscription]);

@Global()
@Module({ imports: [features], exports: [features] })
export class EntitiesModule {}
