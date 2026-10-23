import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { sendFile } from '../common/send-file';
import {
  ClientQueryDto, CreateClientDto, CreateClientNoteDto, CreateFolderDto, RenameDto, UpdateClientDto, UpdateClientNoteDto,
} from './clients.dto';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private clients: ClientsService) {}

  @Get()
  list(@Query() q: ClientQueryDto) {
    return this.clients.list(q);
  }

  @Post()
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthUser) {
    return this.clients.create(dto, user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto, @CurrentUser() user: AuthUser) {
    return this.clients.update(id, dto, user);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.clients.remove(id, user);
  }

  // ------------------------------------------------------------------ notas

  @Get(':id/notes')
  listNotes(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.listNotes(id);
  }

  @Post(':id/notes')
  createNote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateClientNoteDto, @CurrentUser() user: AuthUser) {
    return this.clients.createNote(id, dto, user);
  }

  @Get(':id/notes/:noteId')
  getNote(@Param('id', ParseUUIDPipe) id: string, @Param('noteId', ParseUUIDPipe) noteId: string) {
    return this.clients.getNote(id, noteId);
  }

  @Patch(':id/notes/:noteId')
  updateNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateClientNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clients.updateNote(id, noteId, dto, user);
  }

  @Delete(':id/notes/:noteId')
  removeNote(@Param('id', ParseUUIDPipe) id: string, @Param('noteId', ParseUUIDPipe) noteId: string, @CurrentUser() user: AuthUser) {
    return this.clients.removeNote(id, noteId, user);
  }

  // --------------------------------------------------------------- carpetas

  @Get(':id/folders')
  listFolder(@Param('id', ParseUUIDPipe) id: string, @Query('parent', new ParseUUIDPipe({ optional: true })) parent?: string) {
    return this.clients.listFolder(id, parent);
  }

  @Post(':id/folders')
  createFolder(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateFolderDto, @CurrentUser() user: AuthUser) {
    return this.clients.createFolder(id, dto, user);
  }

  @Patch(':id/folders/:folderId')
  renameFolder(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('folderId', ParseUUIDPipe) folderId: string,
    @Body() dto: RenameDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clients.renameFolder(id, folderId, dto, user);
  }

  @Delete(':id/folders/:folderId')
  removeFolder(@Param('id', ParseUUIDPipe) id: string, @Param('folderId', ParseUUIDPipe) folderId: string, @CurrentUser() user: AuthUser) {
    return this.clients.removeFolder(id, folderId, user);
  }

  // --------------------------------------------------------------- archivos

  @Post(':id/files')
  @UseInterceptors(FilesInterceptor('files', 10))
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('folderId') folderId: string | undefined,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @CurrentUser() user: AuthUser,
  ) {
    // multipart no pasa por un DTO: se valida aquí que la carpeta sea un uuid
    if (folderId && !isUUID(folderId)) throw new BadRequestException('Carpeta no válida');
    return this.clients.upload(id, folderId || undefined, files ?? [], user);
  }

  @Get(':id/files/:fileId')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    const { file, stream } = await this.clients.getFile(id, fileId);
    sendFile(res, file, stream, download);
  }

  @Patch(':id/files/:fileId')
  renameFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() dto: RenameDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clients.renameFile(id, fileId, dto, user);
  }

  @Delete(':id/files/:fileId')
  removeFile(@Param('id', ParseUUIDPipe) id: string, @Param('fileId', ParseUUIDPipe) fileId: string, @CurrentUser() user: AuthUser) {
    return this.clients.removeFile(id, fileId, user);
  }
}
