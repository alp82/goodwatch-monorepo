import { createHash } from "node:crypto"

// A fixed-window counter per client, in this process. Bounds how many reports one address can send; it keeps no
// address, only a hash, and forgets a window once it is over.
export function createRateLimit({
	limit,
	windowMs,
	maxClients = 10_000,
	now = Date.now,
}: {
	limit: number
	windowMs: number
	maxClients?: number
	now?: () => number
}) {
	const windows = new Map<string, { start: number; count: number }>()
	return {
		/** Counts one request of the client and says whether it is within the limit. */
		take(client: string): boolean {
			const time = now()
			const key = createHash("sha256").update(client).digest("hex")
			let window = windows.get(key)
			if (!window || time - window.start >= windowMs) {
				if (!window && windows.size >= maxClients) {
					for (const [other, entry] of windows) if (time - entry.start >= windowMs) windows.delete(other)
					// Still full: the oldest client goes (Maps iterate in insertion order).
					if (windows.size >= maxClients) windows.delete(windows.keys().next().value as string)
				}
				window = { start: time, count: 0 }
				windows.delete(key)
				windows.set(key, window)
			}
			window.count++
			return window.count <= limit
		},
	}
}

/** The client's address as the ingress states it. The ingress must overwrite X-Forwarded-For. */
export function clientAddress(request: Request): string {
	return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}
