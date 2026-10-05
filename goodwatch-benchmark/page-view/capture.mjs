// Runs inside the Lighthouse image, which holds Chromium and puppeteer-core. Loads each page once as a first-time
// mobile visitor (new browser profile, empty cache) and prints what the browser asked the page's own origin for.
// The page's scripts run, so analytics count each capture as one page view.
//
//   node capture.mjs <origin> <settle seconds> <resolve address or ''> <path> [<path> ...]
import { createRequire } from "node:module";

const require = createRequire("/usr/local/lib/node_modules/lighthouse/");
const puppeteer = require("puppeteer-core");
const [origin, settleArg, resolveIp, ...paths] = process.argv.slice(2);
const settle = Number(settleArg);
if (!/^https?:\/\/[^/]+$/.test(origin || "") || !(settle > 0) || !paths.length) {
  console.error("Usage: capture.mjs <origin> <settle seconds> <resolve address or ''> <path> [<path> ...]");
  process.exit(2);
}
const host = new URL(origin).hostname;
const args = ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"];
if (resolveIp) args.push(`--host-resolver-rules=MAP ${host} ${resolveIp}`);
const userAgent =
  process.env.BROWSER_UA ||
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function capture(path) {
  // A new browser per page: no cache, no cookies, no open connection, no TLS session from the page before.
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/chromium", args });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
    const client = await page.createCDPSession();
    await client.send("Network.enable");
    const requests = new Map();
    client.on("Network.requestWillBeSent", (e) => {
      // A redirect reuses the request id: keep the hop it answers as its own row.
      if (e.redirectResponse && requests.has(e.requestId)) {
        const hop = requests.get(e.requestId);
        hop.status = e.redirectResponse.status;
        requests.set(`${e.requestId}:${requests.size}`, hop);
      }
      requests.set(e.requestId, {
        url: e.request.url,
        method: e.request.method,
        type: e.type || "Other",
        request_body_bytes: e.request.postData?.length ?? (e.request.hasPostData ? null : 0),
        // Small bodies only: the page-view set replays an allowed read that a page sends with POST.
        body: e.request.postData && e.request.postData.length <= 4096 ? e.request.postData : undefined,
        t_ms: Math.round(e.timestamp * 1000),
      });
    });
    client.on("Network.responseReceived", (e) => {
      const row = requests.get(e.requestId);
      if (!row) return;
      row.status = e.response.status;
      row.protocol = e.response.protocol;
      row.connection = e.response.connectionId;
      row.from_cache = Boolean(e.response.fromDiskCache || e.response.fromPrefetchCache);
      row.cache_control = e.response.headers["cache-control"] ?? e.response.headers["Cache-Control"] ?? null;
      row.content_encoding = e.response.headers["content-encoding"] ?? null;
      const tls = e.response.securityDetails;
      if (tls) row.tls = { protocol: tls.protocol, key_exchange_group: tls.keyExchangeGroup || null, cipher: tls.cipher };
    });
    client.on("Network.loadingFinished", (e) => {
      const row = requests.get(e.requestId);
      if (row) row.transfer_bytes = e.encodedDataLength;
    });
    client.on("Network.loadingFailed", (e) => {
      const row = requests.get(e.requestId);
      if (row) row.failed = e.errorText || "failed";
    });
    const started = Date.now();
    const response = await page.goto(origin + path, { waitUntil: "load", timeout: 60000 });
    const loadMs = Date.now() - started;
    // The page loads analytics and error tracking after it is interactive, and their requests follow.
    await sleep(settle * 1000);
    const first = Math.min(...[...requests.values()].map((r) => r.t_ms));
    const rows = [...requests.values()]
      .filter((r) => /^https?:/.test(r.url))
      .map((r) => {
        const url = new URL(r.url);
        return { ...r, url: undefined, host: url.hostname, own: url.origin === origin, path: url.pathname + url.search, t_ms: r.t_ms - first };
      })
      .sort((a, b) => a.t_ms - b.t_ms);
    return { path, status: response?.status() ?? null, load_ms: loadMs, settle_s: settle, requests: rows };
  } finally {
    await browser.close();
  }
}

const pages = [];
for (const path of paths) {
  try {
    pages.push(await capture(path));
  } catch (error) {
    console.error(`Capture failed: ${error.message}`);
    process.exitCode = 1;
  }
}
console.log(JSON.stringify({ origin, captured_at: new Date().toISOString(), user_agent: userAgent, pages }));
