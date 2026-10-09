import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { summarize } from "./summarize.mjs";

test("page-view host summaries use captured bytes, host metrics, and labels without share paths", async () => {
  const dir = await mkdtemp(join(tmpdir(), "benchmark-summary-"));
  try {
    const raw = { state: { testRunDurationMs: 10000 }, metrics: {}, plan: { config: { scenario: "page-view" }, steps: [{ name: "s01", rate: 1, start_s: 0, end_s: 10 }] } };
    for (const selector of ["phase:main", "phase:main,step:s01"]) {
      for (const [host, count] of [["site", 20], ["static", 30]]) {
        raw.metrics[`http_reqs{${selector},host:${host}}`] = { values: { count } };
        raw.metrics[`tls_handshakes{${selector},host:${host}}`] = { values: { count: 10 } };
        raw.metrics[`http_req_duration{${selector},host:${host}}`] = { values: { med: 5, "p(95)": 10 } };
      }
    }
    await writeFile(`${dir}/k6-summary.json`, JSON.stringify(raw));
    const old = await summarize(dir);
    assert.equal(old.load.page_view.hosts, undefined);
    assert.doesNotMatch(await readFile(`${dir}/summary.md`, "utf8"), /By host/);
    await writeFile(`${dir}/urls.json`, JSON.stringify({
      static_url: "https://static.example.com", files: "page", page_names: "static",
      entries: [{ path: "/u/private/lists/secret" }],
      per_visit: { site: { requests: 2, transfer_bytes: 100, connections: 1 }, static: { requests: 3, transfer_bytes: 300, connections: 1 }, other: { requests: 1, transfer_bytes: 500, connections: 0 } },
    }));
    const result = await summarize(dir);
    const view = result.load.page_view;
    assert.equal(view.hosts.site.rps, 2);
    assert.equal(view.hosts.static.requests, 30);
    assert.equal(view.hosts.static.latency_ms.p95, 10);
    assert.equal(view.hosts.static.per_visit.transfer_bytes, 300);
    assert.equal(view.hosts.other.requests, undefined);
    assert.equal(view.origin_share.requests, 0.4);
    assert.equal(view.origin_share.transfer_bytes, 0.25);
    assert.equal(result.load.steps[0].hosts.static.rps, 3);
    const md = await readFile(`${dir}/summary.md`, "utf8");
    for (const label of ["Site", "Static hostname", "Others"]) assert(md.includes(`| ${label} |`));
    assert.match(md, /captured browser load/);
    assert.equal(md.split("static.example.com").length - 1, 1);
    assert.doesNotMatch(md, /private|secret/);
    const urlSet = JSON.parse(await readFile(`${dir}/urls.json`, "utf8"));
    urlSet.files = "origin";
    urlSet.per_visit.site = { requests: 5, transfer_bytes: 400, connections: 2 };
    urlSet.per_visit.static = { requests: 0, transfer_bytes: 0, connections: 0 };
    await writeFile(`${dir}/urls.json`, JSON.stringify(urlSet));
    const rewritten = await summarize(dir);
    assert.equal(rewritten.load.page_view.files, "origin");
    assert.equal(rewritten.load.page_view.page_names, "static");
    assert.equal(rewritten.load.page_view.origin_share.requests, 1);
    assert.equal(rewritten.load.page_view.origin_share.transfer_bytes, 1);
    assert.equal(rewritten.load.page_view.hosts.site.per_visit.connections, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
