import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

function routeOf(request: Request): string {
  const route: unknown = request.route;
  if (typeof route === 'object' && route !== null && 'path' in route && typeof route.path === 'string') {
    return route.path;
  }
  return 'unmatched';
}

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    response.on('finish', () => {
      this.metrics.recordRequest(request.method, routeOf(request), response.statusCode);
    });
    next();
  }
}
