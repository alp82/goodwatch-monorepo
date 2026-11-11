// Every server in the stack starts from an empty environment plus an explicit allowlist (the `env -i` rule).
// Nothing is read from any .env file. Before a spawn, every endpoint must be loopback and every known
// third-party key must be empty, and Node processes get a preload that refuses non-loopback sockets.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const EGRESS_PRELOAD = path.join(here, 'block-egress.mjs');

const ENDPOINT = /(^|_)(HOSTS?|HOST\d|URL|ORIGIN|NODES|ENDPOINT)$|^(CRATE_HOSTS|QDRANT_URL|SUPABASE_URL|POSTHOG_HOST)$/;
const MUST_BE_EMPTY = [
  'TMDB_API_KEY', 'TMDB_TOKEN', 'TMDB_READ_TOKEN', 'OPENROUTER_API_KEY', 'TYPESAFE_API_KEY', 'POSTHOG_KEY',
  'POSTHOG_API_KEY', 'QDRANT_API_KEY', 'SUPABASE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'SEARCH_STORAGE_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
];
const LOOPBACK_HOST = /^(127\.\d+\.\d+\.\d+|localhost|::1|\[::1\])$/;

function loopback(value) {
  const parts = value.trim().startsWith('[{')
    ? JSON.parse(value).map((n) => n.host)
    : value.split(',').map((v) => v.trim()).filter(Boolean);
  return parts.every((part) => {
    let host = part;
    try {
      if (/^[a-z]+:\/\//i.test(part)) host = new URL(part).hostname;
    } catch {
      return false;
    }
    return LOOPBACK_HOST.test(host.replace(/:\d+$/, ''));
  });
}

/** Throws unless every endpoint-like variable is loopback and every third-party key is absent. */
export function assertSafe(env, label) {
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined || value === '') continue;
    if (ENDPOINT.test(name) && !loopback(value)) throw new Error(`${label}: ${name} is not loopback; refusing to start`);
  }
  for (const name of MUST_BE_EMPTY) if (env[name]) throw new Error(`${label}: ${name} must be empty; refusing to start`);
  for (const name of Object.keys(env)) if (/^REDIS_|_REDIS_URL$|^CRATE_/.test(name) && env[name] && !/(USER|PORT|PASS|TIMEOUT)/.test(name) && !loopback(env[name])) throw new Error(`${label}: ${name} not loopback`);
  return env;
}

/** A fresh environment: PATH/HOME/TZ/LANG only, plus the given allowlist. */
export function cleanEnv(extra, { node = true } = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: 'C.UTF-8',
    TZ: 'UTC',
    ...(process.env.E2E_SLOT ? { E2E_SLOT: process.env.E2E_SLOT } : {}),
    ...extra,
  };
  if (node) env.NODE_OPTIONS = `--import=${EGRESS_PRELOAD}`;
  return env;
}
