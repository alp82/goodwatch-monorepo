// Adds to each browser entry of a resolved URL set what a real page load sent to the site and static hostname.
// Input: the resolved set (scripts/prepare-load.mjs) and the capture (page-view/capture.mjs). Output: the set for
// the page-view scenario on stdout, and one line per surface on stderr. No path is printed.
import { readFileSync } from "node:fs";
import { staticOriginFromSetting } from "./static-host.mjs";

// Requests with a body that a page view replays. Each one only reads.
// The error tracking tunnel (POST /api/e) is not on the list: the app forwards every envelope to the vendor.
const REPLAYED_POSTS = [/^\/api\/living-room\/picks\?view=pool$/];

export function buildSet(set, capture, { files = "page", staticHost } = {}) {
  if (!["page", "origin"].includes(files)) throw new Error("PAGE_FILES must be page or origin");
  const setting = staticOriginFromSetting(staticHost);
  const pages = new Map(capture.pages.map((page) => [page.path, page]));
  const report = [];
  const totals = [];
  const staticOrigins = new Set();
  const empty = () => Object.fromEntries(["site", "static", "other"].map((host) => [host, { requests: 0, transfer_bytes: 0, connections: 0 }]));
  let pageNames = "origin";
  const entries = set.entries.map((entry) => {
    const hosts = empty();
    totals.push({ weight: Number(entry.weight), hosts });
    hosts.site.requests = 1;
    hosts.site.connections = 1;
    if (entry.client !== "browser" || entry.single) return entry;
    const page = pages.get(entry.path);
    if (!page) throw new Error(`No captured page load for ${entry.route}`);
    const staticOrigin = staticOriginFromSetting(page.static_origin) || (setting && page.requests.some((r) => r.origin === setting) ? setting : null);
    const classify = (r) => (r.origin ? r.origin === capture.origin : r.own) ? "site" : staticOrigin && r.origin === staticOrigin ? "static" : "other";
    const document = page.requests.find((r) => classify(r) === "site" && r.type === "Document" && r.path === entry.path);
    if (!document || document.status !== 200) throw new Error(`The captured page load of ${entry.route} did not answer 200`);
    if (staticOrigin && staticOrigin !== capture.origin) {
      pageNames = "static";
      staticOrigins.add(staticOrigin);
    }
    const view = { requests: [], side: [], skipped: [] };
    const eligible = [];
    for (const r of page.requests) {
      const source = classify(r);
      const host = source === "static" && files === "origin" ? "site" : source;
      hosts[host].transfer_bytes += r.transfer_bytes || 0;
      if (source === "other") {
        hosts.other.requests++;
        continue;
      }
      if (r === document) continue;
      const item = { method: r.method, path: r.path, type: r.type.toLowerCase(), host };
      const skip = (reason) => view.skipped.push({ ...item, reason, request_body_bytes: r.request_body_bytes ?? 0 });
      if (r.method === "POST") {
        if (source !== "site" || !REPLAYED_POSTS.some((rule) => rule.test(r.path))) { skip("POST that is not on the replay list"); continue; }
        if (r.body === undefined) { skip("POST body not captured"); continue; }
        if (r.status !== 200) { skip(`answered ${r.status}`); continue; }
        item.body = r.body;
      } else if (r.method !== "GET") { skip(`method ${r.method}`); continue; }
      else if (r.failed) { skip("failed in the browser"); continue; }
      else if (r.status !== 200) { skip(`answered ${r.status ?? "nothing"}`); continue; }
      eligible.push({ r, item, source });
      hosts[host].requests++;
    }
    const staticConnections = new Map();
    for (const { r, source } of eligible) if (source === "static") staticConnections.set(r.connection, (staticConnections.get(r.connection) || 0) + 1);
    const mainStatic = [...staticConnections].sort((a, b) => b[1] - a[1])[0]?.[0];
    const manifestConnection = eligible.find(({ r, source }) => source === "site" && r.type === "Manifest" && r.connection !== document.connection)?.r.connection ?? "manifest";
    const groups = new Map();
    for (const { r, item, source } of eligible) {
      let side = source === "site" ? r.method !== "POST" && r.connection !== document.connection : r.connection !== mainStatic;
      let connection = r.connection;
      if (source === "static" && files === "origin") {
        side = r.type === "Manifest" || /\.webmanifest(?:\?|$)/.test(r.path);
        connection = manifestConnection;
      }
      if (!side) view.requests.push(item);
      else {
        const key = `${item.host}:${connection}`;
        if (!groups.has(key)) groups.set(key, { host: item.host, requests: [] });
        groups.get(key).requests.push(item);
      }
    }
    view.side = [...groups.values()];
    hosts.static.connections = view.requests.some((r) => r.host === "static") ? 1 : 0;
    for (const group of view.side) hosts[group.host].connections++;
    view.transfer_bytes = hosts.site.transfer_bytes + hosts.static.transfer_bytes;
    view.connections = hosts.site.connections + hosts.static.connections;
    view.protocol = document.protocol ?? null;
    view.tls = document.tls ?? null;
    if (!report.some((line) => line.route === entry.route))
      report.push({
        route: entry.route,
        requests: hosts.site.requests + hosts.static.requests,
        connections: view.connections,
        transfer_bytes: view.transfer_bytes,
        hosts,
        skipped: view.skipped.map((s) => `${s.method} ${s.path.split("?")[0]} (${s.request_body_bytes} bytes sent)`),
        third_party: hosts.other.requests,
      });
    return { ...entry, view };
  });
  if (staticOrigins.size > 1) throw new Error("The capture names more than one static origin; capture the pages again");
  // Weighted per visit, including single-request visitors. Bytes describe the captured load, including skipped rows.
  const weight = totals.reduce((sum, e) => sum + e.weight, 0);
  const perVisit = empty();
  for (const { weight: w, hosts } of totals)
    for (const host of Object.keys(perVisit))
      for (const key of Object.keys(perVisit[host])) perVisit[host][key] += w * hosts[host][key] / weight;
  return {
    set: { ...set, scenario: "page-view", captured_at: capture.captured_at, static_url: [...staticOrigins][0] ?? null, files, page_names: pageNames, per_visit: perVisit, requests_per_visit: perVisit.site.requests + perVisit.static.requests, connections_per_visit: perVisit.site.connections + perVisit.static.connections, entries },
    report,
  };
}

if (process.argv[1] && process.argv[1].endsWith("page-view-set.mjs")) {
  try {
    const { set, report } = buildSet(JSON.parse(readFileSync(process.argv[2], "utf8")), JSON.parse(readFileSync(process.argv[3], "utf8")), { files: process.env.PAGE_FILES || "page", staticHost: process.env.BENCH_STATIC_HOST });
    for (const line of report)
      console.error(
        `Page view ${line.route}: ${line.requests} requests on ${line.connections} connections, ${Math.round(line.transfer_bytes / 1024)} KB` +
          (line.skipped.length ? `; not sent: ${line.skipped.join(", ")}` : "") +
          `; site ${line.hosts.site.requests} requests, ${Math.round(line.hosts.site.transfer_bytes / 1024)} KB, ${line.hosts.site.connections} connections; static ${line.hosts.static.requests} requests, ${Math.round(line.hosts.static.transfer_bytes / 1024)} KB, ${line.hosts.static.connections} connections; others ${line.third_party} requests, ${Math.round(line.hosts.other.transfer_bytes / 1024)} KB`,
      );
    console.error(`One visit: ${set.requests_per_visit.toFixed(1)} requests on ${set.connections_per_visit.toFixed(2)} connections on average`);
    console.log(JSON.stringify(set, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
