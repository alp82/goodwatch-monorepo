// Validate before SSH and resolve optional share-list entries without network I/O.
import { readFileSync } from "node:fs";
const e = process.env;
function fail(message) {
  throw new Error(message);
}
try {
  for (const key of ["PRE_VUS", "MAX_VUS", "PREWARM_MAX", "ABORT_DROPPED"]) {
    const n = Number(e[key]);
    if (!Number.isSafeInteger(n) || n < (key === "PREWARM_MAX" ? 0 : 1)) fail(`${key} must be a valid integer`);
  }
  if (Number(e.MAX_VUS) < Number(e.PRE_VUS)) fail("MAX_VUS must be at least PRE_VUS");
  if (!(Number(e.ABORT_ERROR_RATE) > 0 && Number(e.ABORT_ERROR_RATE) <= 1)) fail("ABORT_ERROR_RATE must be in (0, 1]");
  if (!(Number(e.ABORT_P95_MS) > 0)) fail("ABORT_P95_MS must be positive");
  for (const key of ["ABORT_DELAY", "REQUEST_TIMEOUT"])
    if (!/^(?:\d+(?:\.\d+)?(?:ms|s|m|h))+$/.test(e[key])) fail(`Invalid ${key}`);
  const target = new URL(e.TARGET_URL);
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search ||
    target.hash
  )
    fail("Target must be an HTTP(S) origin without credentials");
  if (e.CACHE_MODE === "cold" && !e.COOKIE_TEMPLATE.includes("{id}")) fail("COOKIE_TEMPLATE must contain {id}");
  const set = JSON.parse(readFileSync(process.argv[2], "utf8"));
  if (typeof set.name !== "string" || !Array.isArray(set.entries)) fail("URL set needs a name and entries");
  set.entries = set.entries.flatMap((entry) => {
    let missing = false;
    const path = String(entry.path).replace(/\$\{(SHARE_LIST_PATH|SHARE_LIST_OG_PATH)\}/g, (_, key) => {
      if (!e[key]) {
        console.error(`Dropping ${entry.route}: ${key} is unset`);
        missing = true;
      }
      return e[key] || "";
    });
    if (missing) return [];
    if (!/^\/(?!\/)/.test(path) || /[\s\\#]/.test(path) || path.includes("${")) fail(`Invalid path: ${entry.route}`);
    if (
      !/^[a-z_]+$/.test(entry.route) ||
      !["browser", "bot"].includes(entry.client) ||
      !Number.isFinite(entry.weight) ||
      entry.weight <= 0
    )
      fail("Invalid route, client, or weight");
    const expect = entry.expect ?? [200];
    if (!Array.isArray(expect) || !expect.length || expect.some((n) => !Number.isInteger(n) || n < 100 || n > 599))
      fail("Invalid expected status");
    const cookie = entry.client === "bot" ? "" : e.CACHE_MODE === "cold" ? e.COOKIE_TEMPLATE : e.COOKIE;
    if (path.startsWith("/person/") && path.includes("?") && !/(?:^|;\s*)gw_browser=1(?:;|$)/.test(cookie))
      fail("Person query strings require gw_browser=1");
    return [{ ...entry, path, expect }];
  });
  // ONLY_ROUTES keeps a subset, such as "home,title_movie:browser". An item is a route or a route and client.
  const only = (e.ONLY_ROUTES || "").split(",").filter(Boolean);
  if (only.length) {
    const unknown = only.filter(
      (item) => !set.entries.some((entry) => item === entry.route || item === `${entry.route}:${entry.client}`),
    );
    if (unknown.length) fail(`No entry matches: ${unknown.join(", ")}`);
    set.entries = set.entries.filter(
      (entry) => only.includes(entry.route) || only.includes(`${entry.route}:${entry.client}`),
    );
  }
  if (!set.entries.length) fail("URL set is empty after resolving placeholders");
  console.log(JSON.stringify(set, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
