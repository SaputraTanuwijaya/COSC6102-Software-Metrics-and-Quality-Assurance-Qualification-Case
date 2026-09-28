import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Session, SessionRow, toSession } from '../sessions/sessions.service';

interface WorkshopRow {
  id: number;
  title: string;
  description: string | null;
  instructor_id: number;
  instructor_name: string;
  instructor_expertise: string;
}

export interface Workshop {
  id: number;
  title: string;
  description: string | null;
  instructor: { id: number; name: string; expertise: string };
  sessions: Session[];
}

@Injectable()
export class WorkshopsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<Workshop[]> {
    const [workshops, sessions] = await Promise.all([
      this.db.all<WorkshopRow>(
        `SELECT w.id, w.title, w.description,
                i.id AS instructor_id, i.name AS instructor_name, i.expertise AS instructor_expertise
         FROM workshops w
         JOIN instructors i ON i.id = w.instructor_id
         ORDER BY w.id`,
      ),
      this.db.all<SessionRow>(
        `SELECT id, workshop_id, starts_at, location, capacity, seats_taken, status
         FROM sessions
         ORDER BY starts_at`,
      ),
    ]);

    return workshops.map((workshop) => ({
      id: workshop.id,
      title: workshop.title,
      description: workshop.description,
      instructor: {
        id: workshop.instructor_id,
        name: workshop.instructor_name,
        expertise: workshop.instructor_expertise,
      },
      sessions: sessions.filter((session) => session.workshop_id === workshop.id).map(toSession),
    }));
  }
}
