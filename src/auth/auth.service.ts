import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import type { JwtPayload, Role } from './auth.types';
import { verifyPassword } from './password';

interface UserRow {
  id: number;
  password_hash: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.db.get<UserRow>(
      'SELECT id, password_hash, role FROM users WHERE email = ?',
      [email],
    );
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = { sub: user.id, role: user.role };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
