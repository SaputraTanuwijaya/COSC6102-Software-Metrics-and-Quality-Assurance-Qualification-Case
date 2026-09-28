import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { DatabaseService } from '../database/database.service';
import type { Registration } from './registrations.service';

const OPEN_SESSION_ID = 4;
const FULL_SESSION_ID = 3;
const PARTICIPANT = { email: 'budi@workshop.local', password: 'Participant123!' };

describe('Registrations', () => {
  let app: INestApplication<App>;
  let db: DatabaseService;
  let participantToken: string;

  beforeAll(async () => {
    process.env.DB_PATH = ':memory:';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    db = app.get(DatabaseService);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(PARTICIPANT)
      .expect(200);
    participantToken = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  async function seatsTaken(sessionId: number): Promise<number | undefined> {
    const row = await db.get<{ seats_taken: number }>(
      'SELECT seats_taken FROM sessions WHERE id = ?',
      [sessionId],
    );
    return row?.seats_taken;
  }

  it('A. successful workflow: registering for an open session returns 201 and takes a seat', async () => {
    const seatsBefore = await seatsTaken(OPEN_SESSION_ID);

    const response = await request(app.getHttpServer())
      .post('/registrations')
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ sessionId: OPEN_SESSION_ID })
      .expect(201);

    const registration = response.body as Registration;
    expect(registration).toMatchObject({
      id: expect.any(Number),
      sessionId: OPEN_SESSION_ID,
      status: 'registered',
    });
    expect(await seatsTaken(OPEN_SESSION_ID)).toBe((seatsBefore ?? 0) + 1);

    const row = await db.get<{ status: string; email: string }>(
      `SELECT r.status, u.email FROM registrations r
       JOIN users u ON u.id = r.user_id
       WHERE r.id = ?`,
      [registration.id],
    );
    expect(row).toEqual({ status: 'registered', email: PARTICIPANT.email });
  });

  it('B. resource exhaustion: registering for a full session returns 400', async () => {
    await request(app.getHttpServer())
      .post('/registrations')
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ sessionId: FULL_SESSION_ID })
      .expect(400);

    expect(await seatsTaken(FULL_SESSION_ID)).toBe(2);
  });

  it('C. not found: requesting a session that does not exist returns 404', async () => {
    await request(app.getHttpServer()).get('/sessions/999999').expect(404);
  });

  it('D. access role guard: a participant creating a session returns 403', async () => {
    const countBefore = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM sessions');

    await request(app.getHttpServer())
      .post('/sessions')
      .set('Authorization', `Bearer ${participantToken}`)
      .send({
        workshopId: 1,
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Lab X',
        capacity: 10,
      })
      .expect(403);

    const countAfter = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM sessions');
    expect(countAfter).toEqual(countBefore);
  });
});
