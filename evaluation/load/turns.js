// Playing turns in rules mode: each virtual user owns a simulation and plays turns back to back
// (submit with an Idempotency-Key, poll the job until it finishes). Measures time from submit to
// completed turn, and how throughput holds as simulations run concurrently.
//
// A simulation that runs out of cash goes bankrupt and refuses further turns (game rules, not a
// system failure): the virtual user then starts a new simulation and carries on.
//
//   k6 run evaluation/load/turns.js                     (VUS, DURATION to change the load)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';
import { BASE_URL, json, register, startSimulation, uuid } from './lib.js';

const turnTime = new Trend('turn_completion', true);
const turnsCompleted = new Counter('turns_completed');
const turnsFailed = new Counter('turns_failed');
const bankruptcies = new Counter('simulations_bankrupt');

export const options = {
  scenarios: {
    turns: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || '90s',
    },
  },
  thresholds: {
    turns_failed: ['count==0'],
    turn_completion: ['p(95)<5000'],
  },
};

export function setup() {
  const users = [];
  for (let n = 0; n < Number(__ENV.VUS || 10); n++) {
    const user = register(n, 'turns');
    users.push({ ...user, simulationId: startSimulation(user, 1000 + n) });
  }
  return { users };
}

const current = {}; // this VU's simulation, replaced after a bankruptcy

function replaceIfBankrupt(user, code) {
  if (code !== 'SIMULATION_NOT_ACTIVE' && code !== 'SIMULATION_BANKRUPT') return false;
  bankruptcies.add(1);
  current.id = startSimulation(user, 2000 + exec.vu.iterationInScenario);
  return true;
}

export default function ({ users }) {
  const user = users[(exec.vu.idInTest - 1) % users.length];
  current.id = current.id || user.simulationId;
  const params = json(user.token);
  params.headers['Idempotency-Key'] = uuid();

  const started = Date.now();
  const submit = http.post(
    `${BASE_URL}/simulations/${current.id}/turns`,
    JSON.stringify({ decisions: [] }),
    params,
  );
  if (submit.status !== 202) {
    const code = submit.json('error.code');
    if (replaceIfBankrupt(user, code)) return;
    check(submit, { 'turn accepted': () => false });
    turnsFailed.add(1, { code: String(code || submit.status) });
    sleep(1);
    return;
  }
  const jobId = submit.json('jobId');
  for (let i = 0; i < 300; i++) {
    const job = http.get(`${BASE_URL}/jobs/${jobId}`, {
      ...json(user.token),
      tags: { name: 'GET /jobs/:id' },
    });
    const status = job.json('status');
    if (status === 'COMPLETED') {
      turnTime.add(Date.now() - started);
      turnsCompleted.add(1);
      return;
    }
    if (status === 'FAILED' || status === 'CANCELLED') {
      const code = job.json('error.code');
      if (!replaceIfBankrupt(user, code)) turnsFailed.add(1, { code: String(code || status) });
      return;
    }
    sleep(0.1);
  }
  turnsFailed.add(1, { code: 'TIMEOUT' });
}
