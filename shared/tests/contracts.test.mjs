import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...parts) => JSON.parse(readFileSync(path.join(sharedDir, ...parts), 'utf8'));

function loadAjv() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const file of readdirSync(path.join(sharedDir, 'schemas'))) {
    ajv.addSchema(readJson('schemas', file));
  }
  return ajv;
}

test('every schema compiles in strict mode', () => {
  const ajv = loadAjv();
  for (const file of readdirSync(path.join(sharedDir, 'schemas'))) {
    assert.ok(ajv.getSchema(file), `${file} should compile`);
  }
});

test('every industry has exactly one valid template', () => {
  const ajv = loadAjv();
  const validate = ajv.getSchema('industry-template.schema.json');
  const industries = readJson('schemas', 'enums.schema.json').definitions.Industry.enum;
  const seen = new Map();
  for (const file of readdirSync(path.join(sharedDir, 'templates', 'industries'))) {
    const template = readJson('templates', 'industries', file);
    assert.ok(validate(template), `${file}: ${ajv.errorsText(validate.errors)}`);
    assert.ok(!seen.has(template.industry), `${template.industry} defined twice`);
    seen.set(template.industry, file);

    const mix = Object.values(template.parameters.segmentMix).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(mix - 1) < 1e-9, `${file}: segmentMix sums to ${mix}`);
  }
  assert.deepEqual([...seen.keys()].sort(), [...industries].sort());
});

test('event catalog is valid and covers every event type exactly once', () => {
  const ajv = loadAjv();
  const validate = ajv.getSchema('event-catalog.schema.json');
  const catalog = readJson('templates', 'events.json');
  assert.ok(validate(catalog), ajv.errorsText(validate.errors));
  const types = readJson('schemas', 'enums.schema.json').definitions.EventType.enum;
  assert.deepEqual(catalog.events.map((e) => e.type).sort(), [...types].sort());
});

test('every template affords at least five months of base costs with no revenue', () => {
  for (const file of readdirSync(path.join(sharedDir, 'templates', 'industries'))) {
    const { defaults, parameters: p } = readJson('templates', 'industries', file);
    const burn = p.initialEmployees * p.salaryPerEmployeeMonthly + p.fixedCostsMonthly;
    assert.ok(
      defaults.initialCapital / burn >= 5,
      `${file}: runway ${defaults.initialCapital / burn}`,
    );
  }
});

test('difficulty presets are valid', () => {
  const ajv = loadAjv();
  const validate = ajv.getSchema('difficulty-presets.schema.json');
  const presets = readJson('templates', 'difficulty.json');
  assert.ok(validate(presets), ajv.errorsText(validate.errors));
});
