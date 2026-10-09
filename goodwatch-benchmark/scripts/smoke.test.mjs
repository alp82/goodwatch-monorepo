import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import vm from "node:vm";
import { buildFilesInHtml, staticOriginFromSetting, staticOriginInHtml } from "./static-host.mjs";

const source = readFileSync(new URL("./smoke.mjs", import.meta.url), "utf8")
  .replace(/^#!.*\n/, "")
  .replace(/^import .*\n/gm, "")
  .replaceAll("import.meta.url", JSON.stringify(new URL("./smoke.mjs", import.meta.url).href));

// Run the CLI with in-memory HTTP responses and logs. No subprocesses or sockets are used.
async function run({ named = true, configured = true, status = "", headers = "", staticOrigin = "https://static.example.com" } = {}) {
  const calls = [], output = [];
  const config = JSON.parse(readFileSync(new URL("../smoke/urls.json", import.meta.url)));
  config.entries = config.entries.filter((entry) => ["home", "static-asset"].includes(entry.id));
  delete config.entries[0].html;
  delete config.entries[1].minBytes;
  const exited = {};
  let exitCode;
  const context = vm.createContext({
    URL, Buffer, performance, AbortSignal, dirname, resolve, fileURLToPath,
    buildFilesInHtml, staticOriginFromSetting, staticOriginInHtml,
    process: {
      argv: ["node", "smoke.mjs", "--target", "local", "--base-url", "https://example.com", "--log-file", "log", "--metrics-url", "https://example.com/metrics", "--patterns", "patterns", "--urls", "urls", "--skip", "metrics:redis-client-ready"],
      env: { BENCH_STATIC_HOST: configured ? staticOrigin : "" },
      exit: (code) => { exitCode = code; throw exited; },
    },
    console: { log: (text) => output.push(text), error: (text) => output.push(text) },
    readFileSync: (path) => {
      if (path === "urls") return JSON.stringify(config);
      if (path === "patterns") return JSON.stringify({ start: "start", required: [], lastLine: [], forbidden: [] });
      if (path === "log") return "";
      throw new Error("Unexpected file read");
    },
    fetch: async (address, options = {}) => {
      const url = new URL(address);
      calls.push({ url: url.href, headers: options.headers });
      if (url.pathname === "/metrics") return new Response(`goodwatch_process_uptime_seconds 500\ngoodwatch_static_assets_in_use{mode="auto"} ${named ? 1 : 0}`);
      if (url.origin === staticOrigin) return new Response("fixture", {
        status: Number(status || (url.pathname === "/" ? 404 : 200)),
        headers: headers === "missing" ? {} : { "access-control-allow-origin": "*", "cache-control": "public, max-age=31536000, immutable", ...(headers === "local" ? {} : { "cf-cache-status": "HIT" }) },
      });
      if (url.pathname === "/") return new Response(`<script type="module" src="${named ? staticOrigin : ""}/assets/a.js"></script>`);
      if (url.pathname === "/assets/a.js") return new Response("fixture", { headers: { "cache-control": "max-age=31536000" } });
      throw new Error("Unexpected request");
    },
  });
  try {
    await vm.runInContext(`(async () => { ${source} })()`, context);
    assert.fail("The CLI must exit");
  } catch (error) {
    if (error !== exited) throw error;
  }
  return { status: exitCode, stdout: output.join("\n"), stderr: "", calls };
}

test("smoke checks the named static origin and keeps the origin build check", async () => {
  const result = await run({ configured: false });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /PASS\s+static:mode\s+pages name the static hostname; goodwatch_static_assets_in_use=1, mode=auto/);
  assert.match(result.stdout, /PASS\s+static:build-file/);
  assert.match(result.stdout, /PASS\s+static:root-404/);
  assert(result.calls.some((r) => r.url === "https://example.com/assets/a.js"));
  const staticCalls = result.calls.filter((r) => r.url.startsWith("https://static.example.com"));
  assert.deepEqual(staticCalls.map((r) => new URL(r.url).pathname), ["/assets/a.js", "/"]);
  assert(staticCalls.every((r) => !r.headers.Cookie && r.headers["User-Agent"].includes("Mozilla")));
});

test("static failures fail when pages name it and warn when pages name the site", async () => {
  const active = await run({ status: "503" });
  assert.equal(active.status, 1);
  assert.match(active.stdout, /FAIL\s+static:build-file/);
  assert.match(active.stdout, /FAIL\s+static:root-404/);
  const fallback = await run({ named: false, status: "503" });
  assert.equal(fallback.status, 0, fallback.stdout + fallback.stderr);
  assert.match(fallback.stdout, /pages name the site's host/);
  assert.match(fallback.stdout, /WARN\s+static:build-file/);
  assert.match(fallback.stdout, /WARN\s+static:root-404/);
});

test("smoke requires cache and CORS headers, with a CDN header exception for loopback", async () => {
  assert.equal((await run({ headers: "missing" })).status, 1);
  assert.equal((await run({ headers: "local" })).status, 1);
  const loopback = await run({ headers: "local", staticOrigin: "http://127.0.0.1:3112" });
  assert.equal(loopback.status, 0, loopback.stdout + loopback.stderr);
});

test("smoke reports when the static hostname cannot be checked", async () => {
  const result = await run({ named: false, configured: false });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /static hostname was not checked/);
  assert.doesNotMatch(result.stdout, /static:build-file|static:root-404/);
  assert(result.calls.every((r) => new URL(r.url).origin === "https://example.com"));
});
