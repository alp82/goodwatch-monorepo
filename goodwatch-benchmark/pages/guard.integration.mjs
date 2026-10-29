// Optional Docker regression check. No production requests or host npm dependencies.
import assert from "node:assert/strict";
import http from "node:http";
import { mkdir, rm } from "node:fs/promises";
import puppeteer from "/usr/local/lib/node_modules/lighthouse/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
import { installGuard } from "./guard.mjs";
let active = 0,
  max = 0,
  writes = 0;
const server = http.createServer((req, res) => {
  if (req.method !== "GET") writes++;
  active++;
  max = Math.max(max, active);
  res.on("close", () => active--);
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><title>Guard regression</title><style>h1{color:navy}</style>' +
        [1, 2, 3]
          .map((n) => `<link rel="stylesheet" href="/style.css?${n}">`)
          .join("") +
        '<h1>Guard regression</h1><script>fetch("/write",{method:"POST"}).catch(()=>{});for(let n=0;n<6;n++)fetch("/slow?"+n)</script>',
    );
  } else {
    res.setHeader(
      "Content-Type",
      req.url.startsWith("/style.css") ? "text/css" : "text/plain",
    );
    setTimeout(() => res.end("h1{color:navy}"), 100);
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
await mkdir("/out/tmp", { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  userDataDir: "/out/integration-profile",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
  ],
});
try {
  const page = await browser.newPage();
  const url = `http://127.0.0.1:${server.address().port}`;
  const stats = await installGuard(page, { origin: url });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 15000 });
  const session = await page.createCDPSession();
  await session.send("DOM.enable");
  await session.send("CSS.enable", {}, { timeout: 5000 });
  assert.equal(writes, 0);
  assert.ok(max <= 2);
  assert.equal(stats.blockedMethods, 1);
  assert.equal(stats.maxConcurrent, 2);
  assert.equal(stats.responseErrors, 0);
  console.log(
    JSON.stringify({
      cssEnabled: true,
      writes,
      maxConcurrent: max,
      guard: stats,
    }),
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  await rm("/out/integration-profile", { recursive: true, force: true });
}
