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
/** Hold requests until a slot is free. Released only when the full response finishes or fails. */
export async function installGuard(
  page,
  { blockAnalytics = false, origin, cookie } = {},
) {
  const queue = [];
  const active = new Set();
  const stats = { blockedMethods: 0, blockedUrls: 0, maxConcurrent: 0 };
  await page.setBypassServiceWorker(true);
  const session = await page.createCDPSession();
  await session.send("Network.enable");
  await session.send("Network.setBlockedURLs", { urls: ["ws://*", "wss://*"] });
  await page.evaluateOnNewDocument(() => {
    for (const key of ["Worker", "SharedWorker", "WebSocket"]) {
      Object.defineProperty(window, key, {
        value: class {
          constructor() {
            throw new Error("Disabled by benchmark request policy");
          }
        },
        writable: false,
        configurable: false,
      });
    }
    if (navigator.serviceWorker)
      navigator.serviceWorker.register = async () => {
        throw new Error("Disabled by benchmark request policy");
      };
  });
  await page.setRequestInterception(true);
  const pump = () => {
    while (active.size < 2 && queue.length) {
      const r = queue.shift();
      active.add(r);
      stats.maxConcurrent = Math.max(stats.maxConcurrent, active.size);
      const headers = { ...r.headers(), "accept-language": "en-US" };
      // Scope credentials to the supplied origin. Never use Lighthouse's extraHeaders (also sent to third parties).
      if (cookie && new URL(r.url()).origin === origin) headers.cookie = cookie;
      r.continue({ headers }).catch(() => {
        active.delete(r);
        pump();
      });
    }
  };
  page.on("request", (r) => {
    if (!allowedRequest(r.method(), r.url(), blockAnalytics)) {
      stats[r.method() === "GET" ? "blockedUrls" : "blockedMethods"]++;
      void r.abort().catch(() => {});
      return;
    }
    if (!/^https?:/.test(r.url())) {
      void r.continue().catch(() => {});
      return;
    }
    queue.push(r);
    pump();
  });
  const release = (r) => {
    active.delete(r);
    pump();
  };
  page.on("requestfinished", release);
  page.on("requestfailed", release);
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
