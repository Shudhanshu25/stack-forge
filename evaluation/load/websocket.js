// Concurrent WebSocket subscribers: SUBSCRIBERS sockets (several per simulation) authenticate
// and subscribe while a driver plays turns on those simulations. Measures connect time,
// subscribe time and how long after a turn is submitted each subscriber sees it complete.
//
//   k6 run evaluation/load/websocket.js                 (SUBSCRIBERS, SIMULATIONS, DURATION)
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';
import { BASE_URL, json, register, startSimulation, uuid } from './lib.js';

const SUBSCRIBERS = Number(__ENV.SUBSCRIBERS || 200);
const SIMULATIONS = Number(__ENV.SIMULATIONS || 10);
const DURATION_S = Number((__ENV.DURATION || '60s').replace('s', ''));
const WS_URL = (__ENV.WS_URL || BASE_URL.replace(/^http/, 'ws')) + '/ws';

const subscribeTime = new Trend('ws_subscribe_time', true);
const eventDelay = new Trend('ws_turn_complete_delay', true);
const completedSeen = new Counter('ws_completed_events');
const wsErrors = new Counter('ws_errors');

export const options = {
  scenarios: {
    subscribers: {
      executor: 'per-vu-iterations',
      vus: SUBSCRIBERS,
      iterations: 1,
      maxDuration: `${DURATION_S + 30}s`,
      exec: 'subscriber',
    },
    driver: {
      executor: 'constant-vus',
      vus: SIMULATIONS,
      duration: `${DURATION_S}s`,
      startTime: '5s',
      exec: 'driver',
    },
  },
  thresholds: {
    ws_errors: ['count==0'],
    ws_subscribe_time: ['p(95)<1000'],
  },
};

export function setup() {
  const sims = [];
  for (let n = 0; n < SIMULATIONS; n++) {
    const user = register(n, 'ws');
    sims.push({ token: user.token, simulationId: startSimulation(user, 5000 + n) });
  }
  return { sims };
}

export function subscriber({ sims }) {
  const sim = sims[(exec.vu.idInTest - 1) % sims.length];
  const opened = Date.now();
  const res = ws.connect(WS_URL, {}, (socket) => {
    socket.on('open', () => socket.send(JSON.stringify({ type: 'auth', token: sim.token })));
    socket.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'ready') {
        socket.send(JSON.stringify({ type: 'subscribe', simulationId: sim.simulationId }));
      } else if (msg.type === 'subscribed') {
        subscribeTime.add(Date.now() - opened);
      } else if (msg.type === 'job' && msg.job && msg.job.status === 'COMPLETED') {
        completedSeen.add(1);
        eventDelay.add(Date.now() - Date.parse(msg.job.createdAt));
      } else if (msg.type === 'error') {
        wsErrors.add(1);
      }
    });
    socket.on('error', () => wsErrors.add(1));
    socket.setTimeout(() => socket.close(), (DURATION_S + 10) * 1000);
  });
  check(res, { 'ws upgraded': (r) => r && r.status === 101 });
}

export function driver({ sims }) {
  const sim = sims[(exec.vu.idInTest - SUBSCRIBERS - 1 + sims.length) % sims.length];
  const params = json(sim.token);
  params.headers['Idempotency-Key'] = uuid();
  const submit = http.post(
    `${BASE_URL}/simulations/${sim.simulationId}/turns`,
    JSON.stringify({ decisions: [] }),
    params,
  );
  if (submit.status !== 202) {
    sleep(1);
    return;
  }
  const jobId = submit.json('jobId');
  for (let i = 0; i < 300; i++) {
    const status = http.get(`${BASE_URL}/jobs/${jobId}`, json(sim.token)).json('status');
    if (status !== 'QUEUED' && status !== 'RUNNING') break;
    sleep(0.2);
  }
  sleep(1);
}
