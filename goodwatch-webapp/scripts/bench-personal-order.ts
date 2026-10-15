// Synthetic only: imports the reader/order module, never a backend connector.
import { performance } from "node:perf_hooks"
import { gzipSync } from "node:zlib"
import {
	createPersonalOrderReader,
	createPersonalOrderCache,
	PERSONAL_ORDER_MODEL_HASH,
} from "../app/server/personal-order/reader.server.ts"
import type { TitleSnapshot } from "../app/server/title-snapshot/snapshot.server.ts"

const count = 60_000
const keys = Array.from(
	{ length: count },
	(_, i) => (i < count / 2 ? 1e12 : 2e12) + i + 1,
)
const rows = new Map(keys.map((k, i) => [k, i]))
const snapshot = {
	version: "synthetic",
	count,
	rowOf: (k: number) => rows.get(k) ?? -1,
} as TitleSnapshot
const raw = JSON.stringify({
	format: 1,
	modelHash: PERSONAL_ORDER_MODEL_HASH,
	snapshotVersion: snapshot.version,
	builtAt: new Date().toISOString(),
	pointIds: keys,
	ownTasteRank: keys.map((_, i) => Math.fround(((i * 7919) % count) / count)),
	pooledRatingTopHalf: keys.map((_, i) => i % 2 === 0),
	movieSeriesId: keys.map((_, i) => (i < count / 2 ? Math.floor(i / 3) : -1)),
	show: keys.map((k) => k >= 2e12),
	animation: keys.map((_, i) => i % 5 === 0),
	ownShares: [0.4, 0.2],
	othersCount: 10,
	othersRatingsCount: 100,
})
const compressed = gzipSync(raw)
let gets = 0
const read = createPersonalOrderReader(async () => {
	gets++
	return compressed
})
const order = createPersonalOrderCache() // Default 200,000-title bound: three full 60k compositions fit.
const stats = (values: number[]) => {
	values.sort((a, b) => a - b)
	return {
		requests: values.length,
		minMs: values[0],
		medianMs: values[Math.floor(values.length / 2)],
		maxMs: values.at(-1),
	}
}
const decode: number[] = [],
	cold: number[] = [],
	warm: number[] = [],
	rotating: number[] = []
for (let i = 0; i < 12; i++) {
	const start = performance.now()
	const data = (await read(`cold-${i}`, snapshot)).data!
	decode.push(performance.now() - start)
	const composeStart = performance.now()
	if (order(keys, data, snapshot).keys.length !== count)
		throw Error("Incomplete order")
	cold.push(performance.now() - composeStart)
}
for (let i = 0; i < 20; i++) {
	const start = performance.now()
	order(keys, (await read("cold-11", snapshot)).data!, snapshot)
	warm.push(performance.now() - start)
}
let maxRss = process.memoryUsage().rss
for (let i = 0; i < 170; i++) {
	const start = performance.now()
	order(keys, (await read(`member-${i}`, snapshot)).data!, snapshot)
	rotating.push(performance.now() - start)
	maxRss = Math.max(maxRss, process.memoryUsage().rss)
}
console.log(
	JSON.stringify(
		{
			titles: count,
			jsonBytes: Buffer.byteLength(raw),
			gzipBytes: compressed.length,
			preparedBytes: count * (8 + 4 + 1 + 8 + 1 + 1 + 4),
			coldDecode: stats(decode),
			coldCompositionAtCacheBound: stats(cold),
			warm: stats(warm),
			rotating170: stats(rotating),
			gets,
			maxSampledRssMiB: maxRss / 1024 ** 2,
		},
		null,
		2,
	),
)
