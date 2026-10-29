import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  validateInventory,
  summarizeLighthouse,
  markdown,
  compare,
  median,
  categories,
} from "./metrics.mjs";
import { allowedRequest, installGuard, redactCredentials } from "./guard.mjs";
import { request } from "./network.mjs";
import { EventEmitter } from "node:events";
import http from "node:http";
const inventory = JSON.parse(
  await readFile(new URL("./pages.json", import.meta.url), "utf8"),
);
test("every route is covered once or explicitly skipped", async () => {
  const routes = await readdir(
    new URL("../../goodwatch-webapp/app/routes/", import.meta.url),
  );
  assert.deepEqual(validateInventory(inventory, routes), []);
  assert.ok(
    validateInventory(inventory, [...routes, "new-page.tsx"]).some((x) =>
      x.includes("new-page"),
    ),
  );
});
test("inventory rejects duplicate, missing and invalid metadata", () => {
  const p = {
    id: "x",
    route: "a",
    examples: [],
    tier: "P4",
    audience: ["robot"],
  };
  assert.ok(
    validateInventory({ pages: [p, p], skippedRoutes: [{ route: "b" }] }, [
      "a",
      "b",
    ]).length >= 5,
  );
});
const report = (score, lcp) => ({
  requestedUrl: "https://example.test/",
  categories: Object.fromEntries(
    categories.map((c) => [
      c,
      { score, auditRefs: [{ id: "fail" }, { id: "manual" }] },
    ]),
  ),
  audits: {
    fail: { id: "fail", title: "Fix | this", score: 0 },
    manual: { id: "manual", title: "Manual", score: null },
    "largest-contentful-paint": { numericValue: lcp },
    "network-requests": {
      details: {
        items: [
          {
            url: "https://example.test/a.js",
            resourceType: "Script",
            transferSize: 100,
          },
        ],
      },
    },
  },
});
test("medians exclude runtime failures, deduplicate failed audits and preserve missing data", () => {
  const s = summarizeLighthouse([
    report(0.5, 100),
    report(0.9, 300),
    { runtimeError: { code: "NO_FCP" } },
  ]);
  assert.equal(s.runs, 2);
  assert.equal(s.attempted, 3);
  assert.equal(s.metrics.performance, 70);
  assert.equal(s.metrics.lcp_ms, 200);
  assert.equal(s.failedAudits.seo.length, 1);
  assert.equal(s.metrics.fcp_ms, undefined);
  assert.equal(median([undefined, 2, 4]), 3);
});
test("comparison handles removed and added pages, absent metrics, and zero", () => {
  const a = {
    pages: [
      { path: "/", mobile: { metrics: { performance: 0, cls: 0 } } },
      { path: "/removed" },
    ],
  };
  const b = {
    pages: [
      { path: "/", mobile: { metrics: { performance: 90, cls: 0.1 } } },
      { path: "/added" },
    ],
  };
  const text = compare(a, b);
  assert.match(text, /performance \| 0.000 \| 90.000 \| 90.000/);
  assert.match(text, /\/removed/);
  assert.match(text, /\/added/);
  assert.match(text, /n\/a/);
});
test("markdown includes errors, all tiers, missing measurements, and escapes table pipes", () => {
  const text = markdown({
    pages: [{ path: "/a|b", tier: "P1", errors: ["failure"] }],
    skipped: [{ route: "member", reason: "No cookie" }],
  });
  assert.match(text, /a\\\|b/);
  assert.match(text, /## P3/);
  assert.match(text, /No cookie/);
  assert.match(text, /failure/);
  assert.match(text, /n\/a/);
});
test("guard blocks writes, stateful GETs, sockets and optional analytics", () => {
  for (const m of ["POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    assert.equal(allowedRequest(m, "https://example.test"), false);
  assert.equal(
    allowedRequest("GET", "https://example.test/api/og-image-warm"),
    false,
  );
  assert.equal(allowedRequest("GET", "wss://example.test"), false);
  assert.equal(
    allowedRequest("GET", "https://us.i.posthog.com/a", true),
    false,
  );
  assert.equal(allowedRequest("GET", "https://us.i.posthog.com/a"), true);
  assert.equal(
    allowedRequest("GET", "https://example.test/assets/a.js", true),
    true,
  );
});
test("request queue waits for full transfers, scopes cookies, and handles inspector re-fetches", async () => {
  const page = new EventEmitter(),
    session = new EventEmitter(),
    calls = [];
  let finishBody;
  session.send = async (method, params) => {
    calls.push({ method, params });
    if (method === "Fetch.getResponseBody")
      await new Promise((resolve) => {
        finishBody = resolve;
      });
  };
  page.createCDPSession = async () => session;
  page.setBypassServiceWorker = page.evaluateOnNewDocument = async () => {};
  const stats = await installGuard(page, {
    origin: "https://site.test",
    cookie: "secret=value",
  });
  const request = (requestId, url, networkId, method = "GET") => ({
    requestId,
    networkId,
    request: { url, method, headers: {} },
  });
  session.emit("Fetch.requestPaused", request("a", "https://site.test/", "n1"));
  session.emit(
    "Fetch.requestPaused",
    request("b", "https://third.test/a", "n2"),
  );
  session.emit("Fetch.requestPaused", request("c", "https://site.test/c"));
  session.emit(
    "Fetch.requestPaused",
    request("write", "https://site.test/", undefined, "POST"),
  );
  const continued = () =>
    calls.filter((c) => c.method === "Fetch.continueRequest");
  assert.equal(continued().length, 2);
  assert.ok(
    continued()[0].params.headers.some(
      (h) => h.name === "Cookie" && h.value === "secret=value",
    ),
  );
  assert.ok(!continued()[1].params.headers.some((h) => h.name === "Cookie"));
  assert.equal(stats.blockedMethods, 1);
  // Receiving headers must not free a normal request's slot.
  session.emit("Network.responseReceived", { requestId: "n1" });
  assert.equal(continued().length, 2);
  session.emit("Network.loadingFinished", { requestId: "n1" });
  assert.equal(continued().length, 3);
  assert.equal(continued()[2].params.interceptResponse, true);
  session.emit("Fetch.requestPaused", {
    ...request("c", "https://site.test/c"),
    responseStatusCode: 200,
  });
  session.emit(
    "Fetch.requestPaused",
    request("d", "https://site.test/d", "n4"),
  );
  assert.equal(continued().length, 3);
  finishBody();
  await new Promise((r) => setImmediate(r));
  assert.equal(continued().length, 5);
  assert.equal(stats.maxConcurrent, 2);
  assert.equal(stats.responseErrors, 0);
});
test("HTTP measurements preserve compressed bytes and process Early Hints", async () => {
  const server = http.createServer((req, res) => {
    res.writeEarlyHints({ link: "</style.css>; rel=preload; as=style" });
    res.writeHead(200, { "content-encoding": "gzip" });
    res.end(Buffer.from([31, 139, 0, 0]));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const r = await request(`http://127.0.0.1:${server.address().port}`);
    assert.equal(r.status, 200);
    assert.equal(r.bytes, 4);
    assert.equal(r.body[0], 31);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("credential redaction preserves numeric metrics and removes header values", () => {
  const data = {
    score: 1,
    text: "token=long-session-secret-1234",
    cookie: "x=1",
    nested: ["1", "long-session-secret-1234"],
  };
  const clean = redactCredentials(
    data,
    "gw_browser=1; session=long-session-secret-1234",
  );
  assert.equal(clean.score, 1);
  assert.equal(clean.text, "token=[redacted]");
  assert.equal(clean.cookie, "[redacted]");
  assert.deepEqual(clean.nested, ["[redacted]", "[redacted]"]);
  assert.equal(data.cookie, "x=1");
});
