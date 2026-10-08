import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type {
  DifficultyPresets,
  EventCatalog,
  Industry,
  IndustryTemplate,
} from '@stackforge/shared';
import { check, sharedDir } from '../../contracts.js';

const templatesDir = path.join(sharedDir, 'templates');

export interface TemplateCatalog {
  list(): IndustryTemplate[];
  get(industry: Industry): IndustryTemplate;
  difficultyPresets: DifficultyPresets;
  eventCatalog: EventCatalog;
}

function readValidated<T>(file: string, schema: Parameters<typeof check>[0]): T {
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const issues = check(schema, data);
  if (issues) throw new Error(`${file} is invalid: ${JSON.stringify(issues)}`);
  return data as T;
}

/** Loads and validates the industry templates, difficulty presets and event catalog. */
export function loadTemplateCatalog(): TemplateCatalog {
  const byIndustry = new Map<Industry, IndustryTemplate>();
  for (const file of readdirSync(path.join(templatesDir, 'industries')).sort()) {
    const template = readValidated<IndustryTemplate>(
      path.join(templatesDir, 'industries', file),
      'industry-template.schema.json',
    );
    byIndustry.set(template.industry, template);
  }
  const difficultyPresets = readValidated<DifficultyPresets>(
    path.join(templatesDir, 'difficulty.json'),
    'difficulty-presets.schema.json',
  );

  return {
    list: () => [...byIndustry.values()],
    get: (industry) => {
      const template = byIndustry.get(industry);
      if (!template) throw new Error(`No template for industry ${industry}`);
      return template;
    },
    difficultyPresets,
    eventCatalog: readValidated<EventCatalog>(
      path.join(templatesDir, 'events.json'),
      'event-catalog.schema.json',
    ),
  };
}
