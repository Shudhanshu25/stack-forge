// Auth flow: log in, read the current user, rotate the refresh token. Password hashing (argon2)
// dominates, so this measures how many logins per second the API can verify.
//
//   k6 run evaluation/load/auth.js                      (VUS, DURATION to change the load)
//
// Two scenarios:
//   throughput  every iteration poses as a different client (distinct X-Forwarded-For), so the
//               per-IP auth rate limit does not apply: measures argon2-bound capacity.
//   ratelimit   one client sends 25 logins: the API allows 20 per 15 minutes, then answers 429.
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';
import { BASE_URL, PASSWORD, json, register } from './lib.js';

const VUS = Number(__ENV.VUS || 20);
const loginTime = new Trend('login_duration', true);
const flowTime = new Trend('auth_flow_duration', true);
const rateLimited = new Counter('rate_limited_logins');
const allowedBeforeLimit = new Counter('logins_allowed_before_limit');

export const options = {
  scenarios: {
    throughput: {
      executor: 'constant-vus',
      vus: VUS,
      duration: __ENV.DURATION || '60s',
      exec: 'throughput',
    },
    ratelimit: { executor: 'per-vu-iterations', vus: 1, iterations: 1, exec: 'ratelimit' },
  },
  thresholds: {
    'checks{scenario:throughput}': ['rate>0.99'],
    login_duration: ['p(95)<2000'],
    rate_limited_logins: ['count>=1'],
  },
};

export function setup() {
  const users = [];
  for (let n = 0; n < VUS; n++) users.push(register(n, 'auth'));
  return { users };
}

export function throughput({ users }) {
  const user = users[(exec.vu.idInTest - 1) % users.length];
  // A fresh client address per iteration (172.16-31.x.x; setup registers from 10.x.x.x).
  const ip = `172.${16 + (exec.vu.idInTest % 16)}.${(exec.vu.iterationInScenario >> 8) & 255}.${exec.vu.iterationInScenario & 255}`;
  const started = Date.now();

  const login = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: user.email, password: PASSWORD }),
    json(null, ip),
  );
  loginTime.add(login.timings.duration);
  if (!check(login, { 'login 200': (r) => r.status === 200 })) return;

  const me = http.get(`${BASE_URL}/auth/me`, json(login.json('accessToken'), ip));
  check(me, { 'me 200': (r) => r.status === 200 });

  // The refresh cookie is Secure; inside the Docker network k6 speaks plain HTTP, so send it
  // explicitly instead of relying on the cookie jar.
  const cookie = login.cookies.sf_refresh && login.cookies.sf_refresh[0];
  const params = json(null, ip);
  params.headers.Cookie = `sf_refresh=${cookie ? cookie.value : ''}`;
  const refresh = http.post(`${BASE_URL}/auth/refresh`, null, params);
  check(refresh, { 'refresh 200': (r) => r.status === 200 });
  flowTime.add(Date.now() - started);
}

export function ratelimit({ users }) {
  const ip = `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  for (let i = 0; i < 25; i++) {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: users[0].email, password: PASSWORD }),
      json(null, ip),
    );
    if (res.status === 429) rateLimited.add(1);
    else if (res.status === 200) allowedBeforeLimit.add(1);
  }
}
