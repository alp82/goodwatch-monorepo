// Admission belongs to uncached profile work, not requests: warm/shared-cache hits and callers joining a profile
// already loading do not take slots. A bounded FIFO absorbs short bursts without unbounded database concurrency.
export function createPersonProfileCache<T>(options: {
	read: (id: number, load: () => Promise<T>) => Promise<T>
	load: (id: number) => Promise<T>
	now?: () => number
	concurrency?: number
	queueSize?: number
	waitMs?: number
	ttlMs?: number
	entries?: number
}) {
	const now = options.now ?? Date.now
	const recent = new Map<number, { value: T; expires: number }>()
	const pending = new Map<number, Promise<T>>()
	const queue: { start: () => void }[] = []
	let active = 0
	const busy = () =>
		new Response("Person profile temporarily busy. Try again shortly.", {
			status: 503,
			headers: { "Retry-After": "2", "Cache-Control": "private, no-store" },
		})
	async function cold(id: number): Promise<T> {
		if (active >= (options.concurrency ?? 4)) {
			if (queue.length >= (options.queueSize ?? 64)) throw busy()
			await new Promise<void>((resolve, reject) => {
				const waiter = {
					start: () => {
						clearTimeout(timer)
						resolve()
					},
				}
				const timer = setTimeout(() => {
					const at = queue.indexOf(waiter)
					if (at >= 0) queue.splice(at, 1)
					reject(busy())
				}, options.waitMs ?? 2000)
				queue.push(waiter)
			})
		} else active++
		try {
			return await options.load(id)
		} finally {
			// Transfer the occupied slot directly; a new arrival cannot jump ahead of a queued profile.
			const waiter = queue.shift()
			if (waiter) waiter.start()
			else active--
		}
	}
	return {
		get(id: number): Promise<T> {
			const hit = recent.get(id)
			if (hit) {
				recent.delete(id)
				if (hit.expires > now()) {
					recent.set(id, hit)
					return Promise.resolve(hit.value)
				}
			}
			const shared = pending.get(id)
			if (shared) return shared
			// Bound outstanding shared-cache reads too. This is a service capacity guard, never a crawler rate verdict.
			if (pending.size >= 512) return Promise.reject(busy())
			const load = Promise.resolve()
				.then(() => options.read(id, () => cold(id)))
				.then((value) => {
					recent.set(id, { value, expires: now() + (options.ttlMs ?? 300_000) })
					while (recent.size > (options.entries ?? 50))
						recent.delete(recent.keys().next().value!)
					return value
				})
				.finally(() => pending.delete(id))
			pending.set(id, load)
			return load
		},
	}
}
