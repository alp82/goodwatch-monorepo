export const analyticsHosts =
  /(^|\.)(posthog\.com|posthog\.net|sentry\.io|sentry-cdn\.com|google-analytics\.com|googletagmanager\.com|analytics\.google\.com|doubleclick\.net)$/i;
export function allowedRequest(method, url, blockAnalytics = false) {
  if (method !== "GET") return false;
  if (!/^https?:/.test(url)) return !/^wss?:/.test(url);
  const u = new URL(url);
  if (
    /^\/api\/(og-image-warm|auth(?:\/|$)|imports|update-|poster-impressions|e$)/.test(
      u.pathname,
    ) ||
    /^\/discord\/(link|add)/.test(u.pathname)
  )
    return false;
  return !blockAnalytics || !analyticsHosts.test(u.hostname);
}
/** Gate at Fetch request and response stages, including DevTools' stylesheet re-fetches. */
export async function installGuard(
  page,
  { blockAnalytics = false, origin, cookie } = {},
) {
  const session = await page.createCDPSession();
  const queue = [];
  const active = new Map();
  const networkIds = new Map();
  const stats = {
    blockedMethods: 0,
    blockedUrls: 0,
    maxConcurrent: 0,
    responseErrors: 0,
    repeatedPauses: 0,
  };
  await page.setBypassServiceWorker(true);
  await session.send("Network.enable");
  await session.send("Network.setBlockedURLs", { urls: ["ws://*", "wss://*"] });
  await page.evaluateOnNewDocument(() => {
    for (const key of ["Worker", "SharedWorker", "WebSocket"])
      Object.defineProperty(window, key, {
        value: class {
          constructor() {
            throw new Error("Disabled by benchmark request policy");
          }
        },
        writable: false,
        configurable: false,
      });
    if (navigator.serviceWorker)
      navigator.serviceWorker.register = async () => {
        throw new Error("Disabled by benchmark request policy");
      };
  });
  const release = (id) => {
    active.delete(id);
    for (const [networkId, fetchId] of networkIds)
      if (fetchId === id) networkIds.delete(networkId);
    pump();
  };
  const continueRequest = (e, slot, repeat = false) => {
    const headers = { ...e.request.headers, "Accept-Language": "en-US" };
    if (cookie && new URL(e.request.url).origin === origin) {
      for (const k of Object.keys(headers))
        if (k.toLowerCase() === "cookie") delete headers[k];
      headers.Cookie = cookie;
    }
    void session
      .send("Fetch.continueRequest", {
        requestId: e.requestId,
        headers: Object.entries(headers).map(([name, value]) => ({
          name,
          value: String(value),
        })),
        interceptResponse: !e.networkId,
      })
      .catch(() => {
        stats.responseErrors++;
        if (!repeat) release(slot);
      });
  };
  const pump = () => {
    while (active.size < 2 && queue.length) {
      const e = queue.shift();
      active.set(e.requestId, e.request.url);
      if (e.networkId) networkIds.set(e.networkId, e.requestId);
      stats.maxConcurrent = Math.max(stats.maxConcurrent, active.size);
      continueRequest(e, e.requestId);
    }
  };
  const networkDone = (e) => {
    const id = networkIds.get(e.requestId);
    if (id) release(id);
  };
  session.on("Network.loadingFailed", networkDone);
  session.on("Network.loadingFinished", networkDone);
  session.on("Network.requestWillBeSent", (e) => {
    if (e.redirectResponse) networkDone(e);
  });
  session.on("Fetch.requestPaused", async (e) => {
    if (e.responseStatusCode !== undefined || e.responseErrorReason) {
      try {
        // Inspector re-fetches have no Network ID or completion events. Read their full body before releasing.
        // Ordinary browser responses stream normally and release on Network.loadingFinished.
        // Redirects have no retrievable body and end at their response headers.
        if (
          !e.responseErrorReason &&
          !(e.responseStatusCode >= 300 && e.responseStatusCode < 400) &&
          e.responseStatusCode !== 204
        )
          await session.send("Fetch.getResponseBody", {
            requestId: e.requestId,
          });
        await session.send("Fetch.continueRequest", { requestId: e.requestId });
      } catch {
        stats.responseErrors++;
        await session
          .send("Fetch.failRequest", {
            requestId: e.requestId,
            errorReason: "Aborted",
          })
          .catch(() => {});
      } finally {
        release(e.requestId);
      }
      return;
    }
    if (!allowedRequest(e.request.method, e.request.url, blockAnalytics)) {
      stats[e.request.method === "GET" ? "blockedUrls" : "blockedMethods"]++;
      await session
        .send("Fetch.failRequest", {
          requestId: e.requestId,
          errorReason: "BlockedByClient",
        })
        .catch(() => {});
      return;
    }
    if (!/^https?:/.test(e.request.url)) {
      await session
        .send("Fetch.continueRequest", { requestId: e.requestId })
        .catch(() => {});
      return;
    }
    // Chromium can pause a font request again with a new Fetch ID but the same Network ID.
    // It still owns one slot. Queuing that continuation would make it wait for itself.
    const existing = e.networkId && networkIds.get(e.networkId);
    if (existing) {
      stats.repeatedPauses++;
      continueRequest(e, existing, true);
      return;
    }
    queue.push(e);
    pump();
  });
  await session.send("Fetch.enable", {
    patterns: [{ urlPattern: "*", requestStage: "Request" }],
  });
  return stats;
}

/** Redact string values recursively without corrupting JSON numbers or property names. */
export function redactCredentials(value, cookie) {
  const secrets = [
    cookie,
    ...cookie
      .split(";")
      .map((c) => c.trim().split("=").slice(1).join("="))
      .filter(Boolean),
  ];
  function visit(v) {
    if (typeof v === "string") {
      for (const secret of secrets)
        v =
          secret.length >= 16
            ? v.replaceAll(secret, "[redacted]")
            : v === secret
              ? "[redacted]"
              : v;
      return v;
    }
    if (Array.isArray(v)) return v.map(visit);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [
          k,
          /^(cookie|set-cookie|authorization)$/i.test(k)
            ? "[redacted]"
            : visit(x),
        ]),
      );
    return v;
  }
  return visit(value);
}
