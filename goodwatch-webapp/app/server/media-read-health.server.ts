import { AsyncLocalStorage } from "node:async_hooks"
type ReadState = { failed: boolean; pending: number; parent?: ReadState }
const reads = new AsyncLocalStorage<ReadState>()
const failedResults = new WeakSet<object>()
export const mediaReadFailed = () => reads.getStore()?.failed === true
export const failedMediaResult = (value: unknown) =>
	!!value && typeof value === "object" && failedResults.has(value)
export function markFailedMediaResult(value: unknown) {
	if (value && typeof value === "object") failedResults.add(value)
}
export function noteMediaReadFailure() {
	const current = reads.getStore()
	if (current) current.failed = true
}
export function observeMediaResult(value: unknown) {
	if (failedMediaResult(value)) noteMediaReadFailure()
}
/** A fresh HTTP/background-render scope; concurrent requests never share failure state. */
export function withMediaRequestHealth<T>(run: () => T): T {
	return reads.run({ failed: false, pending: 0 }, run)
}
/** Each cache target tracks only its dependencies. Optional overlays inherit failure to avoid repeated dead-node reads. */
export async function withMediaReadHealth<T>(
	run: () => Promise<T>,
	options: {
		inheritFailure?: boolean
		propagate?: boolean
		overlay?: boolean
	} = {},
): Promise<T> {
	const parent = reads.getStore(),
		state: ReadState = {
			failed: options.inheritFailure === true && parent?.failed === true,
			pending: 0,
			parent: options.propagate === false ? undefined : parent,
		}
	const chain: ReadState[] = []
	if (options.overlay)
		for (
			let current: ReadState | undefined = state;
			current;
			current = current.parent
		) {
			current.pending++
			chain.push(current)
		}
	try {
		return await reads.run(state, async () => {
			let result: T = await run()
			if (failedMediaResult(result)) state.failed = true
			if (state.failed || state.pending > (options.overlay ? 1 : 0)) {
				// Do not attach failure identity to a shared canonical object returned unchanged.
				if (Array.isArray(result)) result = [...result] as T
				else if (
					result &&
					typeof result === "object" &&
					Object.getPrototypeOf(result) === Object.prototype
				)
					result = { ...result } as T
				markFailedMediaResult(result)
			}
			return result
		})
	} catch (error) {
		if (state.failed) markFailedMediaResult(error)
		throw error
	} finally {
		for (const current of chain) current.pending--
		if (parent && options.propagate !== false && state.failed)
			parent.failed = true
	}
}
export function protectMediaResponse(headers: Headers, result?: unknown) {
	if (
		mediaReadFailed() ||
		(reads.getStore()?.pending ?? 0) > 0 ||
		failedMediaResult(result)
	)
		headers.set("Cache-Control", "private, no-store")
}

/** The same request can fail after a stream has offered a page-cache candidate. */
export function mediaReadHealthProbe() {
	const state = reads.getStore()
	return () => state?.failed === true || (state?.pending ?? 0) > 0
}
