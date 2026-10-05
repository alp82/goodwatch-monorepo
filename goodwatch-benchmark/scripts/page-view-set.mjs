// Adds to each browser entry of a resolved URL set what a real page load of it sent to the page's own origin.
// Input: the resolved set (scripts/prepare-load.mjs) and the capture (page-view/capture.mjs). Output: the set for
// the page-view scenario on stdout, and one line per surface on stderr. No path is printed.
import { readFileSync } from "node:fs";

// Requests with a body that a page view replays. Each one only reads.
// The error tracking tunnel (POST /api/e) is not on the list: the app forwards every envelope to the vendor.
const REPLAYED_POSTS = [/^\/api\/living-room\/picks\?view=pool$/];

export function buildSet(set, capture) {
  const pages = new Map(capture.pages.map((page) => [page.path, page]));
  const report = [];
  const entries = set.entries.map((entry) => {
    if (entry.client !== "browser" || entry.single) return entry;
    const page = pages.get(entry.path);
    if (!page) throw new Error(`No captured page load for ${entry.route}`);
    const own = page.requests.filter((r) => r.own);
    const document = own.find((r) => r.type === "Document" && r.path === entry.path);
    if (!document || document.status !== 200) throw new Error(`The captured page load of ${entry.route} did not answer 200`);
    const view = { requests: [], side: [], skipped: [] };
    for (const r of own) {
      if (r === document) continue;
      const item = { method: r.method, path: r.path, type: r.type.toLowerCase() };
      const skip = (reason) => view.skipped.push({ ...item, reason, request_body_bytes: r.request_body_bytes ?? 0 });
      if (r.method === "POST") {
        if (!REPLAYED_POSTS.some((rule) => rule.test(r.path))) skip("POST that is not on the replay list");
        else if (r.body === undefined) skip("POST body not captured");
        else if (r.status !== 200) skip(`answered ${r.status}`);
        else view.requests.push({ ...item, body: r.body });
      } else if (r.method !== "GET") skip(`method ${r.method}`);
      else if (r.failed) skip("failed in the browser");
      else if (r.status !== 200) skip(`answered ${r.status ?? "nothing"}`);
      else if (r.connection === document.connection) view.requests.push(item);
      else view.side.push(item);
    }
    view.transfer_bytes = own.reduce((sum, r) => sum + (r.transfer_bytes || 0), 0);
    view.connections = new Set(own.map((r) => r.connection).filter((id) => id !== undefined)).size;
    view.protocol = document.protocol ?? null;
    view.tls = document.tls ?? null;
    if (!report.some((line) => line.route === entry.route))
      report.push({
        route: entry.route,
        requests: 1 + view.requests.length + view.side.length,
        connections: view.connections,
        transfer_bytes: view.transfer_bytes,
        skipped: view.skipped.map((s) => `${s.method} ${s.path.split("?")[0]} (${s.request_body_bytes} bytes sent)`),
        third_party: page.requests.filter((r) => !r.own).length,
      });
    return { ...entry, view };
  });
  // What one visit sends on average, by weight. The launcher's request limit uses it.
  const weight = entries.reduce((sum, e) => sum + e.weight, 0);
  const requestsPerVisit = entries.reduce((sum, e) => sum + e.weight * (e.view ? 1 + e.view.requests.length + e.view.side.length : 1), 0) / weight;
  const connectionsPerVisit = entries.reduce((sum, e) => sum + e.weight * (e.view?.side.length ? 2 : 1), 0) / weight;
  return {
    set: { ...set, scenario: "page-view", captured_at: capture.captured_at, requests_per_visit: requestsPerVisit, connections_per_visit: connectionsPerVisit, entries },
    report,
  };
}

if (process.argv[1] && process.argv[1].endsWith("page-view-set.mjs")) {
  try {
    const { set, report } = buildSet(JSON.parse(readFileSync(process.argv[2], "utf8")), JSON.parse(readFileSync(process.argv[3], "utf8")));
    for (const line of report)
      console.error(
        `Page view ${line.route}: ${line.requests} requests on ${line.connections} connections, ${Math.round(line.transfer_bytes / 1024)} KB` +
          (line.skipped.length ? `; not sent: ${line.skipped.join(", ")}` : "") +
          `; ${line.third_party} requests to other hosts`,
      );
    console.error(`One visit: ${set.requests_per_visit.toFixed(1)} requests on ${set.connections_per_visit.toFixed(2)} connections on average`);
    console.log(JSON.stringify(set, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
