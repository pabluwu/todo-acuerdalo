import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { ContactQueryDto, CreateContactDto, UpdateContactDto } from './contacts.dto';
import { ContactsService } from './contacts.service';

@Controller('contacts')
export class ContactsController {
  constructor(private contacts: ContactsService) {}

  @Get()
  list(@Query() q: ContactQueryDto) {
    return this.contacts.list(q);
  }

  @Post()
  create(@Body() dto: CreateContactDto, @CurrentUser() user: AuthUser) {
    return this.contacts.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactDto, @CurrentUser() user: AuthUser) {
    return this.contacts.update(id, dto, user);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.contacts.remove(id, user);
  }
}
