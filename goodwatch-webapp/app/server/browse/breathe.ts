// Lets other requests run during a long page build. A Browse page asks for hundreds of counts and a few clusterings on
// a cold cache; done in one go they hold the event loop for most of a second, the overload guard
// (server/overload-shed.server.ts) then sheds every anonymous request for three seconds, and health checks run late.
// `await breathe()` inside such a loop gives the loop back once the current slice has run longer than SLICE_MS.

const SLICE_MS = 12
let sliceStart = performance.now()

/** Yields to the event loop when the running slice is older than SLICE_MS; otherwise returns at once. */
export async function breathe(): Promise<void> {
	if (performance.now() - sliceStart < SLICE_MS) return
	await new Promise<void>((resolve) => setImmediate(resolve))
	sliceStart = performance.now()
}

/** `items.map(fn)`, giving the event loop back between items when a slice runs long. */
export async function mapBreathing<T, U>(items: readonly T[], fn: (item: T) => U): Promise<U[]> {
	const out: U[] = []
	for (const item of items) {
		await breathe()
		out.push(fn(item))
	}
	return out
}
