// End-to-end replay of the combo-safe-v3 store access trace (results/bench/trace), as the ported webapp would run it:
// query texts encoded in a worker thread, each trace stage sent as one batched request per store (Qdrant
// /points/query/batch through @qdrant/js-client-rest, Crate /_sql through undici fetch, as d4.server.ts and
// catalog.server.ts do), the recorded in-memory compute burned as a busy loop on the main thread, production's RTT
// injected before every request. Appends one JSON line per run to out/runs.jsonl.
//
// node replay.ts --label=x [--collection=f16|f32|sq8] [--concurrency=4] [--passes=3] [--warmup=1]
//   [--mix=exact|pre|pre-global|pre-rescore] [--mixk=500] [--profiles=0|1] [--crate=union|parallel] [--rtt=1] [--bg=0|1]
//   [--record=0|1] [--display=1] [--fpexact=1|0] [--upsert-every=60] [--recommend-rate=0.3]
import { Worker } from "node:worker_threads";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { spawn } from "node:child_process";
import { QdrantClient } from "@qdrant/js-client-rest";
import { Agent, fetch } from "undici";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARENA = join(HERE, "..", "..");
const TRACE = join(ARENA, "results", "bench", "trace");
const OUT = join(HERE, "out");
mkdirSync(OUT, { recursive: true });

const arg = (name: string, dflt: string) => {
	const a = process.argv.find((x) => x.startsWith(`--${name}=`));
	return a ? a.slice(name.length + 3) : dflt;
};
const CFG = {
	label: arg("label", "run"),
	collection: arg("collection", "f16"),
	concurrency: Number(arg("concurrency", "1")),
	passes: Number(arg("passes", "3")),
	warmup: Number(arg("warmup", "1")),
	mix: arg("mix", "exact"),
	mixk: Number(arg("mixk", "500")),
	profiles: arg("profiles", "0") === "1",
	crate: arg("crate", "union"),
	rtt: arg("rtt", "1") === "1",
	bg: arg("bg", "0") === "1",
	record: arg("record", "0") === "1",
	display: arg("display", "1") === "1",
	upsertEverySec: Number(arg("upsert-every", "60")),
	recommendPerSec: Number(arg("recommend-rate", "0.3")),
	// fingerprint_raw top-k: exact scan by default (HNSW over raw Dot scores lost recall, see replay.json parity)
	fpExact: arg("fpexact", "1") === "1",
	// qdrant client for the stage batches: "js" = @qdrant/js-client-rest (JSON with a bigint reviver/replacer on
	// every value), "raw" = plain undici fetch + JSON.parse to the same REST endpoint
	qclient: arg("qclient", "js"),
};
const COLLECTION = `media_fingerprint_v1_${CFG.collection}`;
const PROFILES = "search_reference_profiles";
// production RTT p50 from the webapp container (results/bench/infra.json); setTimeout has 1 ms granularity, so the
// injected delay is rounded (the actual delay is measured and reported)
const RTT = { qdrant: 1.86, crate: 3.02 };
const QDRANT_URL = "http://127.0.0.1:16333";
const CRATE_URL = "http://127.0.0.1:14200/_sql";

// ---------------------------------------------------------------------------------------------------------------
type Op = Record<string, any> & { id: string; kind: string; deps: string[] };
type Q = Record<string, any> & { id: string; ops: Op[] };

const trace: Q[] = readFileSync(join(TRACE, "trace.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const rawVectors: Record<string, Record<string, string>> = JSON.parse(readFileSync(join(TRACE, "vectors.json"), "utf8"));
const vecOf = (qid: string, vid: string) => {
	const b = Buffer.from(rawVectors[qid][vid], "base64");
	return Array.from(new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4));
};
const prep = JSON.parse(readFileSync(join(OUT, "prepare.json"), "utf8"));
const mixStats: Record<string, any> = JSON.parse(readFileSync(join(OUT, "mixstats.json"), "utf8"));

const qdrant = new QdrantClient({ url: QDRANT_URL, checkCompatibility: false, timeout: 30000 });
const qapi = qdrant.api();

const now = () => performance.timeOrigin + performance.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const busy = (ms: number) => {
	const end = performance.now() + ms;
	while (performance.now() < end) {
		/* burn: the in-memory ranker work blocks the event loop */
	}
};
const rtt = async (store: "qdrant" | "crate") => {
	if (!CFG.rtt) return 0;
	const t = performance.now();
	await sleep(Math.round(RTT[store]));
	return performance.now() - t;
};

// --- filters ---------------------------------------------------------------------------------------------------
function qdrantFilter(f: any) {
	const must: any[] = [{ key: "goodwatch_overall_score_voting_count", range: { gte: f.min_votes } }];
	const must_not: any[] = [{ key: "adult", match: { value: true } }];
	if (f.media_type) must.push({ key: "media_type", match: { value: f.media_type } });
	const cond = (fid: string) => {
		if (fid.startsWith("media_type:")) return { key: "media_type", match: { value: fid.split(":")[1] } };
		if (fid.startsWith("production_method:")) return { key: "production_method", match: { value: fid.split(":")[1] } };
		return { key: fid, match: { value: true } };
	};
	for (const r of f.required) must.push(cond(r));
	for (const e of f.excluded) must_not.push(cond(e));
	if (f.year_range) must.push({ key: "release_year", range: { gte: f.year_range[0], lte: f.year_range[1] } });
	return { must, must_not };
}
const SAFE = /^[a-z_]+$/;
function crateFilter(f: any): [string, unknown[]] {
	const parts = ["votes >= ?", "adult = false"];
	const args: unknown[] = [f.min_votes];
	if (f.media_type) {
		parts.push("media_type = ?");
		args.push(f.media_type);
	}
	const cond = (fid: string, want: boolean) => {
		if (fid.startsWith("media_type:") || fid.startsWith("production_method:")) {
			const [col, val] = fid.split(":");
			args.push(val);
			return want ? `${col} = ?` : `(${col} IS NULL OR ${col} <> ?)`;
		}
		if (!SAFE.test(fid)) throw new Error(fid);
		return want ? `${fid} = true` : `(${fid} IS NULL OR ${fid} = false)`;
	};
	for (const r of f.required) parts.push(cond(r, true));
	for (const e of f.excluded) parts.push(cond(e, false));
	if (f.year_range) {
		parts.push("release_year BETWEEN ? AND ?");
		args.push(f.year_range[0], f.year_range[1]);
	}
	return [parts.join(" AND "), args];
}
const COLS: Record<string, string> = { tags: "tags", keywords: "keywords", tropes: "tropes", essence: "essence_text",
	title: "title", creators: "creators", cast: "cast_names" };
const matchCols = (fields: Record<string, number>) =>
	Object.entries(fields).map(([f, w]) => `${COLS[f]} ${w}`).join(", ");
// Crate MATCH takes a query string through the english analyzer (OR of terms, no per-term weights). Text queries pass
// their text; the reference term profile (stemmed terms with weights) passes its unigram terms.
const bm25Text = (op: Op) => op.text ?? [...new Set((op.terms as [string, number][]).map(([t]) => t).filter((t) => !t.includes("_")))].join(" ");

// --- plan: stages per query ----------------------------------------------------------------------------------------
interface Stage { stage: number; qdrant: Op[]; crate: Op[] }
interface Plan { q: Q; stages: Stage[]; display: Op | null; encodes: { model: string; texts: string[]; ids: string[][] }[];
	pre: number; post: number; poolIds: number[]; seeds: number[]; displayIds: number[]; profile: any }

const MODEL: Record<string, string> = { "bgeb-notitle": "bge", me5s: "me5s" };

function plan(q: Q): Plan {
	const profile = CFG.profiles ? prep.profiles?.index?.[q.id] : null;
	const dropped = new Set<string>();
	if (profile) for (const o of q.ops) if (o.kind === "fetch_vectors" || o.kind === "fetch_terms") dropped.add(o.id);
	const store = q.ops.filter((o) => o.store !== "external" && !o.display && !dropped.has(o.id));
	const byId = new Map(store.map((o) => [o.id, o]));
	const st = new Map<string, number>();
	const stageOf = (o: Op): number => {
		if (st.has(o.id)) return st.get(o.id)!;
		const deps = o.deps.map((d) => byId.get(d)).filter(Boolean) as Op[];
		const s = 1 + Math.max(0, ...deps.map(stageOf));
		st.set(o.id, s);
		return s;
	};
	const stages: Stage[] = [];
	for (const o of store) {
		const s = stageOf(o);
		while (stages.length < s) stages.push({ stage: stages.length + 1, qdrant: [], crate: [] });
		(o.store === "crate" ? stages[s - 1].crate : stages[s - 1].qdrant).push(o);
	}
	const groups = new Map<string, { model: string; texts: string[]; ids: string[][] }>();
	for (const e of q.encodes) {
		const m = MODEL[e.model];
		if (!groups.has(m)) groups.set(m, { model: m, texts: [], ids: [] });
		const g = groups.get(m)!;
		const i = g.texts.indexOf(e.text);
		if (i >= 0) g.ids[i].push(e.id);
		else {
			g.texts.push(e.text);
			g.ids.push([e.id]);
		}
	}
	const mem = q.timing_ms.memory as number;
	const parts = q.timing_ms.memory_parts_inclusive ?? {};
	const pre = Math.min(mem, (parts.spell ?? 0) + (parts.resolve_reference ?? 0) + (parts.fuzzy_title ?? 0));
	return { q, stages, display: q.ops.find((o) => o.display) ?? null, encodes: [...groups.values()], pre, post: mem - pre,
		poolIds: q.id_lists.pool ?? [], seeds: q.id_lists.seeds ?? [], displayIds: q.id_lists.display ?? [], profile };
}

// --- encoder worker ----------------------------------------------------------------------------------------------
const worker = new Worker(join(HERE, "encoder-worker.mjs"), { workerData: { threads: 4 } });
const pending = new Map<number, (m: any) => void>();
let encId = 0;
await new Promise<void>((res, rej) => {
	worker.once("error", rej);
	worker.on("message", (m) => {
		if (m.ready) return res();
		pending.get(m.id)?.(m);
		pending.delete(m.id);
	});
});
const encode = (groups: { model: string; texts: string[] }[]) =>
	new Promise<any>((res) => {
		const id = ++encId;
		pending.set(id, res);
		worker.postMessage({ id, groups: groups.map((g) => ({ model: g.model, texts: g.texts })) });
	});

// --- Qdrant requests --------------------------------------------------------------------------------------------
const quant = CFG.collection === "sq8" ? { quantization: { rescore: true } } : undefined;

function qdrantSearches(p: Plan, ops: Op[], vec: (vid: string) => number[] | number) {
	const searches: any[] = [];
	const decode: { op: Op; n: number; part?: number }[] = [];
	const F = qdrantFilter(p.q.filter);
	const query = (op: Op, vid: string, using: string) => {
		const v = vec(vid);
		if (typeof v === "number") return { query: v, using, lookup_from: { collection: PROFILES, vector: using } };
		return { query: v, using };
	};
	for (const op of ops) {
		if (op.kind === "dense_topk" || op.kind === "fp_topk") {
			const exact = CFG.fpExact && op.vector_set === "fingerprint_raw";
			searches.push({ ...query(op, op.vector, op.vector_set), filter: F, limit: op.k, with_payload: false,
				params: exact ? { exact: true } : quant });
			decode.push({ op, n: 1 });
		} else if (op.kind === "dense_score_ids" || op.kind === "fp_score_ids") {
			const ids = p.poolIds;
			searches.push({ ...query(op, op.vector, op.vector_set), filter: { must: [{ has_id: ids }] }, limit: ids.length,
				with_payload: false, params: quant });
			decode.push({ op, n: 1 });
		} else if (op.kind === "fetch_vectors") {
			searches.push({ filter: { must: [{ has_id: p.seeds }] }, limit: p.seeds.length, with_payload: false,
				with_vector: [op.vector_set] });
			decode.push({ op, n: 1 });
		} else if (op.kind === "dense_mix_topk") {
			const exact = CFG.mix === "exact";
			for (const part of op.parts) {
				searches.push({ query: vec(part.vector), using: part.vector_set, filter: F,
					limit: exact ? op.n_filter_rows : CFG.mixk, with_payload: false,
					params: exact ? { ...(quant ?? {}), exact: true } : quant });
			}
			decode.push({ op, n: 2 });
		} else throw new Error(`qdrant op ${op.kind}`);
	}
	return { searches, decode };
}

function mixTopk(p: Plan, op: Op, lists: { id: number; score: number }[][]) {
	const [multi, en] = lists;
	const w = op.mix_w as number;
	let m1: number, s1: number, m2: number, s2: number;
	if (CFG.mix === "exact") {
		const ms = (l: { score: number }[]) => {
			let s = 0, ss = 0;
			for (const x of l) { s += x.score; ss += x.score * x.score; }
			const mu = s / l.length;
			return [mu, Math.sqrt(Math.max(0, ss / l.length - mu * mu)) || 1];
		};
		[m1, s1] = ms(multi);
		[m2, s2] = ms(en);
	} else {
		const st = mixStats[`${p.q.id}/${op.id}`];
		[m1, s1] = CFG.mix === "pre-global" ? st.eligible_multi : st.multi;
		[m2, s2] = CFG.mix === "pre-global" ? st.eligible_en : st.en;
	}
	const a = new Map(multi.map((x) => [x.id, x.score]));
	const b = new Map(en.map((x) => [x.id, x.score]));
	// precomputed: a title missing from one list gets that list's lowest returned score (an upper bound)
	const floorA = multi.length ? multi[multi.length - 1].score : 0;
	const floorB = en.length ? en[en.length - 1].score : 0;
	const ids = new Set([...a.keys(), ...b.keys()]);
	const scored: [number, number][] = [];
	for (const id of ids) {
		const x = a.get(id) ?? floorA, y = b.get(id) ?? floorB;
		scored.push([id, (1 - w) * (x - m1) / s1 + w * (y - m2) / s2]);
	}
	scored.sort((u, v) => v[1] - u[1]);
	return scored.slice(0, op.k).map((x) => x[0]);
}

async function qdrantStage(p: Plan, ops: Op[], vec: (vid: string) => number[] | number, lists: Record<string, number[]>) {
	const { searches, decode } = qdrantSearches(p, ops, vec);
	const injected = await rtt("qdrant");
	const t = now();
	const resp = CFG.qclient === "raw"
		? { data: await rawQdrant(`/collections/${COLLECTION}/points/query/batch`, { searches }) }
		: await qapi.queryBatchPoints({ collection_name: COLLECTION, searches } as any);
	const results = (resp.data as any).result as { points: { id: number; score: number }[] }[];
	let server = ((resp.data as any).time ?? 0) * 1000;
	let i = 0;
	let points = 0;
	for (const d of decode) {
		let rs = results.slice(i, i + d.n);
		i += d.n;
		for (const r of rs) points += r.points.length;
		if (d.op.kind === "dense_mix_topk" && CFG.mix === "pre-rescore") {
			// gap 2(b) with a rescore round trip: score the union of both top-k lists with both vectors, so every
			// candidate has its true pair of cosines (no imputation); the z-mix then uses the precomputed stats
			const union = [...new Set(rs.flatMap((r) => r.points.map((x) => x.id)))];
			const follow = d.op.parts.map((part: any) => ({ query: vec(part.vector), using: part.vector_set,
				filter: { must: [{ has_id: union }] }, limit: union.length, with_payload: false, params: quant }));
			const r2 = CFG.qclient === "raw"
				? { data: await rawQdrant(`/collections/${COLLECTION}/points/query/batch`, { searches: follow }) }
				: await qapi.queryBatchPoints({ collection_name: COLLECTION, searches: follow } as any);
			rs = (r2.data as any).result;
			server += ((r2.data as any).time ?? 0) * 1000;
			for (const r of rs) points += r.points.length;
		}
		if (d.op.kind === "dense_mix_topk") lists[d.op.id] = [mixTopk(p, d.op, rs.map((r) => r.points)), []] as any;
		else if (CFG.record && (d.op.kind === "dense_topk" || d.op.kind === "fp_topk")) lists[d.op.id] = [rs[0].points.map((x) => x.id), rs[0].points.map((x) => x.score)] as any;
	}
	const wall = now() - t;
	return { server, wall, rtt: injected, searches: searches.length, points,
		total: now() - t + injected };
}

const rawAgent = new Agent({ connections: 25, keepAliveTimeout: 10_000 });
async function rawQdrant(path: string, body: unknown) {
	const r = await fetch(QDRANT_URL + path, { method: "POST", headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body), dispatcher: rawAgent, signal: AbortSignal.timeout(30000) });
	if (!r.ok) throw new Error(`qdrant ${r.status}: ${await r.text()}`);
	return (await r.json()) as any;
}

// --- Crate requests ---------------------------------------------------------------------------------------------
async function crateSql(stmt: string, args: unknown[]) {
	const injected = await rtt("crate");
	const t = now();
	const response = await fetch(CRATE_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from("crate:").toString("base64")}` },
		body: JSON.stringify({ stmt, args }),
		signal: AbortSignal.timeout(30000),
	});
	if (!response.ok) throw new Error(`crate ${response.status}: ${await response.text()}`);
	const data = (await response.json()) as { cols: string[]; rows: unknown[][]; duration: number };
	return { data, server: data.duration, wall: now() - t, rtt: injected };
}

function crateSelect(p: Plan, op: Op): [string, unknown[]] {
	if (op.kind === "fetch_terms") {
		return ["SELECT id, tags, keywords, tropes, essence_text FROM doc.search_title WHERE id = ANY(?)", [p.seeds]];
	}
	const cols = matchCols(op.fields);
	if (op.kind === "bm25_topk") {
		const [fw, fa] = crateFilter(p.q.filter);
		return [`SELECT id, _score AS s FROM doc.search_title WHERE MATCH((${cols}), ?) USING most_fields AND ${fw} ORDER BY _score DESC LIMIT ${op.k}`,
			[bm25Text(op), ...fa]];
	}
	if (op.kind === "bm25_score_ids") {
		return [`SELECT id, _score AS s FROM doc.search_title WHERE MATCH((${cols}), ?) USING most_fields AND id = ANY(?) ORDER BY _score DESC LIMIT ${p.poolIds.length}`,
			[bm25Text(op), p.poolIds]];
	}
	throw new Error(`crate op ${op.kind}`);
}

async function crateStage(p: Plan, ops: Op[], lists: Record<string, number[]>) {
	const t = now();
	const reqs: Promise<any>[] = [];
	const scoreOps = ops.filter((o) => o.kind !== "fetch_terms");
	const other = ops.filter((o) => o.kind === "fetch_terms");
	const record = (op: Op, ids: number[]) => {
		if (CFG.record && op.kind === "bm25_topk") lists[op.id] = [ids, []] as any;
	};
	if (CFG.crate === "union" && scoreOps.length > 1) {
		const parts: string[] = [];
		const args: unknown[] = [];
		scoreOps.forEach((op, i) => {
			const [s, a] = crateSelect(p, op);
			parts.push(`SELECT ${i} AS op, id, s FROM (${s}) t${i}`);
			args.push(...a);
		});
		reqs.push(crateSql(parts.join(" UNION ALL "), args).then((r) => {
			const by: number[][] = scoreOps.map(() => []);
			for (const row of r.data.rows) by[row[0] as number].push(row[1] as number);
			scoreOps.forEach((op, i) => record(op, by[i]));
			return r;
		}));
	} else {
		for (const op of scoreOps) {
			const [s, a] = crateSelect(p, op);
			reqs.push(crateSql(s, a).then((r) => { record(op, r.data.rows.map((x: unknown[]) => x[0] as number)); return r; }));
		}
	}
	for (const op of other) {
		const [s, a] = crateSelect(p, op);
		reqs.push(crateSql(s, a));
	}
	const rs = await Promise.all(reqs);
	return { server: Math.max(...rs.map((r) => r.server)), rtt: Math.max(...rs.map((r) => r.rtt)), requests: rs.length,
		wall: now() - t };
}

// --- one search ---------------------------------------------------------------------------------------------------
async function runQuery(p: Plan) {
	const t0 = now();
	const rec: any = { id: p.q.id, path: p.q.path, stages: [] };
	const lists: Record<string, number[]> = {};
	busy(p.pre);
	rec.pre = now() - t0;
	const vectors: Record<string, number[]> = {};
	const vec = (vid: string): number[] | number => {
		if (vectors[vid]) return vectors[vid];
		const meta = p.q.vectors[vid];
		if (meta?.kind === "centroid" && p.profile) return p.profile.point as number;
		return (vectors[vid] = vecOf(p.q.id, vid));
	};
	for (const [si, s] of p.stages.entries()) {
		const ts = now();
		const srec: any = { stage: s.stage, n_qdrant: s.qdrant.length, n_crate: s.crate.length };
		const cratePromise = s.crate.length ? crateStage(p, s.crate, lists) : null;
		if (si === 0 && p.encodes.length) {
			const te = now();
			const m = await encode(p.encodes);
			for (const g of p.encodes) g.ids.forEach((ids, i) => ids.forEach((id) => (vectors[id] = Array.from(m.vectors[g.model][i] as Float32Array))));
			rec.encode = { wall: now() - te, queue: m.started - m.received, compute: m.done - m.started, per_model: m.perModel,
				texts: p.encodes.reduce((a, g) => a + g.texts.length, 0) };
		}
		if (s.qdrant.length) srec.qdrant = await qdrantStage(p, s.qdrant, vec, lists);
		if (cratePromise) srec.crate = await cratePromise;
		srec.wall = now() - ts;
		rec.stages.push(srec);
	}
	const tp = now();
	busy(p.post);
	rec.post = now() - tp;
	if (CFG.display && p.display) {
		const injected = await rtt("qdrant");
		const td = now();
		const r = await qapi.getPoints({ collection_name: COLLECTION, ids: p.displayIds,
			with_payload: ["title", "original_title", "release_year", "media_type", "poster_path", "genres"], with_vector: false } as any);
		rec.display = { wall: now() - td, server: ((r.data as any).time ?? 0) * 1000, rtt: injected };
	}
	rec.total = now() - t0;
	rec.busy_target = p.pre + p.post;
	return { rec, lists };
}

// --- background load ------------------------------------------------------------------------------------------------
const RELATED_PAYLOAD = ["tmdb_id", "media_type", "title", "original_title", "poster_path", "genres", "release_year",
	"goodwatch_overall_score_normalized_percent", "goodwatch_overall_score_voting_count", "imdb_user_score_rating_count",
	"tmdb_user_score_rating_count", "popularity", "fingerprint_scores_v1"];
const bgStats: any = { recommend: [] as number[], recommend_errors: 0, upserts: [] as any[] };
let bgStop = false;
async function recommendLoop(seedPool: number[]) {
	let s = 7;
	const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
	while (!bgStop) {
		await sleep(-Math.log(1 - rnd()) * 1000 / CFG.recommendPerSec);   // Poisson arrivals
		if (bgStop) break;
		const id = seedPool[Math.floor(rnd() * seedPool.length)];
		const t = now();
		try {
			// as app/utils/qdrant.ts recommend(): read the example's vector, then recommend with it, excluding the example
			const seed = await qapi.getPoints({ collection_name: COLLECTION, ids: [id], with_payload: false, with_vector: ["fingerprint_v1"] } as any);
			const v = (seed.data as any).result[0]?.vector?.fingerprint_v1;
			if (!v) continue;
			const mt = id >= 2e12 ? "show" : "movie";
			await qapi.queryPoints({ collection_name: COLLECTION, query: { recommend: { positive: [v], strategy: "average_vector" } },
				using: "fingerprint_v1", limit: 100, with_payload: RELATED_PAYLOAD, params: { hnsw_ef: 64, exact: false },
				filter: { must: [{ key: "media_type", match: { value: mt } },
					{ key: "goodwatch_overall_score_voting_count", range: { gte: 10000 } },
					{ key: "goodwatch_overall_score_normalized_percent", range: { gte: 60 } }],
				must_not: [{ key: "adult", match: { value: true } }, { has_id: [id] }] } } as any);
			bgStats.recommend.push(now() - t);
		} catch {
			bgStats.recommend_errors++;
		}
	}
}
function startUpserts() {
	const child = spawn(process.execPath, [join(HERE, "bg-upsert.ts"), COLLECTION, String(CFG.upsertEverySec)], { stdio: ["ignore", "pipe", "inherit"] });
	child.stdout.on("data", (d) => {
		for (const line of String(d).trim().split("\n")) {
			try { bgStats.upserts.push(JSON.parse(line)); } catch { /* ignore */ }
		}
	});
	return child;
}

// --- driver ---------------------------------------------------------------------------------------------------------
const plans = trace.map(plan);
function order(pass: number) {
	const idx = plans.map((_, i) => i);
	let s = 1000 + pass;
	for (let i = idx.length - 1; i > 0; i--) {
		s = (s * 1103515245 + 12345) % 2 ** 31;
		const j = s % (i + 1);
		[idx[i], idx[j]] = [idx[j], idx[i]];
	}
	return idx;
}
async function runPasses(passes: number[], collect: boolean) {
	const items = passes.flatMap((pass) => order(pass).map((i) => ({ pass, i })));
	const recs: any[] = [];
	const lists: Record<string, Record<string, number[]>> = {};
	let next = 0;
	const t0 = now();
	await Promise.all(Array.from({ length: CFG.concurrency }, async () => {
		while (next < items.length) {
			const it = items[next++];
			const { rec, lists: l } = await runQuery(plans[it.i]);
			rec.pass = it.pass;
			rec.started = rec.started ?? 0;
			if (collect) {
				recs.push(rec);
				if (CFG.record && it.pass === passes[0]) lists[plans[it.i].q.id] = l;
			}
		}
	}));
	return { recs, lists, seconds: (now() - t0) / 1000 };
}

let child: ReturnType<typeof startUpserts> | null = null;
const seedPool = [...new Set(trace.flatMap((q) => q.id_lists.display ?? []))];
if (CFG.bg) {
	void recommendLoop(seedPool);
	child = startUpserts();
}
const warm = await runPasses(Array.from({ length: CFG.warmup }, (_, i) => -1 - i), false);
const h = monitorEventLoopDelay({ resolution: 5 });
h.enable();
const run = await runPasses(Array.from({ length: CFG.passes }, (_, i) => i), true);
h.disable();
bgStop = true;
child?.kill();
const line = {
	label: CFG.label, config: { ...CFG, collection: COLLECTION }, at: new Date().toISOString(), warmup_seconds: warm.seconds,
	seconds: run.seconds, searches: run.recs.length, throughput: run.recs.length / run.seconds,
	event_loop_delay_ms: { p50: h.percentile(50) / 1e6, p99: h.percentile(99) / 1e6, max: h.max / 1e6 },
	background: CFG.bg ? { recommend_n: bgStats.recommend.length, recommend_ms: bgStats.recommend, recommend_errors: bgStats.recommend_errors, upserts: bgStats.upserts } : null,
	records: run.recs,
};
appendFileSync(join(OUT, "runs.jsonl"), JSON.stringify(line) + "\n");
if (CFG.record) writeFileSync(join(OUT, `lists-${CFG.label}.json`), JSON.stringify(run.lists));
const tot = run.recs.map((r) => r.total).sort((a, b) => a - b);
const pc = (p: number) => tot[Math.min(tot.length - 1, Math.round(p * (tot.length - 1)))].toFixed(1);
console.log(`${CFG.label}: ${run.recs.length} searches in ${run.seconds.toFixed(1)}s (${line.throughput.toFixed(1)}/s) p50 ${pc(0.5)} p95 ${pc(0.95)} p99 ${pc(0.99)} ms; loop delay p99 ${line.event_loop_delay_ms.p99.toFixed(1)} ms`);
await worker.terminate();
process.exit(0);
