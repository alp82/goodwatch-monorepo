// The production smoke member's YepWatch sign-in, kept between runs so a run signs in once per session lifetime
// instead of every time. Each sign-in goes through GoodWatch's OAuth authorize step, which allows 30 requests a
// minute per address (Better Auth's oauth-provider default); back-to-back smokes from one runner hit that limit
// (429 on /oauth2/authorize). YepWatch's member session is renewable for 90 days, so one sign-in covers every run.
//
// What is kept: the YepWatch origin's cookies and local storage only (never GoodWatch's), in a file outside the
// repository (default ~/.config/yepwatch/smoke-member-session.json, E2E_SMOKE_MEMBER_SESSION overrides), mode 600,
// bound to the member's email by a hash so a changed account never reuses another's session. Its contents are
// never printed. It is saved again at the end of every run: YepWatch rotates the session when it renews it, and the
// next run must present the newest one.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { BrowserContext } from '@playwright/test';

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;
interface Saved {
  version: 1;
  /** sha256 of origin + email: the session belongs to this member on this origin. */
  owner: string;
  savedAt: number;
  state: StorageState;
}

/** Cookies closer than this to their expiry are not reused (a run takes about a minute). */
const EXPIRY_MARGIN_MS = 10 * 60_000;

export function sessionFile() {
  return process.env.E2E_SMOKE_MEMBER_SESSION || path.join(os.homedir(), '.config', 'yepwatch', 'smoke-member-session.json');
}

function owner(origin: string, email: string) {
  return createHash('sha256').update(`${new URL(origin).origin}\n${email.trim().toLowerCase()}`).digest('hex');
}

/** The YepWatch origin's part of `state`: its cookies and its local storage. */
export function originPart(state: StorageState, origin: string): StorageState {
  const host = new URL(origin).hostname;
  const ours = (domain: string) => {
    const d = domain.replace(/^\./, '');
    return d === host || host.endsWith(`.${d}`);
  };
  return {
    cookies: state.cookies.filter((c) => ours(c.domain)),
    origins: state.origins.filter((o) => o.origin === new URL(origin).origin),
  };
}

/**
 * The saved session for this member on this origin, or null (none, another member's, unreadable, too open on disk,
 * or no cookie left that outlives this run).
 */
export function loadSession(origin: string, email: string, now = Date.now()): { state: StorageState; savedAt: number } | null {
  const file = sessionFile();
  let saved: Saved;
  try {
    const stat = fs.statSync(file);
    // Readable by others: never used (and so never refreshed in place); the run signs in and replaces it.
    if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
      console.log(`[smoke] ${file.replace(os.homedir(), '~')} is readable by others; not used`);
      return null;
    }
    saved = JSON.parse(fs.readFileSync(file, 'utf8')) as Saved;
  } catch {
    return null;
  }
  if (saved?.version !== 1 || saved.owner !== owner(origin, email) || !Array.isArray(saved.state?.cookies)) return null;
  const cookies = saved.state.cookies.filter((c) => c.expires === -1 || c.expires * 1000 > now + EXPIRY_MARGIN_MS);
  if (!cookies.length) return null;
  return { state: { cookies, origins: Array.isArray(saved.state.origins) ? saved.state.origins : [] }, savedAt: saved.savedAt };
}

/** Saves the context's YepWatch part for the next run: written to a private temp file, then renamed over the old. */
export async function saveSession(context: BrowserContext, origin: string, email: string, now = Date.now()) {
  const state = originPart(await context.storageState(), origin);
  if (!state.cookies.length) return false;
  const file = sessionFile();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.tmp`;
  const saved: Saved = { version: 1, owner: owner(origin, email), savedAt: now, state };
  fs.writeFileSync(temp, JSON.stringify(saved), { mode: 0o600, flag: 'w' });
  fs.chmodSync(temp, 0o600);
  fs.renameSync(temp, file);
  return true;
}

/** Forgets the saved session (it no longer signs the member in). */
export function dropSession() {
  fs.rmSync(sessionFile(), { force: true });
}

