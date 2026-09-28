import { Module } from '@nestjs/common';

// Root module. Feature modules (database, auth, workshops, sessions,
// registrations, metrics) are added to `imports` as each phase lands.
@Module({
  imports: [],
})
export class AppModule {}
