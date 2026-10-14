// Synthetic only: imports the pure reader/order module, never a backend connector.
import { performance } from "node:perf_hooks"
import { pathToFileURL } from "node:url"
import type { TitleSnapshot } from "../app/server/title-snapshot/snapshot.server.ts"
const { createG1Reader, orderG1, G1_MODEL_HASH } = await import(
	process.argv[2]
		? pathToFileURL(process.argv[2]).href
		: "../app/server/g1/reader.server.ts"
)
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
	modelHash: G1_MODEL_HASH,
	snapshotVersion: snapshot.version,
	builtAt: new Date().toISOString(),
	pointIds: keys,
	b3Rank: keys.map((_, i) => ((i * 7919) % count) / count),
	b5TopHalf: keys.map((_, i) => i % 2 === 0),
	movieSeriesId: keys.map((_, i) => (i < count / 2 ? Math.floor(i / 3) : -1)),
	show: keys.map((k) => k >= 2e12),
	animation: keys.map((_, i) => i % 5 === 0),
	ownShares: [0.4, 0.2],
	othersCount: 10,
	othersRatingsCount: 100,
})
const read = createG1Reader(async () => raw)
for (let i = 0; i < 3; i++)
	orderG1(keys, (await read("synthetic", snapshot)).data!, snapshot)
const times: number[] = []
for (let i = 0; i < 20; i++) {
	const start = performance.now()
	const result = orderG1(
		keys,
		(await read("synthetic", snapshot)).data!,
		snapshot,
	)
	if (result.keys.length !== count) throw Error("Incomplete order")
	times.push(performance.now() - start)
}
times.sort((a, b) => a - b)
console.log(
	JSON.stringify({
		titles: count,
		requests: times.length,
		minMs: times[0],
		medianMs: times[10],
		maxMs: times.at(-1),
	}),
)
