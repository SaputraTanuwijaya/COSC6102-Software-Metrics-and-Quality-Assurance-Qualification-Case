import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly httpRequests = new Counter({
    name: 'http_requests_total',
    help: 'HTTP requests handled, by method, route and status code',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  private readonly uptime = new Gauge({
    name: 'process_uptime_seconds_total',
    help: 'Seconds since the process started (process.uptime())',
    registers: [this.registry],
    collect() {
      this.set(process.uptime());
    },
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  recordRequest(method: string, route: string, status: number): void {
    this.httpRequests.inc({ method, route, status: String(status) });
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
