import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AuthUser, CurrentUser } from '../common/decorators';
import { parseRange } from '../common/range';
import { sendFile, sendRangeNotSatisfiable } from '../common/send-file';
import {
  ActivityQueryDto, CreatePublicationCommentDto, CreatePublicationDto, DecisionDto, PublicationQueryDto, ReorderFilesDto, StatusActionDto,
  UpdatePublicationDto,
} from './publications.dto';
import { PublicationsService } from './publications.service';

@Controller('publications')
export class PublicationsController {
  constructor(private publications: PublicationsService) {}

  @Get()
  list(@Query() q: PublicationQueryDto, @CurrentUser() user: AuthUser) {
    return this.publications.list(q, user);
  }

  // las rutas fijas van antes de ':id' para que no se interpreten como un id
  @Get('activity')
  activity(@Query() q: ActivityQueryDto) {
    return this.publications.activity(q.limit ?? 10);
  }

  @Get('files/:fileId')
  async file(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('download') download: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const file = await this.publications.getFile(fileId);
    const range = parseRange(req.headers.range, file.size);
    if (range === 'unsatisfiable') return sendRangeNotSatisfiable(res, file.size);
    const stream = await this.publications.openFile(file, range);
    sendFile(res, file, stream, download, range);
  }

  @Post()
  create(@Body() dto: CreatePublicationDto, @CurrentUser() user: AuthUser) {
    return this.publications.create(dto, user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.publications.get(id, user);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePublicationDto, @CurrentUser() user: AuthUser) {
    return this.publications.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.publications.remove(id, user);
  }

  @Post(':id/status')
  @HttpCode(200)
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusActionDto, @CurrentUser() user: AuthUser) {
    return this.publications.changeStatus(id, dto.action, user);
  }

  @Post(':id/versions')
  @UseInterceptors(FilesInterceptor('files', 20))
  uploadVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('note') note: string | undefined,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @CurrentUser() user: AuthUser,
  ) {
    return this.publications.uploadVersion(id, typeof note === 'string' ? note : '', files ?? [], user);
  }

  @Patch(':id/versions/:versionId/order')
  reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: ReorderFilesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.publications.reorderFiles(id, versionId, dto.fileIds, user);
  }

  @Post(':id/versions/:versionId/approval')
  @HttpCode(200)
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: DecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.publications.decide(id, versionId, dto.decision, user);
  }

  @Delete(':id/versions/:versionId/approval')
  undoDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.publications.undoDecision(id, versionId, user);
  }

  @Post(':id/comments')
  @HttpCode(200)
  addComment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePublicationCommentDto, @CurrentUser() user: AuthUser) {
    return this.publications.addComment(id, dto, user);
  }

  @Delete(':id/comments/:commentId')
  removeComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.publications.removeComment(id, commentId, user);
  }
}
