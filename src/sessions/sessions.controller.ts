import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  parseIdParam,
  requireIntInRange,
  requireIsoDate,
  requireObject,
  requirePositiveInt,
  requireString,
} from '../common/validation';
import { Session, SessionDetail, SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SessionDetail> {
    return this.sessions.findOne(parseIdParam(id));
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() body: unknown): Promise<Session> {
    const input = requireObject(body);
    const workshopId = requirePositiveInt(input.workshopId, 'workshopId');
    const startsAt = requireIsoDate(input.startsAt, 'startsAt');
    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('startsAt must be in the future');
    }
    const location = requireString(input.location, 'location', 100).trim();
    const capacity = requireIntInRange(input.capacity, 'capacity', 1, 500);

    return this.sessions.create({ workshopId, startsAt, location, capacity });
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string): Promise<void> {
    return this.sessions.remove(parseIdParam(id));
  }
}
