import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { SessionsModule } from './sessions/sessions.module';
import { WorkshopsModule } from './workshops/workshops.module';

@Module({
  imports: [DatabaseModule, AuthModule, WorkshopsModule, SessionsModule, RegistrationsModule],
})
export class AppModule {}
