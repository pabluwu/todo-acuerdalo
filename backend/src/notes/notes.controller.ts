import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators';
import { CreateNoteDto, ResolveRequestDto, SetSharesDto, UpdateNoteDto } from './notes.dto';
import { NotesService } from './notes.service';

@Controller('notes')
export class NotesController {
  constructor(private notes: NotesService) {}

  @Get()
  list(@Query('scope') scope: string | undefined, @Query('q') q: string | undefined, @CurrentUser() user: AuthUser) {
    return this.notes.list(scope, q, user);
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
}
