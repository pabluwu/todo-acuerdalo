import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { CreateTaskTypeDto, UpdateTaskTypeDto } from './task-types.dto';
import { TaskTypesService } from './task-types.service';

@Controller('task-types')
export class TaskTypesController {
  constructor(private types: TaskTypesService) {}

  @Get()
  list(@Query('all') all: string | undefined, @CurrentUser() user: AuthUser) {
    return this.types.list(all === 'true' && user.role === 'admin');
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateTaskTypeDto, @CurrentUser() user: AuthUser) {
    return this.types.create(dto, user);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskTypeDto, @CurrentUser() user: AuthUser) {
    return this.types.update(id, dto, user);
  }
}
