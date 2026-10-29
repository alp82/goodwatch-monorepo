#!/usr/bin/env node
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  median,
  validateInventory,
  summarizeLighthouse,
  markdown,
  compare,
} from "./metrics.mjs";
import { serverMeasurements, psi, delay } from "./network.mjs";
const here = dirname(fileURLToPath(import.meta.url));
function args(argv) {
  const o = {
    baseUrl: "https://goodwatch.app",
    tiers: ["P1", "P2", "P3"],
    runs: 3,
    label: "baseline",
    image: "gw-bench-lighthouse:pages-13.5.0",
    blockAnalytics: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (!argv[i + 1] || argv[i + 1].startsWith("--"))
        throw Error(`Missing value for ${a}`);
      return argv[++i];
    };
    if (a === "--compare") return { compare: [value(), value()] };
    if (a === "--base-url") o.baseUrl = value().replace(/\/$/, "");
    else if (a === "--tier") o.tiers = value().toUpperCase().split(",");
    else if (a === "--runs") o.runs = Number(value());
    else if (a === "--label") o.label = value();
    else if (a === "--cookie-file") o.cookieFile = resolve(value());
    else if (a === "--image") o.image = value();
    else if (a === "--only") o.only = value();
    else if (a === "--resume") o.resume = resolve(value());
    else if (a === "--psi") o.psi = true;
    else if (a === "--server-only") o.serverOnly = true;
    else if (a === "--block-analytics") o.blockAnalytics = true;
    else if (a === "--verify") o.verify = true;
    else if (a === "--help") {
      console.log(
        "run.mjs [--base-url URL] [--tier P1,P2,P3] [--runs 3] [--label NAME] [--psi] [--cookie-file PATH] [--block-analytics] [--only PATH] [--resume RUN_DIR] [--verify] [--server-only] [--image IMAGE]\nrun.mjs --compare RUN_A RUN_B",
      );
      process.exit(0);
    } else throw Error(`Unknown option ${a}`);
  }
  if (
    !Number.isInteger(o.runs) ||
    o.runs < 1 ||
    o.tiers.some((t) => !["P1", "P2", "P3"].includes(t)) ||
    !/^[-a-zA-Z0-9_]+$/.test(o.label)
  )
    throw Error("Invalid runs, tier, or label");
  if (!["http:", "https:"].includes(new URL(o.baseUrl).protocol))
    throw Error("Base URL must use HTTP(S)");
  return o;
}
function execute(command, argv, { timeout = 240_000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, argv, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (c) => {
      stderr = (stderr + c).slice(-4000);
    });
    const timer = setTimeout(() => p.kill("SIGTERM"), timeout);
    p.on("error", reject);
    p.on("exit", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve()
        : reject(
            Error(
              `Lighthouse process exited ${code}. Details retained in private error log.`,
            ),
          );
    });
    p.on("close", () => {
      if (stderr)
        void writeFile(join(currentOutput, "last-process-error.log"), stderr, {
          mode: 0o600,
        });
    });
  });
}
let currentOutput;
async function main() {
  const o = args(process.argv.slice(2));
  const readSummary = async (path) =>
    JSON.parse(await readFile(join(resolve(path), "summary.json"), "utf8"));
  if (o.compare) {
    console.log(compare(...(await Promise.all(o.compare.map(readSummary)))));
    return;
  }
  const inventory = JSON.parse(
    await readFile(join(here, "pages.json"), "utf8"),
  );
  const routes = await readdir(join(here, "../../goodwatch-webapp/app/routes"));
  const errors = validateInventory(inventory, routes);
  if (errors.length) throw Error(errors.join("\n"));
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z/, "Z");
  const output =
    o.resume ?? join(here, "../results", `${timestamp}-pages-${o.label}`);
  currentOutput = output;
  await mkdir(output, { recursive: true, mode: 0o700 });
  const lock = join(here, "../results/.pages-lock");
  await mkdir(lock).catch(() => {
    throw Error(
      "Another pages runner holds results/.pages-lock. Inspect its process before removing a stale lock.",
    );
  });
  const scratchRoot = join(homedir(), ".cache/gw-perf/scratch-bench");
  await mkdir(scratchRoot, { recursive: true, mode: 0o700 });
  const jobFolder = await mkdtemp(join(scratchRoot, "job-"));
  try {
    const cookie = o.cookieFile
      ? (await readFile(o.cookieFile, "utf8")).trim()
      : null;
    if (o.cookieFile && (!cookie || /[\r\n]/.test(cookie)))
      throw Error("Cookie file must contain one header value");
    const summary = o.resume
      ? await readSummary(output)
      : {
          schema: 1,
          started: new Date().toISOString(),
          baseUrl: o.baseUrl,
          audience: cookie ? "member" : "guest",
          runs: o.runs,
          lighthouseVersion: "13.5.0",
          image: o.image,
          blockAnalytics: o.blockAnalytics,
          tiers: o.tiers,
          psi: !!o.psi,
          serverOnly: !!o.serverOnly,
          commit: execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: here,
            encoding: "utf8",
          }).trim(),
          dirty: !!execFileSync("git", ["status", "--porcelain"], {
            cwd: here,
            encoding: "utf8",
          }).trim(),
          nodeVersion: process.version,
          requestPolicy:
            "GET only; at most two in flight; one Lighthouse at a time",
          pages: [],
          skipped: [],
          options: { only: o.only ?? null },
        };
    if (
      o.resume &&
      (summary.baseUrl !== o.baseUrl ||
        summary.audience !== (cookie ? "member" : "guest") ||
        summary.runs !== o.runs ||
        summary.blockAnalytics !== o.blockAnalytics ||
        summary.psi !== !!o.psi ||
        summary.serverOnly !== !!o.serverOnly ||
        JSON.stringify(summary.tiers) !== JSON.stringify(o.tiers) ||
        summary.image !== o.image ||
        summary.options.only !== (o.only ?? null))
    )
      throw Error("Resume options differ from original run");
    const save = async () => {
      await writeFile(
        join(output, "summary.json"),
        JSON.stringify(summary, null, 2) + "\n",
        { mode: 0o600 },
      );
      await writeFile(join(output, "summary.md"), markdown(summary));
    };
    const selected = inventory.pages
      .filter((p) => o.tiers.includes(p.tier))
      .sort((a, b) => a.tier.localeCompare(b.tier));
    for (const p of selected) {
      if (!p.audience.includes(summary.audience) || !p.examples.length) {
        if (!summary.skipped.some((s) => s.route === p.route))
          summary.skipped.push({
            route: p.route,
            reason: p.unavailable ?? "Member page requires --cookie-file",
          });
        continue;
      }
      for (const path of p.examples) {
        if (o.only && o.only !== path) continue;
        if (summary.pages.some((p) => p.path === path && p.complete)) continue;
        let entry = summary.pages.find((p) => p.path === path);
        if (!entry) {
          entry = { id: p.id, path, tier: p.tier, route: p.route, errors: [] };
          summary.pages.push(entry);
        }
        const url = new URL(path, o.baseUrl).href;
        entry.errors = [];
        console.log(`${new Date().toISOString()} ${p.tier} ${path}`);
        try {
          if (!entry.server) {
            const s = await serverMeasurements(url, cookie);
            entry.server = {
              ...s,
              medianTtfb: median(s.samples.map((x) => x.ttfb)),
              maxTtfb: Math.max(...s.samples.map((x) => x.ttfb)),
              medianBytes: median(s.samples.map((x) => x.bytes)),
            };
            await save();
          }
          if (
            entry.server.samples.some(
              (s) =>
                s.status !== 200 ||
                !s.headers["content-type"]?.includes("text/html"),
            )
          ) {
            entry.errors.push(
              "Expected 200 HTML; Lighthouse skipped to avoid measuring a redirect or error page",
            );
            entry.complete = true;
            await save();
            continue;
          }
          const folder = join(
            output,
            p.id + "-" + Buffer.from(path).toString("base64url"),
          );
          await mkdir(folder, { recursive: true, mode: 0o700 });
          if (!o.serverOnly && !o.verify)
            for (const device of ["mobile", "desktop"]) {
              const reports = [];
              for (let n = 1; n <= o.runs; n++) {
                const raw = join(folder, `${device}-${n}.json.gz`);
                try {
                  reports.push(JSON.parse(gunzipSync(await readFile(raw))));
                  continue;
                } catch {}
                await writeFile(
                  join(jobFolder, "job.json"),
                  JSON.stringify({
                    url,
                    device,
                    blockAnalytics: o.blockAnalytics,
                    member: !!cookie,
                  }),
                );
                const docker = [
                  "run",
                  "--rm",
                  "--name",
                  `gw-pages-${process.pid}`,
                  "--shm-size=1g",
                  "--network",
                  "host",
                  "--env",
                  "TMPDIR=/out/tmp",
                  "--volume",
                  `${here}:/suite:ro`,
                  "--volume",
                  `${jobFolder}:/out`,
                ];
                if (cookie)
                  docker.push(
                    "--volume",
                    `${o.cookieFile}:/run/member-cookie:ro`,
                  );
                docker.push(
                  "--entrypoint",
                  "node",
                  o.image,
                  "/suite/lighthouse.mjs",
                );
                try {
                  await execute("docker", docker);
                  await copyFile(join(jobFolder, "report.json.gz"), raw);
                  await copyFile(
                    join(jobFolder, "guard.json"),
                    join(folder, `${device}-${n}-guard.json`),
                  );
                  reports.push(JSON.parse(gunzipSync(await readFile(raw))));
                  entry.guards ??= {};
                  entry.guards[`${device}-${n}`] = JSON.parse(
                    await readFile(join(jobFolder, "guard.json"), "utf8"),
                  );
                } catch {
                  entry.errors.push(`${device} run ${n}: Lighthouse failed`);
                  await execute("docker", [
                    "rm",
                    "-f",
                    `gw-pages-${process.pid}`,
                  ]).catch(() => {});
                }
                await delay(2000);
              }
              entry[device] = summarizeLighthouse(reports);
              await save();
            }
          if (o.psi && p.tier === "P1" && !o.verify && !entry.psi) {
            entry.psi = {};
            for (const device of ["mobile", "desktop"]) {
              await delay(15_000);
              const r = await psi(url, device);
              if (r.lighthouseResult) {
                await writeFile(
                  join(folder, `psi-${device}.json.gz`),
                  gzipSync(JSON.stringify(r)),
                );
                entry.psi[device] = {
                  status: r.status,
                  lab: summarizeLighthouse([r.lighthouseResult]),
                  urlField: r.loadingExperience,
                  originField: r.originLoadingExperience,
                };
              } else entry.psi[device] = r;
              await save();
            }
          }
          entry.complete =
            o.serverOnly ||
            o.verify ||
            ["mobile", "desktop"].every((d) => entry[d]?.runs === o.runs);
        } catch {
          entry.errors.push(
            "Measurement failed (network or filesystem error); rerun with --resume",
          );
        }
        await save();
      }
    }
    summary.finished = new Date().toISOString();
    await save();
    console.log(`Results: ${output}`);
  } finally {
    await rm(jobFolder, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
