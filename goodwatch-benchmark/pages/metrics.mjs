import { isSiteFamily } from "../scripts/static-host.mjs";
import {
  extractMetrics,
  lcpElement,
  median,
  medianMetrics,
} from "../scripts/budget.mjs";
export { median };
export const categories = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
];
export function validateInventory(inventory, routes) {
  const entries = [...inventory.pages, ...inventory.skippedRoutes];
  const errors = [];
  for (const route of routes)
    if (entries.filter((p) => p.route === route).length !== 1)
      errors.push(`Route must occur once: ${route}`);
  for (const entry of entries)
    if (!routes.includes(entry.route))
      errors.push(`Unknown route: ${entry.route}`);
  const ids = new Set();
  for (const p of inventory.pages) {
    if (ids.has(p.id)) errors.push(`Duplicate id: ${p.id}`);
    ids.add(p.id);
    if (
      !["P1", "P2", "P3"].includes(p.tier) ||
      !p.audience?.length ||
      p.audience.some((a) => !["guest", "member"].includes(a))
    )
      errors.push(`Invalid metadata: ${p.route}`);
    if (!p.examples?.length && !p.unavailable)
      errors.push(`Missing examples: ${p.route}`);
    for (const path of p.examples ?? [])
      if (!path.startsWith("/") || path.startsWith("//") || /[\r\n]/.test(path))
        errors.push(`Invalid path: ${p.route}`);
  }
  for (const p of inventory.skippedRoutes)
    if (!p.reason) errors.push(`Missing skip reason: ${p.route}`);
  return errors;
}
export function summarizeLighthouse(reports) {
  const valid = reports.filter(
    (r) =>
      !r.runtimeError &&
      categories.every((c) => typeof r.categories?.[c]?.score === "number"),
  );
  const failures = Object.fromEntries(
    categories.map((c) => [
      c,
      [
        ...new Map(
          valid.flatMap((r) =>
            (r.categories[c].auditRefs ?? [])
              .map((ref) => r.audits[ref.id])
              .filter((a) => a && typeof a.score === "number" && a.score < 1)
              .map((a) => [a.id, { id: a.id, title: a.title }]),
          ),
        ).values(),
      ],
    ]),
  );
  const metrics = medianMetrics(
    valid.map((r) => ({
      ...extractMetrics(r),
      fcp_ms: r.audits["first-contentful-paint"]?.numericValue,
      si_ms: r.audits["speed-index"]?.numericValue,
      ttfb_ms: r.audits["server-response-time"]?.numericValue,
      ...Object.fromEntries(
        categories.map((c) => [c, r.categories[c].score * 100]),
      ),
    })),
  );
  return {
    warnings: reports.flatMap((r, index) =>
      (r.runWarnings ?? []).map((message) => ({ run: index + 1, message })),
    ),
    runs: valid.length,
    attempted: reports.length,
    metrics,
    failedAudits: failures,
    lcpElements: valid.map(lcpElement),
    renderBlocking: valid.map(
      (r) => r.audits["render-blocking-insight"]?.details ?? null,
    ),
    thirdPartyOrigins: valid.map((r) => [
      ...new Set(
        (r.audits["network-requests"]?.details?.items ?? [])
          .filter((x) => /^https?:/.test(x.url))
          .map((x) => new URL(x.url).origin)
          .filter(
            (x) =>
              !isSiteFamily(
                x,
                new URL(r.finalDisplayedUrl || r.requestedUrl).origin,
              ),
          ),
      ),
    ]),
    errors: reports
      .filter((r) => r.runtimeError)
      .map((r) => r.runtimeError.code),
  };
}
const fmt = (v, d = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "n/a";
const cell = (v) => String(v).replaceAll("|", "\\|").replaceAll("\n", " ");
export function markdown(summary) {
  const out = [
    "# All-pages benchmark",
    "",
    `Started: ${summary.started}. Base: ${summary.baseUrl}. Audience: ${summary.audience}.`,
    "",
    `Lighthouse ${summary.lighthouseVersion}; ${summary.runs} runs per device; analytics blocking: ${summary.blockAnalytics}. GET only, two concurrent requests maximum. Browser request queuing changes lab timings.`,
    "",
  ];
  for (const tier of ["P1", "P2", "P3"]) {
    out.push(
      `## ${tier}`,
      "",
      "| Page | Mobile perf/a11y/bp/seo | Desktop perf | LCP ms | TBT ms | CLS | TTFB ms | HTML KB | JS KB | Top failed audits |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const p of summary.pages.filter((p) => p.tier === tier)) {
      const m = p.mobile?.metrics ?? {},
        d = p.desktop?.metrics ?? {};
      out.push(
        `| ${[
          p.path,
          categories.map((c) => fmt(m[c])).join("/"),
          fmt(d.performance),
          fmt(m.lcp_ms),
          fmt(m.tbt_ms),
          fmt(m.cls, 3),
          fmt(p.server?.medianTtfb),
          fmt(p.server?.medianBytes / 1024, 1),
          fmt(m.script_bytes / 1024, 1),
          Object.values(p.mobile?.failedAudits ?? {})
            .flat()
            .slice(0, 5)
            .map((a) => `${a.id}: ${a.title}`)
            .join("; ") ||
            p.error ||
            "",
        ]
          .map(cell)
          .join(" | ")} |`,
      );
    }
    out.push("");
  }
  if (summary.psi) {
    out.push(
      "## PageSpeed Insights",
      "",
      "| Page | Device | HTTP status | Performance | LCP ms | URL field data | Origin field data | Error |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const p of summary.pages)
      for (const [device, result] of Object.entries(p.psi ?? {}))
        out.push(
          `| ${[p.path, device, result.status, fmt(result.lab?.metrics?.performance), fmt(result.lab?.metrics?.lcp_ms), result.urlField?.metrics ? "Available" : "Unavailable", result.originField?.metrics ? "Available" : "Unavailable", result.error ?? ""].map(cell).join(" | ")} |`,
        );
    out.push("");
  }
  out.push(
    "## Slow server responses",
    "",
    "| Page | Request | Status | TTFB ms | Full response ms |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const p of summary.pages)
    for (const [label, r] of [
      ...(p.server?.samples ?? []).map((s, i) => ["Browser " + (i + 1), s]),
      ["Uncompressed", p.server?.uncompressed],
      ["Googlebot", p.server?.googlebot],
    ])
      if (r?.slow)
        out.push(
          `| ${[p.path, label, r.status, fmt(r.ttfb), fmt(r.totalMs)].map(cell).join(" | ")} |`,
        );
  out.push(
    "",
    "## Skipped and unavailable",
    "",
    ...summary.skipped.map((p) => `- ${p.route}: ${p.reason}`),
    "",
    "## Measurement errors",
    "",
    ...summary.pages.flatMap((p) =>
      (p.errors ?? []).map((e) => `- ${p.path}: ${e}`),
    ),
    "",
  );
  return out.join("\n");
}
export function compare(a, b) {
  const keys = [
    "performance",
    "accessibility",
    "best-practices",
    "seo",
    "fcp_ms",
    "lcp_ms",
    "tbt_ms",
    "cls",
    "si_ms",
    "ttfb_ms",
    "html_bytes",
    "host_requests",
    "origin_requests",
    "static_requests",
    "image_count",
    "font_requests",
    "blocking_requests",
    "third_party_origins",
    "script_count",
    "script_bytes",
    "image_bytes",
    "total_bytes",
  ];
  const out = [
    "# All-pages comparison",
    "",
    "Deltas are B minus A. Positive score changes improve; positive time and byte changes regress. Missing measurements remain n/a.",
    "",
    "| Page | Device | Metric | A | B | Delta |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const path of new Set([...a.pages, ...b.pages].map((p) => p.path)))
    for (const device of ["mobile", "desktop", "server"]) {
      const x = a.pages.find((p) => p.path === path),
        y = b.pages.find((p) => p.path === path);
      for (const k of device === "server"
        ? ["medianTtfb", "maxTtfb", "medianBytes"]
        : keys) {
        const av =
            device === "server" ? x?.server?.[k] : x?.[device]?.metrics?.[k],
          bv = device === "server" ? y?.server?.[k] : y?.[device]?.metrics?.[k];
        out.push(
          `| ${[path, device, k, fmt(av, 3), fmt(bv, 3), fmt(typeof av === "number" && typeof bv === "number" ? bv - av : undefined, 3)].map(cell).join(" | ")} |`,
        );
      }
    }
  return out.join("\n") + "\n";
}
