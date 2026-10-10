import http from "k6/http";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";

const env = (key, fallback) => (__ENV[key] === undefined ? fallback : __ENV[key]);
const number = (key, fallback, min = 0) => {
  const value = Number(env(key, fallback));
  if (!Number.isFinite(value) || value < min) throw new Error(`Invalid ${key}`);
  return value;
};
const start = number("RATE_START", 5, 1),
  increment = number("RATE_STEP", 5, 1),
  max = number("RATE_MAX", 5, 1);
const duration = number("STEP_DURATION", 10, 1),
  ramp = number("RAMP_SECONDS", 5);
if (start > max) throw new Error("RATE_START exceeds RATE_MAX");
// RATE_LIST is an explicit plateau list, such as "2,4,6,10,15". It replaces start, step, and max.
const rates = env("RATE_LIST", "")
  ? env("RATE_LIST", "").split(",").map(Number)
  : (() => {
      const list = [];
      for (let rate = start; ; rate = Math.min(max, rate + increment)) {
        list.push(rate);
        if (rate === max) return list;
      }
    })();
if (rates.some((rate, i) => !Number.isFinite(rate) || rate < 1 || (i && rate <= rates[i - 1])))
  throw new Error("RATE_LIST must be increasing positive numbers");
const steps = [],
  stages = [];
let elapsed = 0;
for (const rate of rates) {
  const transition = steps.length ? ramp : 0;
  if (transition) stages.push({ duration: `${transition}s`, target: rate });
  stages.push({ duration: `${duration}s`, target: rate });
  steps.push({
    name: `s${String(steps.length + 1).padStart(2, "0")}`,
    rate,
    start_s: elapsed,
    end_s: elapsed + transition + duration,
  });
  elapsed += transition + duration;
}
const cache = env("CACHE_MODE", "warm");
if (!["warm", "cold"].includes(cache)) throw new Error("CACHE_MODE must be warm or cold");
// SCENARIO=page-view: one iteration is one visitor. A browser entry sends its document, then the files and API
// requests of its "view" (written by scripts/page-view-set.mjs from a real page load). Other entries send one request.
const scenario = env("SCENARIO", "requests");
if (!["requests", "page-view"].includes(scenario)) throw new Error("SCENARIO must be requests or page-view");
const pageViews = scenario === "page-view";
// CONNECTIONS=new: every visitor opens its own connection, with a full TLS handshake. k6 keeps no TLS session
// cache, so no handshake is resumed. CONNECTIONS=reuse keeps each virtual user's connection across iterations.
const connections = env("CONNECTIONS", "reuse");
if (!["new", "reuse"].includes(connections)) throw new Error("CONNECTIONS must be new or reuse");
// What a cache in front of the app would send with every page request. See docs/cache-identity.md.
const identities = env("CACHE_IDENTITY", "").split("|").filter(Boolean);
if (identities.some((value) => !/^anon;[A-Z]{2};[a-z]{2,3}$/.test(value))) throw new Error("Invalid CACHE_IDENTITY");
// The page cache's own rule for "a page": not an API, image, asset, or health path, and no dot in the last segment.
const isPage = (path) => {
  const pathname = path.split("?")[0];
  return !/^\/(api|og|assets|health)\//.test(pathname) && !pathname.split("/").pop().includes(".");
};
const target = env("TARGET_URL", "https://goodwatch.app").replace(/\/$/, "");
const hostname = target.match(/^https?:\/\/([^/:]+)(?::\d+)?$/)?.[1];
if (!hostname) throw new Error("TARGET_URL must be an HTTP(S) origin");
const cookie = env("COOKIE", "gw_browser=1");
const template = env("COOKIE_TEMPLATE", "gw_browser=1; bench_visitor={id}");
if (cache === "cold" && !template.includes("{id}")) throw new Error("COOKIE_TEMPLATE must contain {id}");
const language = env("ACCEPT_LANGUAGE", "en-US,en;q=0.9");
const languages = env(
  "ACCEPT_LANGUAGES",
  "en-US,en;q=0.9|de-DE,de;q=0.9,en;q=0.8|fr-FR,fr;q=0.9|es-ES,es;q=0.9|pt-BR,pt;q=0.9",
).split("|");
const browserUA = env(
  "BROWSER_UA",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
);
// The recognizable token is sufficient for isbot; no external URL is needed.
const botUA = env("BOT_UA", "facebookexternalhit/1.1");
const set = JSON.parse(open(env("URLS_FILE", "/work/urls.json")));
const staticUrl = set.static_url;
if (staticUrl && !/^https?:\/\/[^/?#@]+$/.test(staticUrl)) throw new Error("static_url must be an HTTP(S) origin");
let totalWeight = 0;
const entries = set.entries.flatMap((entry) => {
  let missing = false;
  const path = entry.path.replace(/\$\{(SHARE_LIST_PATH|SHARE_LIST_OG_PATH)\}/g, (_, key) => {
    if (!__ENV[key]) {
      console.warn(`Dropping ${entry.route}: ${key} is unset`);
      missing = true;
    }
    return __ENV[key] || "";
  });
  if (missing) return [];
  if (!/^\/(?!\/)/.test(path) || /[\s\\#]/.test(path) || path.includes("${"))
    throw new Error(`Invalid path for ${entry.route}`);
  if (!/^[a-z_]+$/.test(entry.route) || !["browser", "bot"].includes(entry.client) || !(Number(entry.weight) > 0))
    throw new Error("Invalid URL entry");
  totalWeight += Number(entry.weight);
  const view = pageViews && entry.client === "browser" && entry.view ? entry.view : null;
  if (view) {
    for (const r of [...view.requests, ...view.side.flatMap((group) => group.requests)]) {
      if (!["site", "static"].includes(r.host) || (r.host === "static" && !staticUrl) || !/^\/(?!\/)/.test(r.path) || /[\s\\#]/.test(r.path)) throw new Error(`Invalid page-view request for ${entry.route}`);
    }
    for (const group of view.side) if (!group.requests.length || group.requests.some((r) => r.host !== group.host)) throw new Error(`Invalid side group for ${entry.route}`);
  }
  return [{ ...entry, path, expect: entry.expect || [200], cumulative: totalWeight, view }];
});
if (!entries.length) throw new Error("URL set is empty");
// Each captured side connection has a scenario. Only entries with that group contribute to its rate.
const sideGroups = Array.from({ length: Math.max(...entries.map((entry) => entry.view?.side.length || 0)) }, (_, index) => {
  let weight = 0;
  const selected = entries.filter((entry) => entry.view?.side.length > index)
    .map((entry) => ({ ...entry, sideCumulative: (weight += Number(entry.weight)) }));
  return { entries: selected, weight, share: weight / totalWeight };
});
const routes = [...new Set(entries.map((e) => e.route))].sort();
const responseBytes = new Trend("response_bytes");
const statuses = Object.fromEntries(["2xx", "3xx", "4xx", "5xx", "0"].map((s) => [s, new Counter(`status_${s}`)]));
// 503 answers of the page store that carry `GW-Page-Cache: busy`. They are also counted as 5xx.
const busyAnswers = new Counter("status_busy");
const isBusy = (response) => response.status === 503 && response.headers["Gw-Page-Cache"] === "busy";
const visits = new Counter("visits"),
  pageViewCount = new Counter("page_views"),
  pageViewFailed = new Rate("page_view_failed"),
  pageViewDuration = new Trend("page_view_duration", true),
  handshakes = new Counter("tls_handshakes"),
  handshakeDuration = new Trend("tls_handshake_duration", true);
const kinds = ["document", "asset", "api", "side", "single"];
// SLICE_SECONDS cuts a long plateau into slices of that length, so that the summary shows how the first request
// of a visit and the whole page view behave over time (a page's lifetime ending, a snapshot reload).
const sliceSeconds = number("SLICE_SECONDS", 0);
const firstDuration = new Trend("first_request_duration", true);
const sliceName = (seconds) => `t${String(Math.floor(seconds / sliceSeconds)).padStart(4, "0")}`;
const thresholds = {};
function metrics(selector) {
  for (const metric of ["http_req_duration", "http_req_waiting", "response_bytes"])
    thresholds[`${metric}{${selector}}`] = ["max>=0"];
  thresholds[`http_req_failed{${selector}}`] = ["rate>=0"];
  thresholds[`http_reqs{${selector}}`] = ["count>=0"];
  for (const status of Object.keys(statuses)) thresholds[`status_${status}{${selector}}`] = ["count>=0"];
  thresholds[`status_busy{${selector}}`] = ["count>=0"];
}
function hostMetrics(selector) {
  for (const host of ["site", "static"]) {
    const tags = `${selector},host:${host}`;
    for (const name of ["http_reqs", "tls_handshakes"]) thresholds[`${name}{${tags}}`] = ["count>=0"];
    for (const name of ["http_req_duration", "http_req_waiting"]) thresholds[`${name}{${tags}}`] = ["max>=0"];
    thresholds[`http_req_failed{${tags}}`] = ["rate>=0"];
  }
}
metrics("phase:main");
if (pageViews) hostMetrics("phase:main");
for (const route of routes) metrics(`phase:main,route:${route}`);
const delay = env("ABORT_DELAY", "10s");
for (const step of steps) {
  const selector = `phase:main,step:${step.name}`;
  metrics(selector);
  thresholds[`http_req_failed{${selector}}`] = [
    { threshold: `rate<${number("ABORT_ERROR_RATE", 0.02)}`, abortOnFail: true, delayAbortEval: delay },
  ];
  thresholds[`http_req_duration{${selector}}`] = [
    { threshold: `p(95)<${number("ABORT_P95_MS", 3000)}`, abortOnFail: true, delayAbortEval: delay },
  ];
  if (!pageViews) continue;
  hostMetrics(selector);
  // A page view fails when any of its requests fails. The whole page view has its own, longer limit.
  thresholds[`page_view_failed{${selector}}`] = [
    { threshold: `rate<${number("ABORT_ERROR_RATE", 0.02)}`, abortOnFail: true, delayAbortEval: delay },
  ];
  thresholds[`page_view_duration{${selector}}`] = [
    { threshold: `p(95)<${number("ABORT_PAGE_P95_MS", 10000)}`, abortOnFail: true, delayAbortEval: delay },
  ];
  for (const name of ["visits", "page_views", "tls_handshakes"]) thresholds[`${name}{${selector}}`] = ["count>=0"];
  thresholds[`tls_handshake_duration{${selector}}`] = ["max>=0"];
  for (const kind of kinds) {
    for (const metric of ["http_req_duration", "http_req_waiting"]) thresholds[`${metric}{${selector},kind:${kind}}`] = ["max>=0"];
    thresholds[`http_reqs{${selector},kind:${kind}}`] = ["count>=0"];
    thresholds[`http_req_failed{${selector},kind:${kind}}`] = ["rate>=0"];
  }
}
if (pageViews && sliceSeconds) {
  for (let seconds = 0; seconds < elapsed; seconds += sliceSeconds) {
    const selector = `slice:${sliceName(seconds)}`;
    thresholds[`first_request_duration{${selector}}`] = ["max>=0"];
    thresholds[`page_view_duration{${selector}}`] = ["max>=0"];
    thresholds[`page_view_failed{${selector}}`] = ["rate>=0"];
    thresholds[`visits{${selector}}`] = ["count>=0"];
  }
}
if (pageViews) {
  for (const name of ["visits", "page_views", "tls_handshakes"]) thresholds[`${name}{phase:main}`] = ["count>=0"];
  thresholds["page_view_failed{phase:main}"] = ["rate>=0"];
  thresholds["page_view_duration{phase:main}"] = ["max>=0"];
  for (const route of routes) {
    thresholds[`page_view_duration{phase:main,route:${route}}`] = ["max>=0"];
    thresholds[`page_views{phase:main,route:${route}}`] = ["count>=0"];
  }
}
const dropped = number("ABORT_DROPPED", Math.max(1, Math.ceil(max * duration * 0.05)));
thresholds.dropped_iterations = [{ threshold: `count<${dropped}`, abortOnFail: true, delayAbortEval: delay }];
const preVUs = number("PRE_VUS", Math.max(20, max), 1),
  maxVUs = number("MAX_VUS", Math.max(50, max * 4), 1);
// The side scenario follows the same stages at the share of visitors that have side requests. Rates are scaled
// by 100 so that a share such as 0.9 stays exact.
const sideShare = sideGroups[0]?.share || 0;
export const options = {
  scenarios: {
    load: {
      executor: "ramping-arrival-rate",
      startRate: rates[0],
      timeUnit: "1s",
      stages,
      preAllocatedVUs: preVUs,
      maxVUs,
      gracefulStop: "0s",
    },
    ...Object.fromEntries(sideGroups.map((group, index) => [index === 0 ? "side" : `side_${index + 1}`, {
      executor: "ramping-arrival-rate",
      exec: "side",
      env: { SIDE_GROUP: String(index) },
      startRate: Math.round(rates[0] * group.share * 100),
      timeUnit: "100s",
      stages: stages.map((stage) => ({ ...stage, target: Math.round(stage.target * group.share * 100) })),
      preAllocatedVUs: Math.max(5, Math.ceil(preVUs / 4)),
      maxVUs,
      gracefulStop: "0s",
    }])),
  },
  ...(connections === "new" ? { noVUConnectionReuse: true } : {}),
  // A browser sends a page's requests at once over one HTTP/2 connection. k6's default is 6 at a time per host.
  ...(pageViews ? { batch: 256, batchPerHost: 256 } : {}),
  ...(env("RESOLVE_IP", "") ? { hosts: { [hostname]: __ENV.RESOLVE_IP } } : {}),
  // For one instance behind another host's proxy, whose certificate doesn't cover the name (BENCH_INSECURE_TLS=1).
  ...(env("INSECURE_TLS", "0") === "1" ? { insecureSkipTLSVerify: true } : {}),
  thresholds,
  discardResponseBodies: true,
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max", "count"],
  systemTags: ["status", "method", "name", "scenario", "expected_response"],
};
function request(entry, phase, step, id, index) {
  let path = entry.path;
  const headers = {
    "User-Agent": entry.client === "bot" ? botUA : browserUA,
    "Accept-Encoding": env("ACCEPT_ENCODING", "br, gzip"),
  };
  let effectiveCookie = "";
  if (entry.client === "browser") {
    effectiveCookie = cache === "cold" ? template.split("{id}").join(id) : cookie;
    if (effectiveCookie) headers.Cookie = effectiveCookie;
    headers["Accept-Language"] = cache === "cold" ? languages[index % languages.length] : language;
  }
  if (
    cache === "cold" &&
    env("CACHE_BUST_QUERY", "0") === "1" &&
    (!path.startsWith("/person/") || /(?:^|;\s*)gw_browser=1(?:;|$)/.test(effectiveCookie))
  )
    path += `${path.includes("?") ? "&" : "?"}_cb=${id}`;
  Object.assign(headers, identityHeader(entry.path, index));
  const tags = { route: entry.route, client: entry.client, step, phase, name: entry.route, host: "site" };
  // Disable the cookie jar so Set-Cookie cannot affect later browser or bot requests.
  const response = http.get(target + path, {
    headers,
    tags,
    redirects: 0,
    timeout: env("REQUEST_TIMEOUT", "30s"),
    jar: new http.CookieJar(),
    responseCallback: http.expectedStatuses(...entry.expect),
  });
  const status = response.status >= 200 && response.status < 600 ? `${Math.floor(response.status / 100)}xx` : "0";
  for (const key of Object.keys(statuses)) statuses[key].add(key === status ? 1 : 0, tags);
  busyAnswers.add(isBusy(response) ? 1 : 0, tags);
  const length = response.headers["Content-Length"];
  if (length !== undefined && Number.isFinite(Number(length))) responseBytes.add(Number(length), tags);
}
// One visitor of the page-view scenario. Its requests share one cookie jar, so a cookie that the proxy sets with the
// document (the balanced route's instance cookie) comes back with the page's files, as in a browser.
function send(method, path, body, kind, entry, tags, jar, extraHeaders, host = "site") {
  return {
    method,
    url: (host === "static" ? staticUrl : target) + path,
    body: body ?? null,
    params: {
      headers: {
        "User-Agent": entry.client === "bot" ? botUA : browserUA,
        "Accept-Encoding": env("ACCEPT_ENCODING", "br, gzip"),
        ...(entry.client === "browser" ? { "Accept-Language": language } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
      },
      tags: { ...tags, kind, host },
      redirects: 0,
      timeout: env("REQUEST_TIMEOUT", "30s"),
      // A separate empty jar also prevents cookies crossing between loopback ports or sibling domains.
      jar: host === "static" ? new http.CookieJar() : jar,
      responseCallback: http.expectedStatuses(...(kind === "document" || kind === "single" ? entry.expect : [200])),
    },
  };
}
// Go's HTTP client dials one connection for every request that finds none open, so a batch to a host without a
// connection opens as many connections as it has requests (measured: 36 per movie page view instead of 4). A browser
// opens one and sends the rest over it. So the first request to each host that has no connection yet goes out alone.
function batchOnOpenConnections(batch, open) {
  const responses = new Array(batch.length);
  const rest = [];
  for (let i = 0; i < batch.length; i++) {
    const host = batch[i].params.tags.host;
    if (open.has(host)) rest.push(i);
    else {
      open.add(host);
      responses[i] = http.request(batch[i].method, batch[i].url, batch[i].body, batch[i].params);
    }
  }
  const answers = rest.length ? http.batch(rest.map((i) => batch[i])) : [];
  for (let n = 0; n < rest.length; n++) responses[rest[n]] = answers[n];
  return responses;
}
function record(response, tags, kind, expect) {
  const status = response.status >= 200 && response.status < 600 ? `${Math.floor(response.status / 100)}xx` : "0";
  // One sample per request, to keep the generator's own CPU low at thousands of requests per second.
  statuses[status].add(1, tags);
  if (isBusy(response)) busyAnswers.add(1, tags);
  // A request that opened the connection has a handshake time. Requests on an open connection report zero.
  const handshake = response.timings?.tls_handshaking || 0;
  if (handshake > 0) {
    handshakes.add(1, tags);
    handshakeDuration.add(handshake, tags);
  }
  return expect.includes(response.status);
}
function identityHeader(path, index) {
  return identities.length && isPage(path) ? { "GW-Cache-Identity": identities[index % identities.length] } : {};
}
function visit(entry, phase, step, index) {
  const tags = { route: entry.route, client: entry.client, step, phase, name: entry.route, host: "site" };
  const jar = new http.CookieJar();
  if (entry.client === "browser" && cookie) for (const pair of cookie.split(/;\s*/)) {
    const at = pair.indexOf("=");
    if (at > 0) jar.set(target, pair.slice(0, at), pair.slice(at + 1));
  }
  const started = Date.now();
  const kind = entry.view ? "document" : "single";
  const first = send("GET", entry.path, null, kind, entry, tags, jar, identityHeader(entry.path, index));
  const document = http.request(first.method, first.url, first.body, first.params);
  let ok = record(document, tags, kind, entry.expect);
  if (entry.view && ok && entry.view.requests.length) {
    const batch = entry.view.requests.map((r) => send(r.method, r.path, r.body, r.method === "GET" && !r.path.startsWith("/api/") ? "asset" : "api", entry, tags, jar, undefined, r.host));
    const responses = batchOnOpenConnections(batch, new Set(["site"]));
    for (let i = 0; i < responses.length; i++) if (!record(responses[i], batch[i].params.tags, batch[i].params.tags.kind, [200])) ok = false;
  }
  if (phase !== "main") return { document, ok };
  const sliced = sliceSeconds ? { ...tags, slice: sliceName((started - exec.scenario.startTime) / 1000) } : tags;
  visits.add(1, sliced);
  if (sliceSeconds) firstDuration.add(document.timings.duration, sliced);
  if (entry.view) {
    pageViewCount.add(ok ? 1 : 0, tags);
    pageViewFailed.add(!ok, sliced);
    pageViewDuration.add(Date.now() - started, sliced);
  }
  return { document, ok };
}
function currentStep() {
  const seconds = (Date.now() - exec.scenario.startTime) / 1000;
  return (steps.find((s) => seconds < s.end_s) || steps[steps.length - 1]).name;
}
export function side() {
  const index = Number(env("SIDE_GROUP", "0"));
  const group = sideGroups[index];
  const pick = Math.random() * group.weight;
  const entry = group.entries.find((e) => pick < e.sideCumulative);
  const tags = { route: entry.route, client: entry.client, step: currentStep(), phase: "main", name: entry.route };
  const jar = new http.CookieJar();
  const batch = entry.view.side[index].requests.map((r) => send(r.method, r.path, r.body, "side", entry, tags, jar, undefined, r.host));
  const responses = batchOnOpenConnections(batch, new Set());
  for (let i = 0; i < responses.length; i++) record(responses[i], batch[i].params.tags, "side", [200]);
}
export function setup() {
  if (pageViews) {
    // The page cache stores a URL on its second request within 60 seconds, per instance and identity, and the
    // balanced route alternates between the instances. So each page is requested until it comes from a store,
    // and each file once. A file that doesn't answer 200 means the list is from another build: stop.
    const pages = {};
    const seen = new Set();
    const notWarm = [];
    for (const entry of entries) {
      for (let n = 0; n < Math.max(1, identities.length); n++) {
        const key = `${entry.client}:${entry.path}:${n}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let response;
        for (let attempt = 0, hits = 0; attempt < 12 && hits < 3; attempt++) {
          const result = visit(entry, "prewarm", "prewarm", n);
          response = result.document;
          if (!result.ok) throw new Error(`Prewarm: ${entry.route} or one of its files answered ${response.status || "an error"}`);
          if (!isPage(entry.path) || cache !== "warm") break;
          hits = response.headers["Gw-Page-Cache"] === "hit" ? hits + 1 : 0;
        }
        if (isPage(entry.path) && !pages[`${entry.route}:${entry.client}`])
          pages[`${entry.route}:${entry.client}`] = {
            status: response.status,
            cache_control: response.headers["Cache-Control"] || null,
            vary: response.headers["Vary"] || null,
            page_cache: response.headers["Gw-Page-Cache"] || null,
            cache_identity: response.headers["Gw-Cache-Identity"] || null,
            protocol: response.proto || null,
            tls_version: response.tls_version || null,
            tls_cipher_suite: response.tls_cipher_suite || null,
          };
        if (cache === "warm" && isPage(entry.path) && response.headers["Gw-Page-Cache"] !== "hit") notWarm.push(entry.route);
      }
      for (const group of entry.view?.side || []) for (const r of group.requests) {
        if (seen.has(`side:${group.host}:${entry.view.side.indexOf(group)}:${r.path}`)) continue;
        seen.add(`side:${group.host}:${entry.view.side.indexOf(group)}:${r.path}`);
        const q = send(r.method, r.path, r.body, "side", entry, { phase: "prewarm", step: "prewarm", route: entry.route, name: entry.route }, new http.CookieJar(), undefined, group.host);
        const response = http.request(q.method, q.url, q.body, q.params);
        if (response.status !== 200) throw new Error(`Prewarm: a file of ${entry.route} answered ${response.status}`);
      }
    }
    return { scenario_start_ms: Date.now(), pages, not_warm: [...new Set(notWarm)] };
  }
  if (cache !== "warm") return { scenario_start_ms: Date.now() };
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry.client}:${entry.path}`;
    if (seen.has(key)) continue;
    if (seen.size >= number("PREWARM_MAX", 200)) break;
    seen.add(key);
    request(entry, "prewarm", "prewarm", `prewarm-${seen.size}`, seen.size);
  }
  return { scenario_start_ms: Date.now() };
}
export default function () {
  const index = exec.scenario.iterationInTest;
  const step = currentStep();
  const pick = Math.random() * totalWeight;
  const entry =
    env("SEQUENTIAL", "0") === "1" ? entries[index % entries.length] : entries.find((e) => pick < e.cumulative);
  if (pageViews) visit(entry, "main", step, index);
  else request(entry, "main", step, `${exec.scenario.startTime}-${index}`, index);
}
export function handleSummary(data) {
  const config = {
    scenario,
    connections,
    cache_identity: identities,
    side_share: sideShare,
    side_shares: sideGroups.map((group) => group.share),
    slice_seconds: sliceSeconds,
    target_url: target,
    resolve_ip: env("RESOLVE_IP", ""),
    insecure_tls: env("INSECURE_TLS", "0") === "1",
    cache_mode: cache,
    url_set: set.name,
    sequential: env("SEQUENTIAL", "0"),
    prewarm_max: number("PREWARM_MAX", 200),
    cookie: cookie ? "[redacted]" : "",
    cookie_template: "[redacted]",
    accept_language: language,
    accept_languages: languages,
    browser_ua: browserUA,
    bot_ua: botUA,
    accept_encoding: env("ACCEPT_ENCODING", "br, gzip"),
    request_timeout: env("REQUEST_TIMEOUT", "30s"),
    cache_bust_query: env("CACHE_BUST_QUERY", "0"),
    abort_delay: delay,
    abort_dropped: dropped,
    abort_error_rate: number("ABORT_ERROR_RATE", 0.02),
    abort_p95_ms: number("ABORT_P95_MS", 3000),
    pre_vus: preVUs,
    max_vus: maxVUs,
  };
  const requests = data.metrics["http_reqs{phase:main}"]?.values.count || 0;
  const latency = data.metrics["http_req_duration{phase:main}"]?.values["p(95)"];
  return {
    [`${env("OUT_DIR", "/work")}/k6-summary.json`]: JSON.stringify(
      {
        ...data,
        plan: {
          steps,
          routes,
          config,
          // The scenario starts when setup ends. The summary places the steps on the clock with it.
          scenario_start_ms: data.setup_data?.scenario_start_ms ?? null,
          pages: data.setup_data?.pages ?? null,
          not_warm: data.setup_data?.not_warm ?? null,
        },
      },
      null,
      2,
    ),
    stdout: `Main requests: ${requests}; p95: ${latency ?? "n/a"} ms\n`,
  };
}
