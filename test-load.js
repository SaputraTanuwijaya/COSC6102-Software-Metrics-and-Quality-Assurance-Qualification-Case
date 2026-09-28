import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3030';

export const options = {
  stages: [
    { duration: '15s', target: 50 },
    { duration: '30s', target: 50 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<250'],
    http_req_failed: ['rate<0.02'],
  },
};

export default function () {
  const response = http.get(`${BASE_URL}/workshops`);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'body is the workshop catalog': (r) => r.status === 200 && Array.isArray(r.json()),
  });

  sleep(0.5);
}
