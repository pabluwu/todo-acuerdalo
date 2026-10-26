import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { isUUID } from 'class-validator';
import { Response } from 'express';
import { AuthUser, CurrentUser } from '../common/decorators';
import { sendFile } from '../common/send-file';
import {
  CreateNoteDto, CreateNoteFolderDto, RenameNoteFolderDto, ResolveRequestDto, SetSharesDto, UpdateNoteDto,
} from './notes.dto';
import { NotesService } from './notes.service';

@Controller('notes')
export class NotesController {
  constructor(private notes: NotesService) {}

  @Get()
  list(
    @Query('scope') scope: string | undefined,
    @Query('folder') folder: string | undefined,
    @Query('q') q: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (folder && !isUUID(folder)) throw new BadRequestException('Carpeta no válida');
    return this.notes.list(scope, folder || undefined, q, user);
  }

  // las rutas fijas van antes de `:id` para que no se interpreten como un identificador
  @Get('access-requests/pending/count')
  pendingCount(@CurrentUser() user: AuthUser) {
    return this.notes.pendingCount(user);
  }

  @Patch('access-requests/:requestId')
  resolveRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ResolveRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notes.resolveRequest(requestId, dto, user);
  }

  @Get('folders')
  folders(@Query('scope') scope: string | undefined, @CurrentUser() user: AuthUser) {
    return this.notes.allFolders(scope, user);
  }

  @Post('folders')
  createFolder(@Body() dto: CreateNoteFolderDto, @CurrentUser() user: AuthUser) {
    return this.notes.createFolder(dto, user);
  }

  @Patch('folders/:folderId')
  renameFolder(@Param('folderId', ParseUUIDPipe) folderId: string, @Body() dto: RenameNoteFolderDto, @CurrentUser() user: AuthUser) {
    return this.notes.renameFolder(folderId, dto, user);
  }

  @Delete('folders/:folderId')
  removeFolder(@Param('folderId', ParseUUIDPipe) folderId: string, @CurrentUser() user: AuthUser) {
    return this.notes.removeFolder(folderId, user);
  }

  @Post()
  create(@Body() dto: CreateNoteDto, @CurrentUser() user: AuthUser) {
    return this.notes.create(dto, user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.notes.get(id, user);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoteDto, @CurrentUser() user: AuthUser) {
    return this.notes.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.notes.remove(id, user);
  }

  @Put(':id/shares')
  setShares(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetSharesDto, @CurrentUser() user: AuthUser) {
    return this.notes.setShares(id, dto, user);
  }

  @Post(':id/access-requests')
  requestAccess(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.notes.requestAccess(id, user);
  }

  @Get(':id/access-requests')
  listRequests(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.notes.listRequests(id, user);
  }

  // --------------------------------------------------------------- archivos

  @Post(':id/files')
  @UseInterceptors(FilesInterceptor('files', 10))
  upload(@Param('id', ParseUUIDPipe) id: string, @UploadedFiles() files: Express.Multer.File[] = [], @CurrentUser() user: AuthUser) {
    return this.notes.upload(id, files ?? [], user);
  }

  @Get(':id/files/:fileId')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('download') download: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { file, stream } = await this.notes.getFile(id, fileId, user);
    sendFile(res, file, stream, download);
  }

  @Delete(':id/files/:fileId')
  removeFile(@Param('id', ParseUUIDPipe) id: string, @Param('fileId', ParseUUIDPipe) fileId: string, @CurrentUser() user: AuthUser) {
    return this.notes.removeFile(id, fileId, user);
  }
}
