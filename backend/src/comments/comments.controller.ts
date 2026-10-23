import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthUser, CurrentUser } from '../common/decorators';
import { CommentsService } from './comments.service';

const INLINE_TYPES = /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf)$/i;

@Controller()
export class CommentsController {
  constructor(private comments: CommentsService) {}

  @Get('tasks/:taskId/comments')
  list(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.comments.list(taskId);
  }

  @Post('tasks/:taskId/comments')
  @UseInterceptors(FilesInterceptor('files', 10))
  create(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body('body') body: string,
    @Body('mentionIds') mentionIds: string | string[] | undefined,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.create(taskId, body ?? '', files ?? [], user, mentionIds);
  }

  @Get('attachments/:id')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    const { attachment, stream } = await this.comments.getAttachment(id);
    const inline = download !== '1' && INLINE_TYPES.test(attachment.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type(inline ? attachment.mimeType : 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    );
    res.setHeader('Content-Length', String(attachment.size));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }
}
