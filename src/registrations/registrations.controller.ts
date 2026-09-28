import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parseIdParam, requireObject, requirePositiveInt } from '../common/validation';
import { Registration, RegistrationsService } from './registrations.service';

@Controller('registrations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Post()
  @Roles('participant')
  register(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<Registration> {
    const input = requireObject(body);
    const sessionId = requirePositiveInt(input.sessionId, 'sessionId');
    return this.registrations.register(user.id, sessionId);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Registration> {
    return this.registrations.cancel(user.id, parseIdParam(id));
  }

  @Patch(':id/attend')
  @Roles('admin')
  attend(@Param('id') id: string): Promise<Registration> {
    return this.registrations.attend(parseIdParam(id));
  }
}
