import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";
export const browserHeaders = {
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html",
  "accept-language": "en-US",
  "accept-encoding": "br, gzip",
  cookie: "gw_browser=1",
};
export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
// Node's HTTP client preserves wire bytes and handles 103 Early Hints. fetch() decompresses automatically.
export function request(
  url,
  headers = {},
  { limit = 30_000_000, timeout = 60_000 } = {},
) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = (url.startsWith("https:") ? https : http).get(
      url,
      { headers, agent: false },
      (res) => {
        const ttfb = performance.now() - start;
        let bytes = 0;
        const chunks = [];
        res.on("data", (c) => {
          bytes += c.length;
          if (bytes > limit)
            req.destroy(new Error("Response exceeds byte limit"));
          else chunks.push(c);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            ttfb,
            totalMs: performance.now() - start,
            bytes,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
        res.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Request deadline exceeded")),
      timeout,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
  });
}
export function responseRecord(r) {
  return {
    status: r.status,
    ttfb: r.ttfb,
    totalMs: r.totalMs,
    bytes: r.bytes,
    slow: r.ttfb > 1000 || r.totalMs > 1000,
    headers: Object.fromEntries(
      [
        "gw-page-cache",
        "server-timing",
        "cache-control",
        "content-encoding",
        "location",
        "content-type",
      ].map((k) => [k, r.headers[k] ?? null]),
    ),
  };
}
export async function serverMeasurements(url, cookie) {
  const headers = { ...browserHeaders, cookie: cookie || "gw_browser=1" };
  const samples = [];
  for (let i = 0; i < 5; i++) {
    samples.push(responseRecord(await request(url, headers)));
    await delay(1000);
  }
  const identity = { ...headers };
  delete identity["accept-encoding"];
  const uncompressed = responseRecord(await request(url, identity));
  await delay(1000);
  const googlebot = responseRecord(
    await request(url, {
      ...headers,
      "user-agent":
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    }),
  );
  return { samples, uncompressed, googlebot };
}
export async function psi(url, strategy) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await request(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&category=accessibility&category=best-practices&category=seo`,
      {},
      { timeout: 180_000 },
    );
    try {
      const data = JSON.parse(r.body.toString());
      if (r.status === 200)
        return {
          status: r.status,
          lighthouseResult: data.lighthouseResult,
          loadingExperience: data.loadingExperience ?? null,
          originLoadingExperience: data.originLoadingExperience ?? null,
        };
      last = { status: r.status, error: data.error?.message ?? "PSI failed" };
    } catch {
      last = { status: r.status, error: "Invalid PSI response" };
    }
    if (![429, 500, 502, 503, 504].includes(r.status)) break;
    if (attempt < 3) await delay(15_000 * (attempt + 1));
  }
  return last;
}
