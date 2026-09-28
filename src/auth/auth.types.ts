import type { Request } from 'express';

export type Role = 'admin' | 'participant';

export interface JwtPayload {
  sub: number;
  role: Role;
}

export interface AuthUser {
  id: number;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'participant';
}
