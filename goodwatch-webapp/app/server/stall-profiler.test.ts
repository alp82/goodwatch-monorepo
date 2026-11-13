// The stall profiler: which samples count for a stall, how frames are named, and when a tick is a stall.
import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type CpuProfile,
	SLOW_MS,
	TICK_MS,
	createStallWatch,
	frameLabel,
	summarizeStall,
	tallyProfile,
} from "./stall-profiler.server.ts"

const frame = (functionName: string, url = "", lineNumber = 0) => ({
	functionName,
	url,
	lineNumber,
	columnNumber: 0,
})

// root > main > (build index) > parse; root > (idle); root > (garbage collector)
const profile: CpuProfile = {
	nodes: [
		{ id: 1, callFrame: frame("(root)"), children: [2, 5, 6] },
		{
			id: 2,
			callFrame: frame("main", "file:///app/build/server/index.js", 9),
			children: [3],
		},
		{
			id: 3,
			callFrame: frame(
				"buildIndex",
				"file:///app/build/server/assets/trope-recs-abc.js",
				41,
			),
			children: [4],
		},
		{ id: 4, callFrame: frame("parse") },
		{ id: 5, callFrame: frame("(idle)") },
		{ id: 6, callFrame: frame("(garbage collector)") },
	],
	startTime: 1_000_000,
	endTime: 1_100_000,
	// One sample every 10 ms from 1_010_000.
	samples: [5, 4, 4, 3, 6, 4, 5, 5, 2, 5],
	timeDeltas: Array(10).fill(10_000),
}

test("a frame is named by its function and the file under the build or node_modules", () => {
	assert.equal(
		frameLabel(
			frame("buildIndex", "file:///app/build/server/assets/x-1.js", 41),
		),
		"buildIndex assets/x-1.js:42",
	)
	assert.equal(
		frameLabel(frame("parse", "file:///app/node_modules/pg/lib/result.js", 0)),
		"parse pg/lib/result.js:1",
	)
	assert.equal(
		frameLabel(frame("run", "file:///app/build/server/a.js?token=x#y", 0)),
		"run a.js:1",
	)
	assert.equal(
		frameLabel(frame("run", "https://example.com/s.js?token=x", 0)),
		"run (other script)",
	)
	assert.equal(frameLabel(frame("")), "(anonymous)")
	assert.equal(frameLabel(frame("(garbage collector)")), "(garbage collector)")
})

test("only the busy samples inside the stall count, with every frame on their stack once", () => {
	// Samples at 1_020_000 to 1_060_000: parse, parse, buildIndex, GC, parse.
	const summary = summarizeStall(profile, {
		startUs: 1_015_000,
		endUs: 1_060_000,
	})
	assert.equal(summary.samples, 5)
	assert.equal(summary.allSamples, 5)
	assert.equal(summary.maxGapMs, 10)
	assert.deepEqual(summary.self, [
		["parse", 3],
		["buildIndex assets/trope-recs-abc.js:42", 1],
		["(garbage collector)", 1],
	])
	assert.deepEqual(summary.inclusive.slice(0, 3), [
		["main index.js:10", 4],
		["buildIndex assets/trope-recs-abc.js:42", 4],
		["parse", 3],
	])
	assert.deepEqual(summary.stacks[0], [
		"parse < buildIndex assets/trope-recs-abc.js:42 < main index.js:10",
		3,
	])
})

test("a recursive function counts each sample once", () => {
	const recursive: CpuProfile = {
		nodes: [
			{ id: 1, callFrame: frame("(root)"), children: [2] },
			{ id: 2, callFrame: frame("walk"), children: [3] },
			{ id: 3, callFrame: frame("walk"), children: [4] },
			{ id: 4, callFrame: frame("walk") },
		],
		startTime: 0,
		endTime: 30,
		samples: [4, 3, 2],
		timeDeltas: [10, 10, 10],
	}
	const tally = tallyProfile(recursive)
	assert.equal(tally.samples, 3)
	assert.deepEqual([...tally.inclusive], [["walk", 3]])
	assert.deepEqual([...tally.self], [["walk", 3]])
})

test("only the samples inside one of several spans count", () => {
	const tally = tallyProfile(profile, [
		{ startUs: 1_015_000, endUs: 1_025_000 },
		{ startUs: 1_085_000, endUs: 1_095_000 },
	])
	// 1_020_000 parse, 1_090_000 main
	assert.equal(tally.samples, 2)
})

test("without spans the whole profile counts, idle left out", () => {
	const tally = tallyProfile(profile)
	assert.equal(tally.samples, 6)
})

test("a tick late by the threshold is a stall, and by SLOW_MS a slow stretch", () => {
	let now = 0
	let cpuUs = 0
	const watch = createStallWatch({
		now: () => now,
		usage: () => ({ cpuUs, majorFaults: 0, involuntarySwitches: 0 }),
		thresholdMs: 1000,
	})
	now += TICK_MS * 1000
	watch.tick()
	assert.deepEqual(watch.take(), { stalls: [], slow: [] })
	now += (TICK_MS + SLOW_MS) * 1000
	watch.tick()
	now += (TICK_MS + 1500) * 1000
	cpuUs += 40_000
	watch.tick()
	const taken = watch.take()
	assert.equal(taken.slow.length, 2)
	assert.equal(taken.stalls.length, 1)
	assert.equal(taken.stalls[0].lateMs, 1500)
	assert.equal(taken.stalls[0].cpuMs, 40)
	assert.equal(taken.stalls[0].endUs - taken.stalls[0].startUs, 1500 * 1000)
	assert.deepEqual(watch.take(), { stalls: [], slow: [] })
})
