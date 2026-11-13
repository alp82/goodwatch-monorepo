// Long synchronous work in the request process, cut into slices so that requests run in between. In November 2026 the
// palette's trope catalog (tens of thousands of entries, then a digest of all of them) held every page process for
// about 2 seconds, 20 seconds after its start (see stall-profiler.server.ts).
import { createHash } from "node:crypto"

/** How long one slice may run before the work lets the event loop go on. */
export const SLICE_MS = 10

/**
 * A clock for one piece of work: `due()` says whether the slice is used up, `pause()` lets the event loop run and
 * starts the next slice. Check `due()` in the loop and await `pause()` only when it says so, so that a loop over many
 * small items doesn't await once per item.
 */
export function timeSlice(sliceMs = SLICE_MS, now = () => performance.now()) {
	let started = now()
	return {
		due: () => now() - started >= sliceMs,
		async pause() {
			await new Promise<void>((resolve) => setImmediate(resolve))
			started = now()
		},
	}
}

/** The items of `list` mapped by `map`, in slices. */
export async function mapInSlices<T, R>(
	list: readonly T[],
	map: (item: T) => R,
	slice = timeSlice(),
): Promise<R[]> {
	const out: R[] = []
	for (const item of list) {
		if (slice.due()) await slice.pause()
		out.push(map(item))
	}
	return out
}

/**
 * The SHA-256 hex digest of `JSON.stringify(list)`, the same value, hashed item by item in slices. Items must be
 * values that JSON.stringify writes as themselves in an array (objects, arrays, strings, numbers, booleans, null).
 */
export async function jsonDigest(
	list: readonly unknown[],
	slice = timeSlice(),
): Promise<string> {
	const hash = createHash("sha256").update("[")
	for (let i = 0; i < list.length; i++) {
		if (slice.due()) await slice.pause()
		if (i) hash.update(",")
		hash.update(JSON.stringify(list[i]))
	}
	return hash.update("]").digest("hex")
}

/** Items per run that `Array.prototype.sort` sorts in one piece before the runs are merged. */
const RUN = 512

/**
 * `list` sorted by `compare` into a new array, in slices: the same order as `[...list].sort(compare)`, which is
 * stable, from a merge sort that checks the clock every 1024 items.
 */
export async function sortInSlices<T>(
	list: readonly T[],
	compare: (a: T, b: T) => number,
	slice = timeSlice(),
): Promise<T[]> {
	const n = list.length
	let from = list.slice()
	for (let start = 0; start < n; start += RUN) {
		if (slice.due()) await slice.pause()
		const run = from.slice(start, start + RUN).sort(compare)
		for (let i = 0; i < run.length; i++) from[start + i] = run[i]
	}
	let to = new Array<T>(n)
	for (let width = RUN; width < n; width *= 2) {
		for (let low = 0; low < n; low += 2 * width) {
			const middle = Math.min(low + width, n)
			const high = Math.min(low + 2 * width, n)
			let left = low
			let right = middle
			let at = low
			while (left < middle && right < high) {
				if ((at & 1023) === 0 && slice.due()) await slice.pause()
				// The left item first unless the right one is strictly smaller: stable.
				to[at++] =
					compare(from[right], from[left]) < 0 ? from[right++] : from[left++]
			}
			while (left < middle) to[at++] = from[left++]
			while (right < high) to[at++] = from[right++]
		}
		;[from, to] = [to, from]
	}
	return from
}

/** The return value of `steps`, a generator that yields where it may pause, run in slices. */
export async function runInSlices<R>(
	steps: Generator<unknown, R, void>,
	slice = timeSlice(),
): Promise<R> {
	for (;;) {
		const step = steps.next()
		if (step.done) return step.value
		if (slice.due()) await slice.pause()
	}
}
