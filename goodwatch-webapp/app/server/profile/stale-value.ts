export interface StaleValue<T> {
	value: T
	fresh: boolean
}

/** One refresh per key in this process. A failed refresh leaves the last successful value available. */
export function staleValues<T>() {
	const pending = new Map<string, Promise<T>>()
	const refresh = (
		key: string,
		build: () => Promise<T>,
		background = false,
	): Promise<T> => {
		const existing = pending.get(key)
		if (existing) return existing
		const start = background
			? new Promise<void>((resolve) => setImmediate(resolve))
			: Promise.resolve()
		const work = start.then(build).finally(() => pending.delete(key))
		pending.set(key, work)
		return work
	}
	return {
		refresh,
		/** A write during an existing computation needs one more read after that computation ends. */
		async refreshAfterPending(key: string, build: () => Promise<T>) {
			await pending.get(key)?.catch(() => undefined)
			return refresh(key, build)
		},
		read(
			key: string,
			entry: StaleValue<T> | null,
			build: () => Promise<T>,
		): Promise<T> {
			if (entry?.fresh) return Promise.resolve(entry.value)
			const work = refresh(key, build, Boolean(entry))
			if (!entry) return work
			void work.catch((error) =>
				console.error("Profile summary: refresh failed", error),
			)
			return Promise.resolve(entry.value)
		},
	}
}
