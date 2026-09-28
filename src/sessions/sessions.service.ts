import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type SessionStatus = 'open' | 'cancelled' | 'completed';

export interface SessionRow {
  id: number;
  workshop_id: number;
  starts_at: string;
  location: string;
  capacity: number;
  seats_taken: number;
  status: SessionStatus;
}

export interface Session {
  id: number;
  workshopId: number;
  startsAt: string;
  location: string;
  capacity: number;
  seatsTaken: number;
  seatsLeft: number;
  status: SessionStatus;
}

export interface SessionDetail extends Session {
  workshopTitle: string;
}

export interface CreateSessionInput {
  workshopId: number;
  startsAt: Date;
  location: string;
  capacity: number;
}

export function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    workshopId: row.workshop_id,
    startsAt: row.starts_at,
    location: row.location,
    capacity: row.capacity,
    seatsTaken: row.seats_taken,
    seatsLeft: row.capacity - row.seats_taken,
    status: row.status,
  };
}

@Injectable()
export class SessionsService {
  constructor(private readonly db: DatabaseService) {}

  async findOne(id: number): Promise<SessionDetail> {
    const row = await this.db.get<SessionRow & { workshop_title: string }>(
      `SELECT s.id, s.workshop_id, s.starts_at, s.location, s.capacity, s.seats_taken, s.status,
              w.title AS workshop_title
       FROM sessions s
       JOIN workshops w ON w.id = s.workshop_id
       WHERE s.id = ?`,
      [id],
    );
    if (!row) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    return { ...toSession(row), workshopTitle: row.workshop_title };
  }

  create(input: CreateSessionInput): Promise<Session> {
    return this.db.transaction(async () => {
      const workshop = await this.db.get<{ id: number }>('SELECT id FROM workshops WHERE id = ?', [
        input.workshopId,
      ]);
      if (!workshop) {
        throw new NotFoundException(`Workshop ${input.workshopId} not found`);
      }

      const { lastID } = await this.db.run(
        'INSERT INTO sessions (workshop_id, starts_at, location, capacity) VALUES (?, ?, ?, ?)',
        [input.workshopId, input.startsAt.toISOString(), input.location, input.capacity],
      );
      return toSession(await this.requireRow(lastID));
    });
  }

  remove(id: number): Promise<void> {
    return this.db.transaction(async () => {
      await this.requireRow(id);

      const registrations = await this.db.get<{ count: number }>(
        'SELECT COUNT(*) AS count FROM registrations WHERE session_id = ?',
        [id],
      );
      if (registrations && registrations.count > 0) {
        throw new ConflictException(
          `Session ${id} has ${registrations.count} registration(s) and cannot be deleted`,
        );
      }

      await this.db.run('DELETE FROM sessions WHERE id = ?', [id]);
    });
  }

  private async requireRow(id: number): Promise<SessionRow> {
    const row = await this.db.get<SessionRow>(
      `SELECT id, workshop_id, starts_at, location, capacity, seats_taken, status
       FROM sessions WHERE id = ?`,
      [id],
    );
    if (!row) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    return row;
  }
}
