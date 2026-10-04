import http from "k6/http";
import exec from "k6/execution";
import { Counter, Trend } from "k6/metrics";

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
  return [{ ...entry, path, expect: entry.expect || [200], cumulative: totalWeight }];
});
if (!entries.length) throw new Error("URL set is empty");
const routes = [...new Set(entries.map((e) => e.route))].sort();
const responseBytes = new Trend("response_bytes");
const statuses = Object.fromEntries(["2xx", "3xx", "4xx", "5xx", "0"].map((s) => [s, new Counter(`status_${s}`)]));
const thresholds = {};
function metrics(selector) {
  for (const metric of ["http_req_duration", "http_req_waiting", "response_bytes"])
    thresholds[`${metric}{${selector}}`] = ["max>=0"];
  thresholds[`http_req_failed{${selector}}`] = ["rate>=0"];
  thresholds[`http_reqs{${selector}}`] = ["count>=0"];
  for (const status of Object.keys(statuses)) thresholds[`status_${status}{${selector}}`] = ["count>=0"];
}
metrics("phase:main");
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
}
const dropped = number("ABORT_DROPPED", Math.max(1, Math.ceil(max * duration * 0.05)));
thresholds.dropped_iterations = [{ threshold: `count<${dropped}`, abortOnFail: true, delayAbortEval: delay }];
const preVUs = number("PRE_VUS", Math.max(20, max), 1),
  maxVUs = number("MAX_VUS", Math.max(50, max * 4), 1);
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
  },
  ...(env("RESOLVE_IP", "") ? { hosts: { [hostname]: __ENV.RESOLVE_IP } } : {}),
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
  const tags = { route: entry.route, client: entry.client, step, phase, name: entry.route };
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
  const length = response.headers["Content-Length"];
  if (length !== undefined && Number.isFinite(Number(length))) responseBytes.add(Number(length), tags);
}
export function setup() {
  if (cache !== "warm") return;
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry.client}:${entry.path}`;
    if (seen.has(key)) continue;
    if (seen.size >= number("PREWARM_MAX", 200)) break;
    seen.add(key);
    request(entry, "prewarm", "prewarm", `prewarm-${seen.size}`, seen.size);
  }
}
export default function () {
  const index = exec.scenario.iterationInTest;
  const seconds = (Date.now() - exec.scenario.startTime) / 1000;
  const step = steps.find((s) => seconds < s.end_s) || steps[steps.length - 1];
  const pick = Math.random() * totalWeight;
  const entry =
    env("SEQUENTIAL", "0") === "1" ? entries[index % entries.length] : entries.find((e) => pick < e.cumulative);
  request(entry, "main", step.name, `${exec.scenario.startTime}-${index}`, index);
}
export function handleSummary(data) {
  const config = {
    target_url: target,
    resolve_ip: env("RESOLVE_IP", ""),
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
      { ...data, plan: { steps, routes, config } },
      null,
      2,
    ),
    stdout: `Main requests: ${requests}; p95: ${latency ?? "n/a"} ms\n`,
  };
}
