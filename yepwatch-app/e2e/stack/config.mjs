// One place for the E2E stack's ports, paths and origins. Everything binds to 127.0.0.1 inside 18400-18499.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const E2E_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP_DIR = path.resolve(E2E_DIR, '..');
export const REPO_DIR = path.resolve(APP_DIR, '..');
export const WEBAPP_DIR = path.join(REPO_DIR, 'goodwatch-webapp');
export const REALTIME_DIR = path.join(REPO_DIR, 'yepwatch-realtime');
export const CACHE_DIR = path.join(E2E_DIR, '.cache');
export const STATE_FILE = path.join(E2E_DIR, '.stack.json');
// Bundles must sit inside the package whose node_modules they import from.
export const API_BUNDLE_DIR = path.join(WEBAPP_DIR, 'build', 'yepwatch-e2e');
export const GATEWAY_BUNDLE = path.join(REALTIME_DIR, 'dist', 'e2e-gateway.js');

export const PORTS = {
  valkey: 18379,
  crateHttp: 18420,
  crateTransport: 18430,
  cratePsql: 18432,
  front: 18480, // Caddy: web export + the production route table
  apiProxy: 18482, // fault proxy in front of the API (latency, refusals)
  api: 18481,
  gatewayProxy: 18484, // fault proxy in front of the gateway (WS upgrade kill, latency)
  gateway: 18483,
  issuer: 18485, // fake GoodWatch: OAuth issuer + member resource
  search: 18486, // fake GoodWatch search role (room ideas)
  images: 18487, // local poster images (stands in for image.tmdb.org)
  control: 18490, // supervisor control API (fault injection)
};

const at = (port) => `http://127.0.0.1:${port}`;
export const ORIGINS = {
  front: at(PORTS.front),
  ws: `ws://127.0.0.1:${PORTS.front}`,
  api: at(PORTS.api),
  gateway: at(PORTS.gateway),
  issuer: at(PORTS.issuer),
  search: at(PORTS.search),
  images: at(PORTS.images),
  control: at(PORTS.control),
  crate: at(PORTS.crateHttp),
};

export const CONTAINERS = { valkey: 'yw-e2e-valkey', crate: 'yw-e2e-crate', caddy: 'yw-e2e-caddy' };
export const IMAGES = { valkey: 'valkey/valkey:8', crate: 'crate:6.4.6', caddy: 'caddy:2.11.7' };

// Disposable local secrets. They protect nothing real; they only satisfy the length rules.
export const SECRETS = {
  room: 'e2e-room-secret-0123456789abcdefghijklmnop',
  gateway: 'e2e-gateway-secret-0123456789abcdefghijklm',
  search: 'e2e-search-secret-0123456789abcdefghijklmn',
  keyId: 'yepwatch-e2e-01',
  clientId: 'yepwatch-e2e-client',
};
