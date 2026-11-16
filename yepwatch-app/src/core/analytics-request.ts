/** Analytics is best effort: a stalled endpoint must not keep requests alive indefinitely. */
export async function analyticsFetch(url: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
