import type { TalkedRow } from "../../domain/talked-about-now.ts"

export const HOT_PAGE_BUDGET_MS = 400
const FRESH_MS = 10 * 60 * 1000
const STALE_MS = 10 * 60 * 1000
const RETRY_MS = 60 * 1000

export class HotPageUnavailable extends Error {
	constructor() {
		super("Hot on socials is temporarily unavailable")
	}
}

/** Keep a complete ranking during refresh. A cold page never waits for a database timeout. */
export function createHotPageRead() {
	let value: { row: TalkedRow | null; at: number } | undefined
	let pending: Promise<TalkedRow | null> | undefined
	let retryAt = 0
	let generation = 0
	return {
		async get(
			load: () => Promise<TalkedRow | null>,
			now = Date.now(),
		): Promise<TalkedRow | null> {
			if (value && now - value.at < FRESH_MS) return value.row
			if (!pending && now >= retryAt) {
				const started = generation
				const work = Promise.resolve().then(load)
				pending = work
				void work
					.then(
						(row) => {
							if (generation === started) value = { row, at: Date.now() }
						},
						() => {
							if (generation === started) retryAt = Date.now() + RETRY_MS
						},
					)
					.finally(() => {
						if (pending === work) pending = undefined
					})
			}
			if (value && now - value.at < FRESH_MS + STALE_MS) return value.row
			if (!pending) throw new HotPageUnavailable()
			let timer: ReturnType<typeof setTimeout> | undefined
			try {
				return await Promise.race([
					pending,
					new Promise<never>((_, reject) => {
						timer = setTimeout(
							() => reject(new HotPageUnavailable()),
							HOT_PAGE_BUDGET_MS,
						)
					}),
				])
			} catch {
				throw new HotPageUnavailable()
			} finally {
				clearTimeout(timer)
			}
		},
		reset() {
			generation++
			value = undefined
			pending = undefined
			retryAt = 0
		},
	}
}
