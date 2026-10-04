// A breaker belongs to a slot owner, independent of the client connection.
export class RedisNodeDownError extends Error {
	name = "RedisNodeDownError"
	node: string

	constructor(node: string) {
		super("Redis node is marked down")
		this.node = node
	}
}

export const REDIS_BREAKER_OPEN_MS = 1000
export const MAX_REDIS_BREAKERS = 16

type Event = "opened" | "closed" | "probe_failed"
type State = { open: boolean; openedAt: number; probing: boolean }

export function createRedisBreakers(
	options: {
		now?: () => number
		openMs?: number
		max?: number
		onEvent?: (node: string, event: Event) => void
	} = {},
) {
	const now = options.now ?? Date.now
	const openMs = options.openMs ?? REDIS_BREAKER_OPEN_MS
	const max = Math.max(1, options.max ?? MAX_REDIS_BREAKERS)
	const entries = new Map<string, State>()
	const ensure = (node: string) => {
		let state = entries.get(node)
		if (!state) {
			if (entries.size >= max) {
				const oldest =
					[...entries].find(([, entry]) => !entry.open)?.[0] ??
					entries.keys().next().value
				if (oldest !== undefined) entries.delete(oldest)
			}
			state = { open: false, openedAt: 0, probing: false }
			entries.set(node, state)
		}
		return state
	}
	return {
		isOpen(node: string): boolean {
			return entries.get(node)?.open ?? false
		},
		claimProbe(node: string): boolean {
			const state = entries.get(node)
			if (!state?.open || state.probing || now() - state.openedAt < openMs)
				return false
			state.probing = true
			return true
		},
		success(node: string): void {
			const state = ensure(node)
			const wasOpen = state.open
			state.open = false
			state.probing = false
			if (wasOpen) options.onEvent?.(node, "closed")
		},
		failure(node: string): void {
			const state = ensure(node)
			if (state.open) return
			// One failure is enough: healthy nodes answer in microseconds and production
			// has zero error lookups in normal hours. A false open costs one second of
			// cache bypass for one node; a background probe closes it again. Outages
			// must fail fast after their first second.
			state.open = true
			state.openedAt = now()
			options.onEvent?.(node, "opened")
		},
		probeFailed(node: string): void {
			const state = ensure(node)
			state.open = true
			state.probing = false
			state.openedAt = now()
			options.onEvent?.(node, "probe_failed")
		},
		states(): { node: string; open: boolean }[] {
			return [...entries].map(([node, state]) => ({ node, open: state.open }))
		},
		openCount(): number {
			return [...entries.values()].filter((state) => state.open).length
		},
		reset(): void {
			entries.clear()
		},
	}
}
