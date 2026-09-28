import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Database } from 'sqlite3';
import { SCHEMA } from './schema';
import { countRows, seedDatabase } from './seed';

export interface RunResult {
  lastID: number;
  changes: number;
}

const DEFAULT_DB_PATH = 'data/app.db';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db!: Database;
  private txQueue: Promise<unknown> = Promise.resolve();

  async onModuleInit(): Promise<void> {
    const path = process.env.DB_PATH ?? DEFAULT_DB_PATH;
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.db = await openDatabase(path);
    await this.exec('PRAGMA foreign_keys = ON');
    await this.exec(SCHEMA);

    const seeded = await seedDatabase(this);
    const counts = Object.entries((await countRows(this)) ?? {})
      .map(([table, count]) => `${table}=${count}`)
      .join(' ');
    this.logger.log(`${seeded ? 'Seeded' : 'Existing data in'} ${path}: ${counts}`);
  }

  onModuleDestroy(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => (err ? reject(err) : resolve()));
    });
  }

  run(sql: string, params: unknown[] = []): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get<T>(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
  }

  all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all<T>(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
  }

  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => (err ? reject(err) : resolve()));
    });
  }

  transaction<T>(work: () => Promise<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      await this.run('BEGIN TRANSACTION');
      try {
        const result = await work();
        await this.run('COMMIT');
        return result;
      } catch (err) {
        await this.run('ROLLBACK');
        throw err;
      }
    };
    const next = this.txQueue.then(execute, execute);
    this.txQueue = next.catch(() => undefined);
    return next;
  }
}

function openDatabase(path: string): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new Database(path, (err) => (err ? reject(err) : resolve(db)));
  });
}
