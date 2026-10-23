import { Controller, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
@Roles('admin')
export class SchedulerController {
  constructor(private scheduler: SchedulerService) {}

  /** Dispara el resumen semanal a mano (para probarlo sin esperar al lunes). */
  @Post('weekly-summary')
  weeklySummary() {
    return this.scheduler.runWeeklySummary();
  }
}
