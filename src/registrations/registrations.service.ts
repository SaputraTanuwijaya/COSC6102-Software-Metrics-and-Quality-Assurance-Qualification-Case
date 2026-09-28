import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type RegistrationStatus = 'registered' | 'cancelled' | 'attended';

interface RegistrationRow {
  id: number;
  session_id: number;
  user_id: number;
  status: RegistrationStatus;
  registered_at: string;
}

export interface Registration {
  id: number;
  sessionId: number;
  userId: number;
  status: RegistrationStatus;
  registeredAt: string;
}

function toRegistration(row: RegistrationRow): Registration {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    status: row.status,
    registeredAt: row.registered_at,
  };
}

@Injectable()
export class RegistrationsService {
  constructor(private readonly db: DatabaseService) {}

  register(userId: number, sessionId: number): Promise<Registration> {
    return this.db.transaction(async () => {
      const session = await this.db.get<{ id: number }>('SELECT id FROM sessions WHERE id = ?', [
        sessionId,
      ]);
      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      const existing = await this.db.get<RegistrationRow>(
        `SELECT id, session_id, user_id, status, registered_at
         FROM registrations WHERE session_id = ? AND user_id = ?`,
        [sessionId, userId],
      );
      if (existing && existing.status !== 'cancelled') {
        throw new ConflictException('You are already registered for this session');
      }

      const { changes } = await this.db.run(
        `UPDATE sessions SET seats_taken = seats_taken + 1
         WHERE id = ? AND status = 'open' AND seats_taken < capacity`,
        [sessionId],
      );
      if (changes === 0) {
        throw new BadRequestException('Session is full or not open for registration');
      }

      if (existing) {
        await this.db.run(
          `UPDATE registrations SET status = 'registered', registered_at = datetime('now')
           WHERE id = ?`,
          [existing.id],
        );
        return this.requireRegistration(existing.id);
      }

      const { lastID } = await this.db.run(
        'INSERT INTO registrations (session_id, user_id) VALUES (?, ?)',
        [sessionId, userId],
      );
      return this.requireRegistration(lastID);
    });
  }

  cancel(userId: number, id: number): Promise<Registration> {
    return this.db.transaction(async () => {
      const registration = await this.requireRegistration(id);
      if (registration.userId !== userId) {
        throw new ForbiddenException('You can only cancel your own registration');
      }
      if (registration.status !== 'registered') {
        throw new ConflictException(`Registration is already ${registration.status}`);
      }

      await this.db.run(`UPDATE registrations SET status = 'cancelled' WHERE id = ?`, [id]);
      await this.db.run(
        'UPDATE sessions SET seats_taken = seats_taken - 1 WHERE id = ? AND seats_taken > 0',
        [registration.sessionId],
      );
      return this.requireRegistration(id);
    });
  }

  attend(id: number): Promise<Registration> {
    return this.db.transaction(async () => {
      const registration = await this.requireRegistration(id);
      if (registration.status !== 'registered') {
        throw new ConflictException(`Registration is already ${registration.status}`);
      }

      await this.db.run(`UPDATE registrations SET status = 'attended' WHERE id = ?`, [id]);
      return this.requireRegistration(id);
    });
  }

  private async requireRegistration(id: number): Promise<Registration> {
    const row = await this.db.get<RegistrationRow>(
      `SELECT id, session_id, user_id, status, registered_at
       FROM registrations WHERE id = ?`,
      [id],
    );
    if (!row) {
      throw new NotFoundException(`Registration ${id} not found`);
    }
    return toRegistration(row);
  }
}
