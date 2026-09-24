// Latency of the trace's BM25 operations: Qdrant sparse `terms_bm25f` queries vs the replay's Crate MATCH statements,
// with plain undici fetch (as replay.ts --qclient=raw and catalog.server.ts) and the replay's RTT injection
// (setTimeout before every request: Qdrant 1.86 ms, Crate 3.02 ms, rounded to 2 / 3 ms by the timer).
//
// node bench/sparse/latency.mjs [--passes=3] [--warmup=1] [--concurrency=1,4] [--only=q-top300,...]
// Input: bench/sparse/out/latency_ops.json (latency_prep.py). Output: section "latency" of results/bench/sparse.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { Agent, fetch } from "../replay/node_modules/undici/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULT = join(HERE, "..", "..", "results", "bench", "sparse.json");
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=")[1];
const PASSES = Number(arg("passes", "3"));
const WARMUP = Number(arg("warmup", "1"));
const CONC = arg("concurrency", "1,4").split(",").map(Number);
const ONLY = arg("only", "");
// undici: fetch from undici 6.21.3 (the replay's raw client; @qdrant/js-client-rest uses undici too).
// http: node:http with a keep-alive agent. undici shows a ~40 ms stall on Qdrant REST responses of about 1-5.5 KB
// (delayed-ACK signature; curl, Python http.client and node:http do not), so both are measured.
const CLIENT = arg("client", "undici");
const RTT = { qdrant: 1.86, crate: 3.02 };
const QDRANT = "http://127.0.0.1:16333/collections/media_fingerprint_v1_f16/points";
const CRATE = "http://127.0.0.1:14200/_sql";
const agent = new Agent({ connections: 25, keepAliveTimeout: 10_000 });
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 25 });
const httpPost = (url, body, headers) => new Promise((resolve, reject) => {
	const u = new URL(url);
	const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: "POST", agent: httpAgent,
		headers: { ...headers, "Content-Length": Buffer.byteLength(body) } }, (res) => {
		const chunks = [];
		res.on("data", (c) => chunks.push(c));
		res.on("end", () => res.statusCode === 200 ? resolve(Buffer.concat(chunks).toString()) :
			reject(new Error(`${res.statusCode}: ${Buffer.concat(chunks)}`)));
	});
	req.on("error", reject);
	req.end(body);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ops = JSON.parse(readFileSync(join(HERE, "out", "latency_ops.json"), "utf8"));
const topkOps = ops.filter((o) => o.kind === "bm25_topk");
const idsOps = ops.filter((o) => o.kind === "bm25_score_ids");

const sparseQ = (o, extra) => ({ query: o.sparse, using: "terms_bm25f", with_payload: false, ...extra });
async function post(url, body, store) {
	const t0 = performance.now();
	await sleep(Math.round(RTT[store]));
	const rtt = performance.now() - t0;
	const t1 = performance.now();
	const headers = { "Content-Type": "application/json",
		...(store === "crate" ? { Authorization: `Basic ${Buffer.from("crate:").toString("base64")}` } : {}) };
	let data;
	if (CLIENT === "http") {
		data = JSON.parse(await httpPost(url, JSON.stringify(body), headers));
	} else {
		const r = await fetch(url, { method: "POST", dispatcher: agent, body: JSON.stringify(body), headers });
		if (!r.ok) throw new Error(`${store} ${r.status}: ${await r.text()}`);
		data = await r.json();
	}
	const wall = performance.now() - t1;
	const server = store === "qdrant" ? (data.time ?? 0) * 1000 : data.duration;
	const n = store === "qdrant" ? (data.result.points ?? data.result.flatMap((x) => x.points)).length : data.rows.length;
	return { total: rtt + wall, wall, rtt, server, n };
}

// scenario -> list of request thunks
const byQuery = {};
for (const o of topkOps) if (o.stage === 1) (byQuery[o.query] ??= []).push(o);
const SCEN = {
	"q-top300": topkOps.map((o) => () => post(`${QDRANT}/query`, sparseQ(o, { filter: o.filter, limit: 300 }), "qdrant")),
	"q-top500": topkOps.map((o) => () => post(`${QDRANT}/query`, sparseQ(o, { filter: o.filter, limit: 500 }), "qdrant")),
	"q-ids": idsOps.map((o) => () => post(`${QDRANT}/query`,
		sparseQ(o, { filter: { must: [{ has_id: o.ids }] }, limit: o.ids.length }), "qdrant")),
	// every stage-1 BM25 top-k of one query (main query, coverage units, mentions) in one /query/batch request
	"q-batch-stage1": Object.values(byQuery).map((os) => () => post(`${QDRANT}/query/batch`,
		{ searches: os.map((o) => sparseQ(o, { filter: o.filter, limit: 300 })) }, "qdrant")),
	"c-top300": topkOps.map((o) => () => post(CRATE, { stmt: o.crate_stmt.replace("{k}", "300"), args: o.crate_args }, "crate")),
	"c-top500": topkOps.map((o) => () => post(CRATE, { stmt: o.crate_stmt.replace("{k}", "500"), args: o.crate_args }, "crate")),
	"c-ids": idsOps.map((o) => () => post(CRATE, { stmt: o.crate_stmt, args: o.crate_args }, "crate")),
};

const pct = (xs, p) => {
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const r2 = (x) => Math.round(x * 100) / 100;
const stats = (xs) => ({ p50: r2(pct(xs, 50)), p95: r2(pct(xs, 95)), p99: r2(pct(xs, 99)),
	mean: r2(xs.reduce((a, b) => a + b, 0) / xs.length) });

async function run(thunks, conc) {
	const recs = [];
	let next = 0;
	const t0 = performance.now();
	await Promise.all(Array.from({ length: conc }, async () => {
		while (next < thunks.length) {
			const i = next++;
			recs.push(await thunks[i]());
		}
	}));
	return { recs, seconds: (performance.now() - t0) / 1000 };
}

const out = existsSync(RESULT) ? JSON.parse(readFileSync(RESULT, "utf8")) : {};
const lat = out.latency?.runs ?? {};
for (const [name, thunks] of Object.entries(SCEN)) {
	if (ONLY && !ONLY.split(",").includes(name)) continue;
	for (const c of CONC) {
		for (let w = 0; w < WARMUP; w++) await run(thunks, c);
		const all = [];
		let secs = 0;
		for (let p = 0; p < PASSES; p++) {
			const { recs, seconds } = await run(thunks, c);
			all.push(...recs);
			secs += seconds;
		}
		const res = { requests: all.length, concurrency: c, throughput_per_s: r2(all.length / secs),
			total_ms: stats(all.map((r) => r.total)), server_ms: stats(all.map((r) => r.server)),
			wall_minus_rtt_ms: stats(all.map((r) => r.wall)), rtt_ms_mean: r2(all.reduce((a, r) => a + r.rtt, 0) / all.length),
			rows_mean: r2(all.reduce((a, r) => a + r.n, 0) / all.length) };
		res.client = CLIENT;
		res.stalls_over_30ms = all.filter((r) => r.wall > 30).length;
		lat[`${name}-c${c}-${CLIENT}`] = res;
		console.log(name, `c${c}`, CLIENT, JSON.stringify(res));
	}
}
out.latency = { ...(out.latency ?? {}), runs: lat, method: "bench/sparse/latency.mjs: one request per trace BM25 op " +
	"(303 top-k, 103 score-ids; the 3 ops whose query has no indexed term are skipped), undici fetch, RTT injected " +
	"before each request, warmup pass then 3 passes; c4 = 4 workers pulling from the same op list" };
writeFileSync(RESULT, JSON.stringify(out, null, 1));
