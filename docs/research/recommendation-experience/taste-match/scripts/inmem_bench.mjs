// In-process scoring of 100 titles against a taste vector. Run with: node --expose-gc inmem_bench.mjs
import { readFileSync } from "node:fs"

const D = 74
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.round(p / 100 * (s.length - 1)))].toFixed(4) }
const mem = () => { global.gc(); const m = process.memoryUsage(); return m.heapUsed + m.external }

const idsBuf = readFileSync("ids.f64"), rawBuf = readFileSync("raw.u8"), candBuf = readFileSync("cand.f64")
const base = mem()
let t0 = performance.now()
const ids = new Float64Array(idsBuf.buffer.slice(idsBuf.byteOffset, idsBuf.byteOffset + idsBuf.byteLength))
const N = ids.length
const raw = new Uint8Array(rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength))
const index = new Map()
for (let i = 0; i < N; i++) index.set(ids[i], i)
const invNorm = new Float32Array(N)
for (let i = 0; i < N; i++) { let s = 0; for (let d = 0; d < D; d++) s += raw[i * D + d] ** 2; invNorm[i] = s ? 1 / Math.sqrt(s) : 0 }
const buildU8 = performance.now() - t0
const memU8 = mem() - base

t0 = performance.now()
const f32 = new Float32Array(N * D)
for (let i = 0; i < N; i++) for (let d = 0; d < D; d++) f32[i * D + d] = raw[i * D + d] * invNorm[i]
const buildF32 = performance.now() - t0
const memF32 = mem() - base - memU8

const cand = new Float64Array(candBuf.buffer.slice(candBuf.byteOffset, candBuf.byteOffset + candBuf.byteLength))
const taste = new Float32Array(D)
for (let d = 0; d < D; d++) taste[d] = Math.random()
let tn = 0; for (let d = 0; d < D; d++) tn += taste[d] ** 2; tn = Math.sqrt(tn); for (let d = 0; d < D; d++) taste[d] /= tn

function scoreU8(pids) {
	const out = new Float32Array(pids.length)
	for (let j = 0; j < pids.length; j++) {
		const i = index.get(pids[j]); if (i === undefined) { out[j] = NaN; continue }
		let s = 0; const o = i * D
		for (let d = 0; d < D; d++) s += raw[o + d] * taste[d]
		out[j] = s * invNorm[i]
	}
	return out
}
function scoreF32(pids) {
	const out = new Float32Array(pids.length)
	for (let j = 0; j < pids.length; j++) {
		const i = index.get(pids[j]); if (i === undefined) { out[j] = NaN; continue }
		let s = 0; const o = i * D
		for (let d = 0; d < D; d++) s += f32[o + d] * taste[d]
		out[j] = s
	}
	return out
}
const RUNS = 5000
const sets = Array.from({ length: RUNS }, () => Array.from({ length: 100 }, () => cand[(Math.random() * cand.length) | 0]))
const res = {}
for (const [name, fn] of [["uint8_raw", scoreU8], ["float32_normalized", scoreF32]]) {
	for (let k = 0; k < 200; k++) fn(sets[k]) // warm-up
	const ts = []
	let sink = 0
	for (const s of sets) { const t = performance.now(); sink += fn(s)[0] || 0; ts.push((performance.now() - t) * 1000) }
	res[name] = { p50_us: pct(ts, 50), p95_us: pct(ts, 95), p99_us: pct(ts, 99), sink: +sink.toFixed(2) }
}
// Whole-catalog brute force for a ranked row (all N titles), for comparison.
const full = []
const all = Array.from(ids)
for (let k = 0; k < 20; k++) { const t = performance.now(); scoreU8(all); full.push(performance.now() - t) }
console.log(JSON.stringify({
	node: process.version, titles: N,
	build_ms: { uint8_and_index: +buildU8.toFixed(1), float32_extra: +buildF32.toFixed(1) },
	memory_mb: { uint8_raw_plus_norms_plus_map: +(memU8 / 2 ** 20).toFixed(1), float32_extra: +(memF32 / 2 ** 20).toFixed(1) },
	score_100: res,
	score_all_titles_ms: { p50: pct(full, 50), p95: pct(full, 95) },
}, null, 1))
