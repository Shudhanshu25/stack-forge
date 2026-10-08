// Shared helpers for the k6 load tests. Run against the API directly (not through the proxy):
// BASE_URL defaults to http://api:4000/api/v1, the address inside the production Docker network.
import http from 'k6/http';
import { check, fail } from 'k6';
import exec from 'k6/execution';

export const BASE_URL = __ENV.BASE_URL || 'http://api:4000/api/v1';
export const PASSWORD = 'Load-test-Password-42';

export const STARTUP = {
  name: 'LoadCo',
  industry: 'SAAS',
  businessModel: 'SUBSCRIPTION',
  // ₹100 crore: enough runway that simulations do not go bankrupt during a test.
  initialCapital: 10000000000,
  product: { name: 'Load', description: 'Load test' },
  initialPrice: 49900,
  marketSize: 200000,
  difficulty: 'NORMAL',
  location: { country: 'IN', state: 'KA', city: 'Bengaluru', cityId: 'bengaluru', tier: 'METRO' },
};

/**
 * The API rate-limits /auth per client IP. All k6 virtual users share one IP, so each sends a
 * distinct X-Forwarded-For (honoured with TRUST_PROXY=1) to stand in for separate users. Through
 * the real proxy this header cannot be forged; the auth limit itself is measured separately.
 */
export function clientIp(n) {
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
}

export function json(token, ip) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ip) headers['X-Forwarded-For'] = ip;
  return { headers };
}

// Each run registers from its own address range, so consecutive runs do not hit the per-IP
// auth limit left over from the previous run.
const RUN_BASE = Math.floor(Math.random() * 4000000) * 4;

export function register(n, tag) {
  const email = `load-${tag}-${n}-${Date.now()}@example.com`;
  const res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password: PASSWORD, name: `Load ${n}` }),
    json(null, clientIp(RUN_BASE + n)),
  );
  if (!check(res, { registered: (r) => r.status === 201 })) {
    fail(`register failed: ${res.status} ${res.body}`);
  }
  return { email, token: res.json('accessToken'), ip: clientIp(RUN_BASE + n) };
}

export function startSimulation(user, seed) {
  const startup = http.post(`${BASE_URL}/startups`, JSON.stringify(STARTUP), json(user.token));
  const sim = http.post(
    `${BASE_URL}/startups/${startup.json('id')}/simulation`,
    JSON.stringify({ seed, agentMode: 'rules' }),
    json(user.token),
  );
  if (sim.status !== 201) fail(`start failed: ${sim.status} ${sim.body}`);
  return sim.json('id');
}

export function uuid() {
  return `${exec.vu.idInTest}-${exec.vu.iterationInScenario}-${Math.random().toString(36).slice(2)}`;
}
