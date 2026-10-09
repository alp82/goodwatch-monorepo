import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../k6/load.js", import.meta.url), "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace("export default function ()", "function main()")
  .replace(/export /g, "");
const request = (path, host) => ({ method: "GET", path, host });
function harness(changeSet = () => {}) {
  const calls = [], samples = [];
  class Metric {
    constructor(name) { this.name = name; }
    add(value, tags) { samples.push({ name: this.name, value, tags }); }
  }
  class CookieJar {
    constructor() { this.cookies = []; }
    set(...pair) { this.cookies.push(pair); }
  }
  const reply = (method, url, body, params, via = "request") => {
    calls.push({ method, url, body, params, via });
    if (url.endsWith("/movie/1")) params.jar.set(url, "gw_instance", "a");
    return { status: 200, headers: { "Gw-Page-Cache": "hit" }, timings: { duration: 1, tls_handshaking: 1 } };
  };
  const set = { name: "test", static_url: "https://static.example.com", entries: [
    { route: "title_movie", path: "/movie/1", client: "browser", weight: 3, view: {
      requests: [request("/assets/a.js", "static"), request("/api/search-config", "site")],
      side: [{ host: "static", requests: [request("/assets/b.css", "static")] }, { host: "site", requests: [request("/site.webmanifest", "site")] }],
    } },
    { route: "og_title", path: "/og/movie/1.png", client: "bot", weight: 1 },
  ] };
  changeSet(set);
  const context = vm.createContext({
    __ENV: { SCENARIO: "page-view", CONNECTIONS: "new", TARGET_URL: "https://example.com", COOKIE: "gw_browser=1", SEQUENTIAL: "1", RATE_START: "4", RATE_MAX: "4", RESOLVE_IP: "127.0.0.1" },
    open: () => JSON.stringify(set),
    console,
    exec: { scenario: { startTime: Date.now(), iterationInTest: 0 } },
    Counter: Metric, Trend: Metric, Rate: Metric,
    http: { CookieJar, expectedStatuses: (...statuses) => statuses, request: reply, batch: (batch) => batch.map((r) => reply(r.method, r.url, r.body, r.params, "batch")) },
  });
  vm.runInContext(source, context);
  return { context, calls, samples, evaluate: (code) => vm.runInContext(code, context) };
}

test("the first request to a host without a connection goes out alone, and the rest as one batch", () => {
  const { evaluate, calls } = harness((set) => {
    set.entries[0].view.requests.push(request("/assets/c.js", "static"), request("/assets/d.js", "static"));
    set.entries[0].view.side[0].requests.push(request("/assets/e.png", "static"));
  });
  evaluate("main(); side();");
  const via = Object.fromEntries(calls.map((r) => [new URL(r.url).pathname, r.via]));
  // The document opened the site's connection, so the site's file is batched. The static hostname has none yet.
  assert.deepEqual(via, { "/movie/1": "request", "/assets/a.js": "request", "/api/search-config": "batch", "/assets/c.js": "batch", "/assets/d.js": "batch", "/assets/b.css": "request", "/assets/e.png": "batch" });
  assert(calls.findIndex((r) => r.url.endsWith("/assets/a.js")) < calls.findIndex((r) => r.via === "batch"));
});

test("k6 routes host groups, isolates static cookies, and tags measured requests and handshakes", () => {
  const { evaluate, calls, samples } = harness();
  evaluate("main(); side(); __ENV.SIDE_GROUP = '1'; side();");
  assert.deepEqual(calls.map((r) => r.url), ["https://example.com/movie/1", "https://static.example.com/assets/a.js", "https://example.com/api/search-config", "https://static.example.com/assets/b.css", "https://example.com/site.webmanifest"]);
  for (const call of calls.filter((r) => r.params.tags.host === "static")) {
    assert.equal(call.params.jar.cookies.length, 0);
    assert.equal(call.params.headers.Cookie, undefined);
  }
  assert.equal(calls[0].params.jar, calls[2].params.jar);
  assert(calls[2].params.jar.cookies.some(([, name]) => name === "gw_instance"));
  assert.equal(calls[4].params.jar.cookies.length, 0);
  assert.equal(samples.filter((r) => r.name === "tls_handshakes" && r.tags.host === "static").length, 2);
  assert.equal(samples.filter((r) => r.name === "tls_handshakes" && r.tags.host === "site").length, 3);
  assert.equal(evaluate("options.scenarios.side.exec"), "side");
  assert.equal(evaluate("options.scenarios.side_2.exec"), "side");
  assert.equal(evaluate("options.scenarios.side.env.SIDE_GROUP"), "0");
  assert.equal(evaluate("options.scenarios.side_2.env.SIDE_GROUP"), "1");
  assert.equal(evaluate("options.scenarios.side.startRate"), 300);
  assert.equal(evaluate("options.scenarios.side_2.startRate"), 300);
  assert.equal(evaluate("JSON.stringify(options.hosts)"), '{"example.com":"127.0.0.1"}');
  for (const host of ["site", "static"])
    for (const selector of ["phase:main", "phase:main,step:s01"])
      for (const name of ["http_reqs", "http_req_failed", "http_req_duration", "http_req_waiting", "tls_handshakes"])
        assert.equal(evaluate(`Boolean(options.thresholds[${JSON.stringify(`${name}{${selector},host:${host}}`)}])`), true);
});

test("prewarm visits every side group without sending the site's cookies to the static hostname", () => {
  const { evaluate, calls } = harness();
  evaluate("setup()");
  assert.equal(calls.filter((r) => r.url.endsWith("/assets/b.css")).length, 1);
  assert.equal(calls.filter((r) => r.url.endsWith("/site.webmanifest")).length, 1);
  assert(calls.filter((r) => r.url.startsWith("https://static.example.com")).every((r) => r.params.jar.cookies.length === 0));
});

test("each side rate includes only the weights of entries with that group", () => {
  const { evaluate } = harness((set) => {
    set.entries.push({ ...set.entries[0], route: "home", path: "/", weight: 2, view: { requests: [], side: [set.entries[0].view.side[0]] } });
  });
  assert.equal(evaluate("options.scenarios.side.startRate"), Math.round(4 * 5 / 6 * 100));
  assert.equal(evaluate("options.scenarios.side_2.startRate"), 200);
});

test("k6 refuses an other-host request instead of resolving or sending it", () => {
  assert.throws(() => harness((set) => { set.entries[0].view.requests[0].host = "other"; }), /Invalid page-view request/);
});
