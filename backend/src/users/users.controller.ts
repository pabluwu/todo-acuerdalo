import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UpdateCopyEmailsDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('users')
  listActive() {
    return this.users.listActive();
  }

  @Patch('users/me/copy-emails')
  updateCopyEmails(@Body() dto: UpdateCopyEmailsDto, @CurrentUser() actor: AuthUser) {
    return this.users.updateCopyEmails(actor.id, dto.copyEmails, actor);
  }

  @Roles('admin')
  @Get('admin/users')
  listAdmin(@Query('status') status?: string) {
    return this.users.listAdmin(status);
  }

  @Roles('admin')
  @Patch('admin/users/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.update(id, dto, actor);
  }
}
