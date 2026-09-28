import { BadRequestException } from '@nestjs/common';

export type JsonObject = Record<string, unknown>;

const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function requireObject(body: unknown): JsonObject {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Request body must be a JSON object');
  }
  return body as JsonObject;
}

export function requirePositiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return value;
}

export function parseIdParam(value: string, field = 'id'): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return requirePositiveInt(Number(value), field);
}

export function requireIntInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${field} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function requireString(value: unknown, field: string, maxLength?: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`${field} must be a non-empty string`);
  }
  if (maxLength !== undefined && value.length > maxLength) {
    throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
  }
  return value;
}

export function requireEmail(value: unknown, field = 'email'): string {
  const email = requireString(value, field, 254).trim().toLowerCase();
  if (!email.includes('@')) {
    throw new BadRequestException(`${field} must be a valid email address`);
  }
  return email;
}

export function requireIsoDate(value: unknown, field: string): Date {
  const match = typeof value === 'string' ? ISO_DATE_TIME.exec(value) : null;
  if (!match) {
    throw new BadRequestException(
      `${field} must be an ISO 8601 date-time with a timezone, e.g. 2026-12-01T09:00:00Z`,
    );
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const calendarDay = new Date(Date.UTC(year, month - 1, day));
  const date = new Date(match[0]);
  if (
    Number.isNaN(date.getTime()) ||
    calendarDay.getUTCMonth() !== month - 1 ||
    calendarDay.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${field} is not a real date`);
  }
  return date;
}
