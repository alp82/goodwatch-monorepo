// Loopback stand-ins for the services YepWatch reaches outside its own stack:
//  - GoodWatch issuer (OAuth authorize/token) + member resource (/api/yepwatch/account)   :18485
//  - GoodWatch search role (room idea interpretation)                                      :18486
//  - poster images (stands in for image.tmdb.org)                                          :18487
// Control endpoints (POST /_e2e/...) let tests lapse a member's grant or make GoodWatch unavailable.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { fixtureTitles, interpretIdea } from './fixture-titles.mjs';

const env = process.env;
const ports = { issuer: Number(env.E2E_ISSUER_PORT), search: Number(env.E2E_SEARCH_PORT), images: Number(env.E2E_IMAGES_PORT) };
const searchSecret = env.YEPWATCH_SEARCH_SECRET;
const titles = fixtureTitles(`http://127.0.0.1:${ports.images}`);
const id = () => randomBytes(16).toString('hex');

// ---- issuer state -------------------------------------------------------------------------------------
const codes = new Map(); // code -> { user, challenge, redirectUri }
const access = new Map(); // token -> { user, expiresAt }
const refresh = new Map(); // token -> user
const users = new Map(); // user -> { displayName, lapsed, serviceIds, country, accessTtlS }
let outage = false;
// Prompts the search role refuses as GoodWatch's spend limit does (503 interpretation_unavailable, reason budget).
// Per prompt, so parallel tests never see each other's refusals.
const refusedPrompts = new Set();
const counters = { authorize: 0, token: 0, refresh: 0, resource: 0, search: 0 };
function userOf(name) {
  if (!users.has(name)) users.set(name, { displayName: name.replace(/^member-/, '').replace(/-[0-9a-f]+$/, '') || name, lapsed: false, serviceIds: [8, 337], country: 'DE', accessTtlS: 3600 });
  return users.get(name);
}
const json = (res, status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => r(b)); });
const cookie = (req, name) => (req.headers.cookie ?? '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === name)?.[1];

function approve(res, params, user) {
  const code = id();
  codes.set(code, { user, challenge: params.get('code_challenge'), redirectUri: params.get('redirect_uri') });
  userOf(user);
  const target = new URL(params.get('redirect_uri'));
  target.searchParams.set('code', code);
  target.searchParams.set('state', params.get('state'));
  res.writeHead(302, { location: target.href, 'cache-control': 'no-store' });
  res.end();
}
const page = (params) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local GoodWatch</title>
<style>body{font:16px system-ui;background:#111;color:#eee;padding:24px}input,button{font:inherit;min-height:48px;margin:8px 0;display:block;width:100%}</style></head>
<body><main><h1>Local GoodWatch (E2E)</h1><form method="get" action="/api/auth/oauth2/approve">
${[...params].map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`).join('')}
<label for="user">GoodWatch account</label><input id="user" name="e2e_user" value="member-${id().slice(0, 6)}">
<button type="submit">Sign in to local GoodWatch</button></form></main></body></html>`;

const issuer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${ports.issuer}`);
  const p = url.pathname;
  if (p === '/healthz') return json(res, 200, { ok: true });
  if (p.startsWith('/_e2e/')) {
    const user = url.searchParams.get('user');
    if (p === '/_e2e/lapse' && user) { userOf(user).lapsed = true; for (const [t, a] of access) if (a.user === user) access.delete(t); return json(res, 200, { ok: true }); }
    if (p === '/_e2e/restore' && user) { userOf(user).lapsed = false; return json(res, 200, { ok: true }); }
    if (p === '/_e2e/user' && user) { Object.assign(userOf(user), JSON.parse((await readBody(req)) || '{}')); return json(res, 200, userOf(user)); }
    if (p === '/_e2e/search-budget') { const prompt = url.searchParams.get('prompt') ?? ''; if (url.searchParams.get('on') === '0') refusedPrompts.delete(prompt); else refusedPrompts.add(prompt); return json(res, 200, { refused: [...refusedPrompts] }); }
    if (p === '/_e2e/outage') { outage = url.searchParams.get('on') === '1'; return json(res, 200, { outage }); }
    if (p === '/_e2e/state') return json(res, 200, { outage, counters, users: Object.fromEntries(users) });
    return json(res, 404, { error: 'unknown' });
  }
  if (outage) return json(res, 503, { error: 'temporarily_unavailable' });
  if (p === '/api/auth/oauth2/authorize') {
    counters.authorize++;
    // A browser already signed in to GoodWatch (cookie set by the test) comes straight back, as in production.
    const signedIn = cookie(req, 'gw_e2e_member');
    if (signedIn) return approve(res, url.searchParams, decodeURIComponent(signedIn));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(page(url.searchParams));
  }
  if (p === '/api/auth/oauth2/approve') {
    const user = url.searchParams.get('e2e_user') || `member-${id().slice(0, 6)}`;
    url.searchParams.delete('e2e_user');
    return approve(res, url.searchParams, user);
  }
  if (p === '/api/auth/oauth2/token' && req.method === 'POST') {
    counters.token++;
    const form = new URLSearchParams(await readBody(req));
    let user;
    if (form.get('grant_type') === 'authorization_code') {
      const entry = codes.get(form.get('code'));
      codes.delete(form.get('code'));
      if (!entry || entry.redirectUri !== form.get('redirect_uri')) return json(res, 400, { error: 'invalid_grant' });
      user = entry.user;
    } else if (form.get('grant_type') === 'refresh_token') {
      counters.refresh++;
      user = refresh.get(form.get('refresh_token'));
      if (!user || userOf(user).lapsed) return json(res, 400, { error: 'invalid_grant' });
    } else return json(res, 400, { error: 'unsupported_grant_type' });
    if (userOf(user).lapsed) return json(res, 400, { error: 'invalid_grant' });
    const token = id(), rt = id();
    const ttl = userOf(user).accessTtlS;
    access.set(token, { user, expiresAt: Date.now() + ttl * 1000 });
    refresh.set(rt, user);
    return json(res, 200, { access_token: token, token_type: 'Bearer', expires_in: ttl, refresh_token: rt });
  }
  if (p === '/api/yepwatch/account') {
    counters.resource++;
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const grant = access.get(token);
    if (!grant || grant.expiresAt <= Date.now() || userOf(grant.user).lapsed) return json(res, 401, { error: 'invalid_token' });
    const u = userOf(grant.user);
    const base = { userId: grant.user, expiresAt: grant.expiresAt, displayName: u.displayName };
    const view = url.searchParams.get('view');
    if (view === 'identity') return json(res, 200, base);
    if (view === 'prefill') return json(res, 200, { ...base, data: { country: u.country, serviceIds: u.serviceIds, savedProgressAvailable: false } });
    if (view === 'seen') return json(res, 200, { ...base, data: [] });
    if (view === 'progress') return json(res, 200, { ...base, data: { source: 'goodwatch', shows: [], limitReached: false } });
    return json(res, 400, { error: 'unknown view' });
  }
  json(res, 404, { error: 'not found' });
});

const search = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/healthz') return json(res, 200, { ok: true });
  if (req.method !== 'POST' || req.headers.authorization !== `Bearer ${searchSecret}`) return json(res, 401, { error: 'unauthorized' });
  counters.search++;
  const body = JSON.parse((await readBody(req)) || '{}');
  if (refusedPrompts.has(String(body.prompt ?? ''))) return json(res, 503, { error: 'interpretation_unavailable', reason: 'budget', retryable: false });
  json(res, 200, interpretIdea(titles, String(body.prompt ?? '')));
});

const hues = [12, 32, 48, 160, 200, 260, 300, 340];
const images = http.createServer((req, res) => {
  const m = /^\/posters\/(\d+)\.svg$/.exec(new URL(req.url, 'http://127.0.0.1').pathname);
  if (!m) { res.writeHead(404); return res.end(); }
  const t = titles[Number(m[1]) - 1];
  if (!t) { res.writeHead(404); return res.end(); }
  const hue = hues[t.tmdbId % hues.length];
  res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400', 'access-control-allow-origin': '*' });
  res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750"><rect width="500" height="750" fill="hsl(${hue} 45% 28%)"/>`
    + `<circle cx="250" cy="300" r="140" fill="hsl(${hue} 60% 48%)"/><text x="250" y="620" font-family="sans-serif" font-size="40" fill="#fff" text-anchor="middle">${t.title}</text></svg>`);
});

issuer.listen(ports.issuer, '127.0.0.1');
search.listen(ports.search, '127.0.0.1');
images.listen(ports.images, '127.0.0.1');
console.log(JSON.stringify({ event: 'yepwatch_e2e_fakes_listening', ports }));
for (const s of ['SIGTERM', 'SIGINT']) process.once(s, () => process.exit(0));
