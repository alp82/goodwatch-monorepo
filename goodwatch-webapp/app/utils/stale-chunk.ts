// A feature that loads on first use asks the server for its chunk at that moment. After a deploy the server only has
// the new build's files, so a tab that was opened before the deploy can't load the old chunk. Remix reloads the page
// when that happens to a route. This does the same for other lazy chunks: without it, React would show the error page.

/** What the helper needs from the browser. Tests pass a stand-in. */
export interface StaleChunkEnv {
	now: () => number
	/** The time of the last reload this helper started, or `null`. */
	readLastReload: () => number | null
	writeLastReload: (time: number) => void
	reload: () => void
}

// A second failure this soon after a reload has another cause (offline, a blocked request). Reloading again would loop.
export const RELOAD_GUARD_MS = 30_000

const STORAGE_KEY = "gw_stale_chunk_reload"

/** The helper's environment in a browser. `null` on the server. */
export function browserStaleChunkEnv(): StaleChunkEnv | null {
	if (typeof window === "undefined") return null
	return {
		now: () => Date.now(),
		readLastReload: () => {
			try {
				const stored = Number(sessionStorage.getItem(STORAGE_KEY))
				return stored > 0 ? stored : null
			} catch {
				return null
			}
		},
		writeLastReload: (time) => {
			try {
				sessionStorage.setItem(STORAGE_KEY, String(time))
			} catch {
				// Without storage there is no guard, so `reloadOnStaleChunk` doesn't reload either: see `canGuard`.
			}
		},
		reload: () => window.location.reload(),
	}
}

/**
 * Wraps a dynamic import for `React.lazy`. When the import fails, the page reloads once and the returned promise stays
 * pending, so nothing renders in between. When it fails again within RELOAD_GUARD_MS, or outside a browser, the error
 * goes to the caller.
 */
export function reloadOnStaleChunk<Module>(
	load: () => Promise<Module>,
	env: StaleChunkEnv | null = browserStaleChunkEnv(),
): () => Promise<Module> {
	return () =>
		load().catch((error: unknown) => {
			if (!env) throw error
			const now = env.now()
			const last = env.readLastReload()
			if (last !== null && now - last < RELOAD_GUARD_MS) throw error
			env.writeLastReload(now)
			// The guard must be readable after the reload, or a second failure would reload again.
			if (env.readLastReload() !== now) throw error
			env.reload()
			return new Promise<Module>(() => {})
		})
}
