import { hashPassword } from '../auth/password';
import type { DatabaseService } from './database.service';

export interface TableCounts {
  users: number;
  instructors: number;
  workshops: number;
  sessions: number;
  registrations: number;
}

const ADMIN = { name: 'Admin', email: 'admin@workshop.local', password: 'Admin123!' };

const PARTICIPANT_PASSWORD = 'Participant123!';
const PARTICIPANTS = {
  alice: 'Alice Wijaya',
  budi: 'Budi Santoso',
  citra: 'Citra Lestari',
  dewi: 'Dewi Anggraini',
} as const;

type ParticipantKey = keyof typeof PARTICIPANTS;

const INSTRUCTORS = [
  { name: 'Rina Hartono', expertise: 'Software Testing & QA' },
  { name: 'Agus Pratama', expertise: 'Backend Development' },
  { name: 'Maya Kusuma', expertise: 'DevOps & Observability' },
];

const WORKSHOPS = [
  {
    title: 'Selenium WebDriver Fundamentals',
    description: 'Automate browser flows with locators, explicit waits and assertions.',
    instructor: 0,
  },
  {
    title: 'Building REST APIs with NestJS',
    description: 'Modules, controllers, services, guards and raw SQL persistence.',
    instructor: 1,
  },
  {
    title: 'Load Testing with k6',
    description: 'Stages, thresholds and reading p95 latency under load.',
    instructor: 2,
  },
  {
    title: 'Monitoring with Prometheus and Grafana',
    description: 'Expose metrics, scrape them and build dashboards.',
    instructor: 2,
  },
];

interface SessionSeed {
  workshop: number;
  inDays: number;
  location: string;
  capacity: number;
  status?: 'open' | 'cancelled' | 'completed';
  registered: ParticipantKey[];
  cancelled?: ParticipantKey[];
}

const SESSIONS: SessionSeed[] = [
  { workshop: 0, inDays: 14, location: 'Lab A, Jakarta', capacity: 20, registered: ['alice', 'budi'] },
  { workshop: 0, inDays: 28, location: 'Online (Zoom)', capacity: 30, registered: ['citra'] },
  { workshop: 1, inDays: 10, location: 'Lab B, Jakarta', capacity: 2, registered: ['alice', 'citra'] },
  { workshop: 1, inDays: 35, location: 'Online (Zoom)', capacity: 25, registered: [] },
  {
    workshop: 2,
    inDays: 21,
    location: 'Lab A, Jakarta',
    capacity: 15,
    registered: ['dewi'],
    cancelled: ['budi'],
  },
  { workshop: 3, inDays: 18, location: 'Lab C, Bandung', capacity: 12, registered: ['budi'] },
  {
    workshop: 3,
    inDays: 42,
    location: 'Online (Zoom)',
    capacity: 40,
    status: 'cancelled',
    registered: [],
  },
];

function daysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(9, 0, 0, 0);
  return date.toISOString();
}

export async function seedDatabase(db: DatabaseService): Promise<boolean> {
  const existing = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM users');
  if (existing && existing.count > 0) {
    return false;
  }

  const participantKeys = Object.keys(PARTICIPANTS) as ParticipantKey[];
  const adminHash = await hashPassword(ADMIN.password);
  const participantHashes = await Promise.all(
    participantKeys.map(() => hashPassword(PARTICIPANT_PASSWORD)),
  );

  await db.transaction(async () => {
    const { lastID: adminId } = await db.run(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`,
      [ADMIN.name, ADMIN.email, adminHash],
    );

    const userIds = new Map<ParticipantKey, number>();
    for (const [index, key] of participantKeys.entries()) {
      const { lastID } = await db.run(
        `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'participant')`,
        [PARTICIPANTS[key], `${key}@workshop.local`, participantHashes[index]],
      );
      userIds.set(key, lastID);
    }

    const instructorIds: number[] = [];
    for (const instructor of INSTRUCTORS) {
      const { lastID } = await db.run('INSERT INTO instructors (name, expertise) VALUES (?, ?)', [
        instructor.name,
        instructor.expertise,
      ]);
      instructorIds.push(lastID);
    }

    const workshopIds: number[] = [];
    for (const workshop of WORKSHOPS) {
      const { lastID } = await db.run(
        'INSERT INTO workshops (title, description, instructor_id, created_by) VALUES (?, ?, ?, ?)',
        [workshop.title, workshop.description, instructorIds[workshop.instructor], adminId],
      );
      workshopIds.push(lastID);
    }

    for (const session of SESSIONS) {
      const { lastID: sessionId } = await db.run(
        'INSERT INTO sessions (workshop_id, starts_at, location, capacity, status) VALUES (?, ?, ?, ?, ?)',
        [
          workshopIds[session.workshop],
          daysFromNow(session.inDays),
          session.location,
          session.capacity,
          session.status ?? 'open',
        ],
      );
      const registrations = [
        ...session.registered.map((key) => ({ key, status: 'registered' })),
        ...(session.cancelled ?? []).map((key) => ({ key, status: 'cancelled' })),
      ];
      for (const registration of registrations) {
        await db.run('INSERT INTO registrations (session_id, user_id, status) VALUES (?, ?, ?)', [
          sessionId,
          userIds.get(registration.key),
          registration.status,
        ]);
      }
    }

    await db.run(
      `UPDATE sessions SET seats_taken = (
         SELECT COUNT(*) FROM registrations r
         WHERE r.session_id = sessions.id AND r.status IN ('registered', 'attended')
       )`,
    );
  });

  return true;
}

export function countRows(db: DatabaseService): Promise<TableCounts | undefined> {
  return db.get<TableCounts>(
    `SELECT
       (SELECT COUNT(*) FROM users)         AS users,
       (SELECT COUNT(*) FROM instructors)   AS instructors,
       (SELECT COUNT(*) FROM workshops)     AS workshops,
       (SELECT COUNT(*) FROM sessions)      AS sessions,
       (SELECT COUNT(*) FROM registrations) AS registrations`,
  );
}
