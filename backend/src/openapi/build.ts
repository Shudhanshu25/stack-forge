import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { sharedDir } from '../contracts.js';
import { ROUTES, type RouteDoc } from './catalog.js';

type Json = Record<string, unknown>;

const schemasDir = path.join(sharedDir, 'schemas');

/** Component name for a schema file: its title, e.g. simulation-job.schema.json -> SimulationJob. */
function loadSchemas(): Map<string, { name: string; schema: Json }> {
  const byFile = new Map<string, { name: string; schema: Json }>();
  for (const file of readdirSync(schemasDir).filter((f) => f.endsWith('.schema.json'))) {
    const schema = JSON.parse(readFileSync(path.join(schemasDir, file), 'utf8')) as Json;
    const name = String(schema.title ?? file.replace('.schema.json', ''));
    byFile.set(file, { name, schema });
  }
  return byFile;
}

/** Rewrites file references into references inside the OpenAPI document. */
function rewrite(node: unknown, self: string, names: Map<string, string>): unknown {
  if (Array.isArray(node)) return node.map((n) => rewrite(n, self, names));
  if (!node || typeof node !== 'object') return node;
  const out: Json = {};
  for (const [key, value] of Object.entries(node as Json)) {
    if (key === '$schema' || key === '$id') continue;
    if (key === '$ref' && typeof value === 'string') {
      const [file, pointer = ''] = value.split('#');
      const target = file ? names.get(file) : self;
      if (!target) throw new Error(`Unresolvable $ref ${value} in ${self}`);
      out.$ref = `#/components/schemas/${target}${pointer}`;
      continue;
    }
    out[key] = rewrite(value, self, names);
  }
  return out;
}

function operation(route: RouteDoc, names: Map<string, string>): Json {
  const ref = (id: string) => ({ $ref: `#/components/schemas/${names.get(id)}` });
  const responses: Json = {};
  for (const [status, schema] of Object.entries(route.responses)) {
    responses[status] =
      schema === null
        ? { description: 'No content' }
        : schema === 'binary'
          ? {
              description: 'File download',
              content: {
                'application/json': {},
                'text/csv': {},
                'application/pdf': { schema: { type: 'string', format: 'binary' } },
              },
            }
          : { description: 'OK', content: { 'application/json': { schema: ref(schema) } } };
  }
  const error = { content: { 'application/json': { schema: ref('api-error.schema.json') } } };
  if (route.body) responses['400'] = { description: 'Validation failed', ...error };
  if (route.auth === 'user' || route.auth === 'admin' || route.auth === 'refresh-cookie') {
    responses['401'] = { description: 'Not authenticated', ...error };
  }
  if (route.auth === 'admin') responses['403'] = { description: 'Not an admin', ...error };
  if (route.path.includes('{id}')) responses['404'] = { description: 'Not found', ...error };
  responses.default = { description: 'Error', ...error };

  const parameters: Json[] = [];
  if (route.path.includes('{id}')) {
    parameters.push({ name: 'id', in: 'path', required: true, schema: { type: 'string' } });
  }
  if (route.idempotent) {
    parameters.push({
      name: 'Idempotency-Key',
      in: 'header',
      required: false,
      description:
        'Repeat a request with the same key to get the original job back instead of a second turn. 1-128 of [A-Za-z0-9._:-].',
      schema: { type: 'string', maxLength: 128 },
    });
  }
  return {
    tags: [route.tag],
    summary: route.summary,
    operationId: `${route.method}${route.path.replace(/[{}]/g, '').replace(/\/(.)/g, (_, c: string) => c.toUpperCase())}`,
    ...(parameters.length ? { parameters } : {}),
    ...(route.body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: ref(route.body) } },
          },
        }
      : {}),
    responses,
    security:
      route.auth === 'user' || route.auth === 'admin'
        ? [{ bearer: [] }]
        : route.auth === 'refresh-cookie'
          ? [{ refreshCookie: [] }]
          : [],
  };
}

/** The Node API's OpenAPI 3.1 document, assembled from the route catalog and shared schemas. */
export function buildOpenApi(version: string): Json {
  const schemas = loadSchemas();
  const names = new Map([...schemas].map(([file, { name }]) => [file, name]));
  const components: Json = {};
  for (const { name, schema } of schemas.values()) components[name] = rewrite(schema, name, names);

  const paths: Record<string, Json> = {};
  for (const route of ROUTES) {
    paths[route.path] = { ...(paths[route.path] ?? {}), [route.method]: operation(route, names) };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Stack Forge API',
      version,
      description:
        'Public REST API. Bodies are JSON in camelCase, money is integer paise, and every error has the shape { error: { code, message, details } }. Live turn events: WebSocket at /api/v1/ws.',
    },
    servers: [{ url: '/api/v1' }],
    paths,
    components: {
      schemas: components,
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        refreshCookie: { type: 'apiKey', in: 'cookie', name: 'sf_refresh' },
      },
    },
  };
}
