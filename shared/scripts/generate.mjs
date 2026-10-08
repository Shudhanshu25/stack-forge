// Regenerates TypeScript types and Python (pydantic v2) models from shared/schemas.
// Usage: npm run generate   (from the repo root or from /shared)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const sharedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemasDir = path.join(sharedDir, 'schemas');
const tsOut = path.join(sharedDir, 'generated', 'ts');
const pyOut = path.join(sharedDir, 'python', 'stackforge_shared', 'models');
const repoRoot = path.resolve(sharedDir, '..');

const banner =
  'Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`.';

async function generateTypeScript() {
  const files = readdirSync(schemasDir)
    .filter((f) => f.endsWith('.schema.json'))
    .sort();
  // One root schema that references every contract, so each type is declared exactly once.
  const properties = {};
  for (const file of files) {
    const schema = JSON.parse(readFileSync(path.join(schemasDir, file), 'utf8'));
    if (file === 'enums.schema.json') {
      for (const name of Object.keys(schema.definitions)) {
        properties[`enum${name}`] = { $ref: `enums.schema.json#/definitions/${name}` };
      }
    } else {
      properties[schema.title] = { $ref: file };
    }
  }
  const root = {
    title: 'StackForgeContracts',
    type: 'object',
    additionalProperties: false,
    properties,
  };
  const ts = await compile(root, 'StackForgeContracts', {
    cwd: schemasDir,
    bannerComment: `/* eslint-disable */\n/** ${banner} */`,
    additionalProperties: false,
    unreachableDefinitions: true,
    ignoreMinAndMaxItems: true, // Ajv enforces the limits; tuples would be unusable types
    style: { singleQuote: true, printWidth: 100, trailingComma: 'all' },
  });
  mkdirSync(tsOut, { recursive: true });
  writeFileSync(path.join(tsOut, 'index.d.ts'), ts);
  console.log(`TypeScript types -> ${path.relative(repoRoot, tsOut)}/index.d.ts`);
}

function findPython() {
  const candidates = [
    path.join(repoRoot, 'simulation', '.venv', 'Scripts', 'python.exe'),
    path.join(repoRoot, 'simulation', '.venv', 'bin', 'python'),
  ];
  return candidates.find((p) => existsSync(p)) ?? process.env.PYTHON ?? 'python';
}

function generatePython() {
  rmSync(pyOut, { recursive: true, force: true });
  const args = [
    '-m',
    'datamodel_code_generator',
    '--input',
    schemasDir,
    '--input-file-type',
    'jsonschema',
    '--output',
    pyOut,
    '--output-model-type',
    'pydantic_v2.BaseModel',
    '--target-python-version',
    '3.12',
    '--snake-case-field',
    '--allow-population-by-field-name',
    '--use-title-as-name',
    '--use-standard-collections',
    '--use-union-operator',
    '--use-schema-description',
    '--field-constraints',
    '--collapse-root-models',
    '--disable-timestamp',
    '--formatters',
    'black',
    'isort',
    '--custom-file-header',
    `# ${banner}`,
  ];
  const result = spawnSync(findPython(), args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(
      'Python model generation failed. Create simulation/.venv and install simulation/requirements-dev.txt first.',
    );
  }
  console.log(`Python models    -> ${path.relative(repoRoot, pyOut)}/`);
}

await generateTypeScript();
generatePython();
