import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators';
import { ConflictQueryDto, CreateEventDto, EventQueryDto, MoveEventDto, UpdateEventDto } from './events.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private events: EventsService) {}

  @Get()
  list(@Query() q: EventQueryDto, @CurrentUser() user: AuthUser) {
    return this.events.list(q, user);
  }

  // debe ir antes de ':id'
  @Get('conflicts')
  conflicts(@Query() q: ConflictQueryDto) {
    return this.events.conflicts(q);
  }

  // debe ir antes de ':id'
  @Get('client/:clientId')
  forClient(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.events.listForClient(clientId);
  }

  @Post()
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthUser) {
    return this.events.create(dto, user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.get(id);
  }

  @Patch(':id/time')
  move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveEventDto, @CurrentUser() user: AuthUser) {
    return this.events.move(id, dto, user);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto, @CurrentUser() user: AuthUser) {
    return this.events.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.events.remove(id, user);
  }
}
