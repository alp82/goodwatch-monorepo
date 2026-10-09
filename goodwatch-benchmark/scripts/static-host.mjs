// Shared rules for the static hostname. These helpers never send requests.
export function staticOriginFromSetting(value) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.includes("://") ? value.trim() : `https://${value.trim()}`);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new Error("BENCH_STATIC_HOST must be a hostname or an HTTP(S) origin");
  }
}

export function buildFilesInHtml(html, siteOrigin) {
  const urls = [];
  // Read address attributes, not matching text inside inline scripts or comments.
  const markup = html.replace(/<!--[\s\S]*?-->/g, "").replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, "$1");
  for (const [tag] of markup.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const address = tag.match(/\s(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!address) continue;
    try {
      const url = new URL((address[1] ?? address[2] ?? address[3]).replace(/&amp;/g, "&"), siteOrigin);
      if (["http:", "https:"].includes(url.protocol) && /^\/assets\/[^/]+\.js$/.test(url.pathname)) urls.push(url);
    } catch {
      // Ignore malformed addresses; the caller reports when no build file was found.
    }
  }
  return urls;
}

export function staticOriginInHtml(html, siteOrigin) {
  return buildFilesInHtml(html, siteOrigin).find((url) => url.origin !== new URL(siteOrigin).origin)?.origin ?? null;
}

export function isSiteFamily(origin, siteOrigin) {
  const host = new URL(origin).hostname;
  const site = new URL(siteOrigin).hostname;
  return host === site || host.endsWith(`.${site}`);
}
