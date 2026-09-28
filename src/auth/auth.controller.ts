import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { requireEmail, requireObject, requireString } from '../common/validation';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown): Promise<{ accessToken: string }> {
    const input = requireObject(body);
    const email = requireEmail(input.email);
    const password = requireString(input.password, 'password');
    return this.authService.login(email, password);
  }
}
