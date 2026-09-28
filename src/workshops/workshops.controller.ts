import { Controller, Get } from '@nestjs/common';
import { Workshop, WorkshopsService } from './workshops.service';

@Controller('workshops')
export class WorkshopsController {
  constructor(private readonly workshops: WorkshopsService) {}

  @Get()
  findAll(): Promise<Workshop[]> {
    return this.workshops.findAll();
  }
}
