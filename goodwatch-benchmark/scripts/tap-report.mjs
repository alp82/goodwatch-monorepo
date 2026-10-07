// Turns the measurements of `./bench.sh tap` (tap.jsonl in a run directory) into summary.json and summary.md.
//
//   node scripts/tap-report.mjs <run directory> [--strict]
//
// --strict exits with 1 when a tap was lost. Exit code 2 means the run has no usable measurement.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const STATUSES = ["effect", "lost", "absent", "missed", "invalid", "error"];
const MODE_TITLES = {
  early: "Tap right after the first paint",
  scroll: "Tap right after a fast scroll",
};

export function median(values) {
  const sorted = values.filter((value) => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Median, lowest, and highest of the values that exist. */
export function spread(values) {
  const present = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!present.length) return { median: null, min: null, max: null, count: 0 };
  return { median: median(present), min: Math.min(...present), max: Math.max(...present), count: present.length };
}

export function parseLines(text) {
  let header = null;
  const measurements = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      // A run that was cut off can end in half a line.
      continue;
    }
    if (row.type === "header") header = row;
    else if (row.type === "measurement") measurements.push(row);
  }
  return { header, measurements };
}

/** One row per page, mode, and control, in the order of the measurements. */
export function summarize(measurements) {
  const groups = new Map();
  for (const m of measurements) {
    const key = `${m.page}\n${m.mode}\n${m.control}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  return [...groups.values()].map((rows) => {
    const count = (status) => rows.filter((row) => row.status === status).length;
    const withEffect = rows.filter((row) => row.status === "effect");
    // A tap counts when it reached the control: it then had its effect, or it was lost.
    const taps = count("effect") + count("lost");
    const details = [...new Set(rows.filter((row) => row.detail).map((row) => `${row.status}: ${row.detail}`))];
    return {
      page: rows[0].page,
      mode: rows[0].mode,
      control: rows[0].control,
      name: rows.find((row) => row.name)?.name ?? null,
      runs: rows.length,
      taps,
      effect: count("effect"),
      lost: count("lost"),
      // Lost taps whose click went to another element because the layout moved, and lost taps without any click.
      lost_click_elsewhere: rows.filter((row) => row.status === "lost" && row.click_on_target === false).length,
      lost_without_click: rows.filter((row) => row.status === "lost" && row.click_on_target == null).length,
      other: Object.fromEntries(STATUSES.slice(2).map((status) => [status, count(status)]).filter(([, n]) => n > 0)),
      effect_ms: spread(withEffect.map((row) => row.effect_ms)),
      frame_ms: spread(withEffect.map((row) => row.frame_ms)),
      effect_ms_all: withEffect.map((row) => row.effect_ms),
      // Lost taps whose effect came after the limit, and the times.
      late_effect_ms_all: rows.filter((row) => row.status === "lost" && row.late_effect_ms != null).map((row) => row.late_effect_ms),
      // On the page's clock, from the start of the navigation.
      tap_at_ms: spread(rows.map((row) => row.tap_at_ms)),
      fcp_ms: spread(rows.map((row) => row.fcp_ms)),
      ready_ms: spread(rows.map((row) => row.ready_ms)),
      ready_at_tap: rows.filter((row) => row.ready_at_tap === true).length,
      input_delay_ms: spread(rows.map((row) => row.input_delay_ms)),
      click_delay_ms: spread(rows.map((row) => row.click_delay_ms)),
      scroll_ms: spread(rows.map((row) => row.scroll?.ms)),
      scroll_end_to_tap_ms: spread(rows.map((row) => row.scroll?.end_to_tap_ms)),
      details,
    };
  });
}

const ms = (value) => (value == null ? "n/a" : Math.round(value).toLocaleString("en-US"));
const range = (s) => (s.count ? `${ms(s.min)} to ${ms(s.max)}` : "n/a");
const table = (head, rows) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");

export function formatReport(summary) {
  const { rows, control_names: names = {}, config = {}, meta = {} } = summary;
  const lines = [`# Tap test: ${meta.run_id ?? "run"}`, ""];
  lines.push(
    `Target: ${meta.target_url ?? "n/a"}. Time: ${summary.started_at ?? "n/a"}. Where: ${meta.where ?? "n/a"}. Runs per control and mode: ${config.runs ?? "n/a"}. ` +
      `CPU slowdown: ${config.cpu ?? "n/a"}x. Network throttling: ${config.network ?? "n/a"}. Lost tap: no effect within ${ms(config.timeout_ms)} ms. ` +
      `Browser: ${summary.browser ?? "n/a"}. Git: ${meta.git_commit ?? "n/a"}${meta.git_dirty ? " (dirty)" : ""}.`,
    "",
    `Result: ${summary.totals.effect} of ${summary.totals.taps} taps had their effect. Lost taps: ${summary.totals.lost}.` +
      (summary.totals.other ? ` Measurements without a tap on the control: ${summary.totals.other} (see "Other and details").` : ""),
    "",
  );
  for (const page of [...new Set(rows.map((row) => row.page))]) {
    for (const mode of [...new Set(rows.filter((row) => row.page === page).map((row) => row.mode))]) {
      const group = rows.filter((row) => row.page === page && row.mode === mode);
      lines.push(`## ${page}: ${MODE_TITLES[mode] ?? mode}`, "");
      const other = (row) => Object.entries(row.other).map(([status, n]) => `${n} ${status}`).join(", ") || "0";
      if (mode === "early") {
        lines.push(`First paint: median ${ms(median(group.map((row) => row.fcp_ms.median)))} ms after the start of the navigation.`, "");
        lines.push(
          table(
            ["Control", "Effect", "Lost", "Lost: click elsewhere", "Other", "Time to effect, median (ms)", "Lowest to highest (ms)", "Tap at (ms)", "Script took over at (ms)"],
            group.map((row) => [row.control, `${row.effect} of ${row.taps}`, `${row.lost} of ${row.taps}`, row.lost_click_elsewhere, other(row), ms(row.effect_ms.median), range(row.effect_ms), ms(row.tap_at_ms.median), ms(row.ready_ms.median)]),
          ),
        );
      } else {
        lines.push(
          table(
            ["Control", "Effect", "Lost", "Lost: click elsewhere", "Other", "Time to effect, median (ms)", "Lowest to highest (ms)", "Scroll (ms)", "Scroll end to tap (ms)", "Script had taken over"],
            group.map((row) => [row.control, `${row.effect} of ${row.taps}`, `${row.lost} of ${row.taps}`, row.lost_click_elsewhere, other(row), ms(row.effect_ms.median), range(row.effect_ms), ms(row.scroll_ms.median), ms(row.scroll_end_to_tap_ms.median), `${row.ready_at_tap} of ${row.runs}`]),
          ),
        );
      }
      lines.push("");
    }
  }
  const late = rows.filter((row) => row.late_effect_ms_all.length);
  if (late.length) {
    lines.push("## Late effects", "", "Lost taps whose effect still came, after the limit:", "");
    for (const row of late) lines.push(`- ${row.page}, ${row.mode}, ${row.control}: ${row.late_effect_ms_all.length} of ${row.lost} lost taps, after ${row.late_effect_ms_all.map(ms).join(", ")} ms`);
    lines.push("");
  }
  const noted = rows.filter((row) => row.details.length);
  if (noted.length) {
    lines.push("## Other and details", "");
    for (const row of noted) for (const detail of row.details) lines.push(`- ${row.page}, ${row.mode}, ${row.control}: ${detail}`);
    lines.push("");
  }
  lines.push("## Console", "");
  if (summary.react_errors.length) lines.push(`React errors: ${summary.react_errors.map((e) => `#${e.code} in ${e.measurements} measurements`).join(", ")}.`, "");
  else lines.push("No React error in the console.", "");
  if (summary.console_errors.length) {
    lines.push(table(["Measurements", "Message"], summary.console_errors.slice(0, 15).map((e) => [e.measurements, e.message.replace(/\|/g, "\\|")])), "");
  } else lines.push("No console error.", "");
  if (summary.requests_with_body.length) lines.push(`Requests other than GET that pages sent: ${summary.requests_with_body.join(", ")}.`, "");
  if (summary.blocked_requests.length) lines.push(`Blocked because they write: ${summary.blocked_requests.join(", ")}.`, "");
  lines.push("## Controls", "");
  for (const control of [...new Set(rows.map((row) => row.control))]) {
    const tapped = [...new Set(rows.filter((row) => row.control === control && row.name).map((row) => `"${row.name}"`))];
    lines.push(`- \`${control}\`: ${names[control] ?? control}${tapped.length ? `. Tapped: ${tapped.join(", ")}` : ""}`);
  }
  lines.push(
    "",
    'Time to effect runs from the finger going down to the change in the document. "Lost: click elsewhere" counts the lost taps whose click went to another element, because the layout moved between the finger going down and the browser handling the tap. "Script took over at" is when React had attached the control\'s node, or Swiper had started the row, after the start of the navigation.',
    "",
  );
  return lines.join("\n");
}

export function buildSummary({ header, measurements }, meta = {}) {
  const rows = summarize(measurements);
  const tally = (pick) => {
    const counts = new Map();
    for (const m of measurements) for (const item of new Set(pick(m) ?? [])) counts.set(item, (counts.get(item) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    schema: 1,
    kind: "tap",
    run_id: meta.run_id ?? null,
    label: meta.label ?? null,
    started_at: header?.started_at ?? null,
    browser: header?.browser ?? null,
    viewport: header?.viewport ?? null,
    config: header?.config ?? {},
    control_names: header?.control_names ?? {},
    meta: { run_id: meta.run_id ?? null, target_url: meta.target_url ?? null, path: meta.path ?? null, where: meta.tap?.where ?? null, git_commit: meta.git_commit ?? null, git_dirty: Boolean(meta.git_dirty) },
    planned: header?.planned ?? null,
    measured: measurements.length,
    totals: {
      taps: rows.reduce((sum, row) => sum + row.taps, 0),
      effect: rows.reduce((sum, row) => sum + row.effect, 0),
      lost: rows.reduce((sum, row) => sum + row.lost, 0),
      other: rows.reduce((sum, row) => sum + row.runs - row.taps, 0),
    },
    rows,
    react_errors: tally((m) => m.react_errors).map(([code, n]) => ({ code, measurements: n })),
    console_errors: tally((m) => m.console_errors).map(([message, n]) => ({ message, measurements: n })),
    requests_with_body: tally((m) => m.requests_with_body).map(([what]) => what),
    blocked_requests: tally((m) => m.blocked_requests).map(([what]) => what),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const dir = args.find((arg) => !arg.startsWith("--"));
  if (!dir || !existsSync(`${dir}/tap.jsonl`)) {
    console.error("Usage: tap-report.mjs <run directory with tap.jsonl> [--strict]");
    process.exit(2);
  }
  const parsed = parseLines(readFileSync(`${dir}/tap.jsonl`, "utf8"));
  const meta = existsSync(`${dir}/meta.json`) ? JSON.parse(readFileSync(`${dir}/meta.json`, "utf8")) : {};
  const summary = buildSummary(parsed, meta);
  writeFileSync(`${dir}/summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(`${dir}/summary.md`, formatReport(summary));
  if (!summary.measured) {
    console.error("The run has no measurement. See tap.log in the run directory.");
    process.exit(2);
  }
  if (summary.planned != null && summary.measured < summary.planned) console.error(`The run stopped early: ${summary.measured} of ${summary.planned} measurements.`);
  if (strict && summary.totals.lost > 0) process.exit(1);
}
