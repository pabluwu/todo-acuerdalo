import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { AuditService } from './audit.service';

@Controller('admin/logs')
@Roles('admin')
export class LogsController {
  constructor(private audit: AuditService) {}

  @Get()
  list(@Query('page') page = '1', @Query('pageSize') pageSize = '50') {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const s = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50));
    return this.audit.list(p, s);
  }
}
