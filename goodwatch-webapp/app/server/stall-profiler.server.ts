// Says what held the event loop when it stalled. In November 2026 every page process stalled for 1.3 to 2.6 seconds in
// its first minutes and for 200 to 400 ms after that; the loop delay showed that it happened, not what ran.
//
// - V8's sampling profiler runs from the process start for STALL_PROFILER_MINUTES, through the inspector of this
//   process, in windows of WINDOW_MS. Between two windows it hands over the samples and starts again (see below for
//   why that is cheap).
// - A timer every TICK_MS notes how late it ran. A tick at least STALL_PROFILER_MS late is a stall; the samples taken
//   during it say what ran. The first MAX_STALL_LINES stalls get a "Stall profile:" line each, the first
//   MAX_STALL_FILES of them also a .cpuprofile file of their window (in STALL_PROFILER_DIR, by default the temp
//   directory), which Chrome's DevTools open.
// - Every stall of at least SLOW_MS adds its samples to a running count, and every SUMMARY_EVERY_MS a "Stall summary:"
//   line says which functions those samples were in, and which ran most of the busy time in all.
// - The cost: a sample every SAMPLING_US, the hand-over and analysis of each window on the main thread (its longest
//   is in the summary line as rotateMaxMs), and once at the end the stop of the whole profile. Nothing runs after
//   the profiling period.
//
// Settings: STALL_PROFILER=off turns it off; STALL_PROFILER_MS (default 1000), STALL_PROFILER_MINUTES (default 20),
// STALL_PROFILER_DIR.
import { mkdir, writeFile } from "node:fs/promises"
import { Session } from "node:inspector"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { onShutdown } from "./lifecycle.server.ts"

export const TICK_MS = 50
const WINDOW_MS = 15_000
const SAMPLING_US = 4_000
export const SLOW_MS = 200
const MAX_STALL_LINES = 8
const MAX_STALL_FILES = 3
const SUMMARY_EVERY_MS = 5 * 60_000
const TOP = 12

type CallFrame = {
	functionName: string
	url: string
	lineNumber: number
	columnNumber: number
}
export type CpuProfile = {
	nodes: Array<{ id: number; callFrame: CallFrame; children?: number[] }>
	startTime: number
	endTime: number
	samples?: number[]
	timeDeltas?: number[]
}
/** A stretch of time in the profile's clock: microseconds of `process.hrtime`. */
export type Span = { startUs: number; endUs: number }
export type Tally = Map<string, number>
export type StallSummary = {
	samples: number
	/** Every sample in the stall, idle ones too, and the longest time without one: the profiler takes none while the
	 * process isn't running. */
	allSamples: number
	maxGapMs: number
	/** The function a sample was in. */
	self: Array<[string, number]>
	/** Every function on a sample's stack, once per sample. */
	inclusive: Array<[string, number]>
	/** The most common stacks, innermost first, a few frames deep. */
	stacks: Array<[string, number]>
}

const NOT_BUSY = new Set(["(idle)", "(root)", "(program)"])

/** A short name for a frame: the function, and the file and line after `node_modules/` or the app's directory. */
export function frameLabel({ functionName, url, lineNumber }: CallFrame) {
	const name = functionName || "(anonymous)"
	if (!url) return name
	// Only files on disk and Node's own modules are named, by their path alone: a script from anywhere else (an
	// `eval` with a source URL, a data: URL) could carry anything in its address.
	if (!/^(?:file:\/\/\/|node:|\/)/.test(url)) return `${name} (other script)`
	const file = url
		.replace(/[?#].*$/, "")
		.replace(/^file:\/\//, "")
		.replace(/^.*\/node_modules\//, "")
		.replace(/^.*\/build\/server\//, "")
	return `${name} ${file}:${lineNumber + 1}`
}

// A tally keeps at most this many names; later new names are left out, so 20 minutes can't grow it without bound.
const MAX_NAMES = 5_000

const add = (tally: Tally, key: string, by = 1) => {
	const count = tally.get(key)
	if (count !== undefined) tally.set(key, count + by)
	else if (tally.size < MAX_NAMES) tally.set(key, by)
}

export const top = (tally: Tally, count = TOP): Array<[string, number]> =>
	[...tally].sort((a, b) => b[1] - a[1]).slice(0, count)

/**
 * Counts the samples of `profile` that were taken during one of `spans` (sorted by time; all samples without
 * `spans`), by the function they were in and by every function on their stack, and by stack when `stacks` is given.
 * Idle samples aren't counted. It visits each profile node a few times, never once per sample and frame: a busy
 * 30-second window has thousands of nodes and stacks a hundred frames deep.
 */
export function tallyProfile(
	profile: CpuProfile,
	spans?: Span[],
	into: { self: Tally; inclusive: Tally } = {
		self: new Map(),
		inclusive: new Map(),
	},
	stacks?: Tally,
): { samples: number; self: Tally; inclusive: Tally } {
	const nodes = new Map<number, CpuProfile["nodes"][number]>()
	const parent = new Map<number, number>()
	for (const node of profile.nodes) {
		nodes.set(node.id, node)
		for (const child of node.children ?? []) parent.set(child, node.id)
	}
	// Named on first use: most nodes of a window are never on a counted stack.
	const labels = new Map<number, string>()
	const label = (id: number) => {
		let name = labels.get(id)
		if (name === undefined) {
			const node = nodes.get(id)
			name = node ? frameLabel(node.callFrame) : "?"
			labels.set(id, name)
		}
		return name
	}
	// The samples each node was the innermost frame of.
	const own = new Map<number, number>()
	const samples = profile.samples ?? []
	const deltas = profile.timeDeltas ?? []
	let at = profile.startTime
	let span = 0
	for (let i = 0; i < samples.length; i++) {
		at += deltas[i] ?? 0
		if (spans) {
			while (span < spans.length && spans[span].endUs < at) span++
			if (span >= spans.length) break
			if (at < spans[span].startUs) continue
		}
		own.set(samples[i], (own.get(samples[i]) ?? 0) + 1)
	}
	let counted = 0
	for (const [id, count] of own) {
		const name = label(id)
		if (NOT_BUSY.has(name)) {
			own.delete(id)
			continue
		}
		counted += count
		add(into.self, name, count)
		if (!stacks) continue
		const stack: string[] = []
		for (
			let up: number | undefined = id;
			up !== undefined && stack.length < 6;
			up = parent.get(up)
		) {
			const frame = label(up)
			if (frame === "(root)") break
			stack.push(frame)
		}
		add(stacks, stack.join(" < "), count)
	}
	if (!counted) return { samples: 0, ...into }
	// The samples in each node's subtree: children before parents in reverse preorder.
	const root = profile.nodes.find((node) => !parent.has(node.id))?.id
	if (root === undefined) return { samples: counted, ...into }
	const order: number[] = []
	for (const pending = [root]; pending.length; ) {
		const id = pending.pop() as number
		order.push(id)
		for (const child of nodes.get(id)?.children ?? []) pending.push(child)
	}
	const total = new Map<number, number>()
	for (let i = order.length - 1; i >= 0; i--) {
		const id = order[i]
		const sum = (total.get(id) ?? 0) + (own.get(id) ?? 0)
		total.set(id, sum)
		const up = parent.get(id)
		if (up !== undefined && sum) total.set(up, (total.get(up) ?? 0) + sum)
	}
	// Each function counts its outermost frame's subtree on every path, so a recursive one counts a sample once.
	const onPath = new Map<string, number>()
	const walk: number[] = [root]
	while (walk.length) {
		const step = walk.pop() as number
		if (step < 0) {
			const name = label(-step - 1)
			onPath.set(name, (onPath.get(name) ?? 1) - 1)
			continue
		}
		const sum = total.get(step) ?? 0
		if (!sum) continue
		const name = label(step)
		// Node's own timer and stream frames sit under everything and would fill the list.
		if (
			!onPath.get(name) &&
			name !== "(root)" &&
			!name.includes(" node:internal/")
		)
			add(into.inclusive, name, sum)
		onPath.set(name, (onPath.get(name) ?? 0) + 1)
		walk.push(-step - 1)
		for (const child of nodes.get(step)?.children ?? []) walk.push(child)
	}
	return { samples: counted, ...into }
}

/** What ran during `span`, from the samples of `profile`. */
export function summarizeStall(profile: CpuProfile, span: Span): StallSummary {
	const stacks: Tally = new Map()
	const tally = tallyProfile(profile, [span], undefined, stacks)
	let at = profile.startTime
	let previous = profile.startTime
	let allSamples = 0
	let maxGapUs = 0
	const deltas = profile.timeDeltas ?? []
	for (const delta of deltas) {
		at += delta
		if (at >= span.startUs && previous <= span.endUs)
			maxGapUs = Math.max(
				maxGapUs,
				Math.min(at, span.endUs) - Math.max(previous, span.startUs),
			)
		if (at >= span.startUs && at <= span.endUs) allSamples++
		previous = at
	}
	if (previous < span.endUs)
		maxGapUs = Math.max(maxGapUs, span.endUs - Math.max(previous, span.startUs))
	return {
		samples: tally.samples,
		allSamples,
		maxGapMs: Math.round(maxGapUs / 1000),
		self: top(tally.self),
		inclusive: top(tally.inclusive),
		stacks: top(stacks, 4),
	}
}

/**
 * The stall watch of one process: a timer that notes how late it ran, and when a window ends, the stalls in it.
 * `now` (microseconds) is for tests.
 */
export function createStallWatch(
	options: {
		now?: () => number
		usage?: () => Usage
		thresholdMs?: number
	} = {},
) {
	const now =
		options.now ?? (() => Number(process.hrtime.bigint() / BigInt(1000)))
	const usage = options.usage ?? processUsage
	const thresholdMs = options.thresholdMs ?? 1000
	let expected = now() + TICK_MS * 1000
	let before = usage()
	const stalls: Array<Stall> = []
	const slow: Span[] = []
	return {
		/** One tick of the timer. */
		tick() {
			const at = now()
			const used = usage()
			const lateMs = (at - expected) / 1000
			if (lateMs >= SLOW_MS) slow.push({ startUs: expected, endUs: at })
			if (lateMs >= thresholdMs)
				stalls.push({
					startUs: expected,
					endUs: at,
					lateMs,
					atS: Math.round(process.uptime()),
					// Since the tick before: CPU time far below the stall's length means the process wasn't running
					// (descheduled, swapping, stopped), not that JavaScript was busy.
					cpuMs: Math.round((used.cpuUs - before.cpuUs) / 1000),
					majorFaults: used.majorFaults - before.majorFaults,
					involuntarySwitches:
						used.involuntarySwitches - before.involuntarySwitches,
				})
			before = used
			expected = at + TICK_MS * 1000
		},
		/** The stalls and the slow stretches noted since the last call. */
		take() {
			return {
				stalls: stalls.splice(0, stalls.length),
				slow: slow.splice(0, slow.length),
			}
		},
	}
}

const setting = (name: string, fallback: number) => {
	const value = Number(process.env[name])
	return process.env[name] && Number.isFinite(value) && value > 0
		? value
		: fallback
}

export type Usage = {
	cpuUs: number
	majorFaults: number
	involuntarySwitches: number
}
export type Stall = Span & {
	lateMs: number
	atS: number
	cpuMs: number
	majorFaults: number
	involuntarySwitches: number
}
function processUsage(): Usage {
	const used = process.resourceUsage()
	return {
		cpuUs: used.userCPUTime + used.systemCPUTime,
		majorFaults: used.majorPageFault,
		involuntarySwitches: used.involuntaryContextSwitches,
	}
}

let started = false

/** Starts the profiler for the first minutes of the process, once. */
export function startStallProfiler(): void {
	if (started || process.env.STALL_PROFILER === "off") return
	started = true
	const thresholdMs = setting("STALL_PROFILER_MS", 1000)
	const untilMs = Date.now() + setting("STALL_PROFILER_MINUTES", 20) * 60_000
	const directory =
		process.env.STALL_PROFILER_DIR || join(tmpdir(), "stall-profiles")
	// Starting V8's profiler while no profile runs walks the whole heap for the code in it: 350 to 500 ms with a few
	// hundred MB of heap, measured locally, and the inspector's own profile pays it on every start. So the inspector's
	// profile (the anchor) runs for the whole period and is never read, and the windows are `console.profile`
	// profiles of the same session beside it: each starts and ends in about a millisecond, and its samples arrive as
	// an event during `console.profileEnd`. The anchor starts before the server listens; reading it at the end of the
	// period is the profiler's one costly step after that.
	const session = new Session()
	const disconnect = () => {
		try {
			session.post("Profiler.disable")
		} catch {
			// Not connected.
		}
		try {
			session.disconnect()
		} catch {
			// Not connected.
		}
	}
	let finished: CpuProfile | undefined
	let window = 0
	const windowName = () => `stall-profiler-${window}`
	try {
		session.connect()
		session.on("Profiler.consoleProfileFinished", (message) => {
			const { id, profile, title } = message.params as {
				id: string
				profile: CpuProfile
				title?: string
			}
			if ((title ?? id) === windowName()) finished = profile
		})
		session.post("Profiler.enable")
		session.post("Profiler.setSamplingInterval", { interval: SAMPLING_US })
		session.post("Profiler.start")
		console.profile(windowName())
	} catch (error) {
		console.warn("Stall profiler: could not start", error)
		disconnect()
		return
	}
	const watch = createStallWatch({ thresholdMs })
	const slowTally = { self: new Map() as Tally, inclusive: new Map() as Tally }
	const busyTally = { self: new Map() as Tally, inclusive: new Map() as Tally }
	let slowSamples = 0
	let busySamples = 0
	let lines = 0
	let files = 0
	let windowStart = Date.now()
	let lastSummary = Date.now()
	// The longest hand-over of a window with its analysis, on the main thread: the profiler's own cost.
	let rotateMaxMs = 0
	// Of that, the longest wait for the window's samples from the inspector.
	let handOverMaxMs = 0

	const summarize = () => {
		console.info(
			`Stall summary: ${JSON.stringify({
				upS: Math.round(process.uptime()),
				slowMs: SLOW_MS,
				slowSamples,
				slowSelf: top(slowTally.self),
				slowInclusive: top(slowTally.inclusive),
				busySamples,
				busySelf: top(busyTally.self),
				busyInclusive: top(busyTally.inclusive),
				rotateMaxMs: Math.round(rotateMaxMs),
				handOverMaxMs: Math.round(handOverMaxMs),
			})}`,
		)
	}

	const rotate = (last: boolean) => {
		const started = performance.now()
		try {
			handOver(last)
		} finally {
			rotateMaxMs = Math.max(rotateMaxMs, performance.now() - started)
		}
	}
	const handOver = (last: boolean) => {
		finished = undefined
		const ending = performance.now()
		console.profileEnd(windowName())
		handOverMaxMs = Math.max(handOverMaxMs, performance.now() - ending)
		const profile = finished as CpuProfile | undefined
		finished = undefined
		window++
		if (!last) console.profile(windowName())
		windowStart = Date.now()
		const { stalls, slow } = watch.take()
		if (!profile) return
		slowSamples += tallyProfile(profile, slow, slowTally).samples
		busySamples += tallyProfile(profile, undefined, busyTally).samples
		for (const stall of stalls) {
			if (lines >= MAX_STALL_LINES) break
			lines++
			const summary = summarizeStall(profile, stall)
			let file: string | undefined
			if (files < MAX_STALL_FILES) {
				files++
				file = join(directory, `${process.pid}-${files}.cpuprofile`)
				const text = JSON.stringify(profile)
				mkdir(directory, { recursive: true })
					.then(() => writeFile(file as string, text))
					.catch((error) =>
						console.warn("Stall profiler: could not write", file, error),
					)
			}
			console.info(
				`Stall profile: ${JSON.stringify({
					lateMs: Math.round(stall.lateMs),
					// Seconds since the process start when the stall ended.
					upS: stall.atS,
					cpuMs: stall.cpuMs,
					majorFaults: stall.majorFaults,
					involuntarySwitches: stall.involuntarySwitches,
					file,
					...summary,
				})}`,
			)
		}
	}

	let stopped = false
	// The last window is read and summarized at the end of the period and at shutdown, so a stall just before either
	// still gets its line. Profile files still being written at shutdown may be lost.
	const stop = () => {
		if (stopped) return
		stopped = true
		clearInterval(timer)
		try {
			watch.tick()
			rotate(true)
			summarize()
		} catch {
			// The profiler stops all the same.
		} finally {
			// `Profiler.disable` ends the anchor without building its profile, which `Profiler.stop` would.
			const stopping = performance.now()
			disconnect()
			console.info(
				`Stall profiler: stopped (${Math.round(performance.now() - stopping)} ms)`,
			)
			// The lifecycle keeps `stop` until the exit; the counts go now.
			for (const tally of [slowTally, busyTally]) {
				tally.self.clear()
				tally.inclusive.clear()
			}
		}
	}
	const timer = setInterval(() => {
		watch.tick()
		const at = Date.now()
		if (at >= untilMs) return stop()
		if (at - windowStart >= WINDOW_MS) rotate(false)
		if (at - lastSummary >= SUMMARY_EVERY_MS) {
			lastSummary = at
			summarize()
		}
	}, TICK_MS)
	timer.unref()
	onShutdown("stall profiler", stop)
}
