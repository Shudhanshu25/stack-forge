import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import addFormatsModule from 'ajv-formats';

// ajv-formats is CommonJS; under NodeNext its default export is the module object.
const addFormats = addFormatsModule as unknown as typeof addFormatsModule.default;

export const sharedDir = path.dirname(
  createRequire(import.meta.url).resolve('@stackforge/shared/package.json'),
);
const schemasDir = path.join(sharedDir, 'schemas');

export type SchemaId =
  | 'account-delete-request.schema.json'
  | 'admin-stats.schema.json'
  | 'advice-request.schema.json'
  | 'advisor-request.schema.json'
  | 'agent-effects.schema.json'
  | 'ai-advice.schema.json'
  | 'api-error.schema.json'
  | 'auth-options.schema.json'
  | 'auth-response.schema.json'
  | 'data-export.schema.json'
  | 'decision-preview.schema.json'
  | 'decision-rejection.schema.json'
  | 'decision-result.schema.json'
  | 'decision.schema.json'
  | 'decisions-request.schema.json'
  | 'difficulty-modifiers.schema.json'
  | 'difficulty-presets.schema.json'
  | 'engine-analytics-request.schema.json'
  | 'engine-info-response.schema.json'
  | 'engine-preview-request.schema.json'
  | 'engine-replay-request.schema.json'
  | 'engine-replay-response.schema.json'
  | 'engine-scenario-request.schema.json'
  | 'engine-start-request.schema.json'
  | 'engine-start-response.schema.json'
  | 'estimated-effect.schema.json'
  | 'event-catalog.schema.json'
  | 'forecast.schema.json'
  | 'health-response.schema.json'
  | 'health-services-response.schema.json'
  | 'industry-template-list-response.schema.json'
  | 'industry-template.schema.json'
  | 'llm-call.schema.json'
  | 'llm-usage-summary.schema.json'
  | 'location-catalog.schema.json'
  | 'location-profile-request.schema.json'
  | 'location-profile.schema.json'
  | 'location.schema.json'
  | 'login-request.schema.json'
  | 'market-event.schema.json'
  | 'password-reset-confirm-request.schema.json'
  | 'password-reset-request.schema.json'
  | 'password-reset-verify-request.schema.json'
  | 'password-reset-verify-response.schema.json'
  | 'pipeline-event.schema.json'
  | 'pipeline-turn-request.schema.json'
  | 'product.schema.json'
  | 'register-request.schema.json'
  | 'scenario-branch-input.schema.json'
  | 'scenario-comparison.schema.json'
  | 'scenario-request.schema.json'
  | 'session-list-response.schema.json'
  | 'session.schema.json'
  | 'simulation-analytics.schema.json'
  | 'simulation-job.schema.json'
  | 'simulation-list-response.schema.json'
  | 'simulation-parameters.schema.json'
  | 'simulation-start-request.schema.json'
  | 'simulation-state.schema.json'
  | 'simulation-turn.schema.json'
  | 'simulation.schema.json'
  | 'startup-configuration.schema.json'
  | 'startup-create-request.schema.json'
  | 'startup-list-response.schema.json'
  | 'startup-profile.schema.json'
  | 'startup-update-request.schema.json'
  | 'startup.schema.json'
  | 'turn-list-response.schema.json'
  | 'turn-summary.schema.json'
  | 'user.schema.json'
  | 'verify-email-request.schema.json'
  | 'ws-client-message.schema.json'
  | 'ws-server-message.schema.json'
  | 'ws-server-message.schema.json';

export interface ValidationIssue {
  path: string;
  message: string;
}

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
for (const file of readdirSync(schemasDir).filter((f) => f.endsWith('.schema.json'))) {
  ajv.addSchema(JSON.parse(readFileSync(path.join(schemasDir, file), 'utf8')));
}

function validator(id: SchemaId): ValidateFunction {
  const validate = ajv.getSchema(id);
  if (!validate) throw new Error(`Unknown schema ${id}`);
  return validate;
}

function toIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((e) => {
    const base = e.instancePath || '/';
    if (e.keyword === 'additionalProperties') {
      return { path: base, message: `unknown field "${String(e.params.additionalProperty)}"` };
    }
    if (e.keyword === 'required') {
      return { path: base, message: `missing field "${String(e.params.missingProperty)}"` };
    }
    return { path: base, message: e.message ?? 'is invalid' };
  });
}

/** Validates data against a shared schema. Returns null when valid, otherwise the issues. */
export function check(id: SchemaId, data: unknown): ValidationIssue[] | null {
  const validate = validator(id);
  return validate(data) ? null : toIssues(validate.errors);
}
