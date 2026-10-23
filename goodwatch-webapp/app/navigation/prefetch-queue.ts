// Keeps our prefetches from loading the server: at most MAX_IN_FLIGHT at a time and BUDGET_PER_MINUTE a minute.
// Every prefetch is a guess, also a press: a swipe on a phone that starts on a poster presses the link without
// opening it. So a press goes first, in front of hover and focus, which go in front of viewport prefetches, but
// within the same limits. Only the navigation itself loads outside them, and it doesn't go through this queue.
// This file has no browser imports, so `node --test` runs its tests directly.

export const MAX_IN_FLIGHT = 2
export const BUDGET_PER_MINUTE = 40
export const MAX_WAITING = 4

export type Priority = "press" | "intent" | "viewport"

export interface PrefetchJob {
	key: string
	priority: Priority
	run: () => Promise<unknown>
}

// Lower goes first.
const RANK: Record<Priority, number> = { press: 0, intent: 1, viewport: 2 }

export class PrefetchQueue {
	private inFlight = 0
	private readonly started: number[] = []
	private waiting: PrefetchJob[] = []

	private readonly now: () => number

	constructor(now: () => number = Date.now) {
		this.now = now
	}

	/** Starts the job, queues it, or drops it. Returns false when it was dropped. */
	request(job: PrefetchJob): boolean {
		const waiting = this.waiting.find((other) => other.key === job.key)
		if (waiting && RANK[waiting.priority] <= RANK[job.priority]) return true
		this.cancel(job.key)
		if (!this.withinBudget()) return false
		if (this.inFlight < MAX_IN_FLIGHT) {
			this.start(job)
			return true
		}
		const at = this.waiting.findIndex(
			(other) => RANK[other.priority] > RANK[job.priority],
		)
		if (at === -1) this.waiting.push(job)
		else this.waiting.splice(at, 0, job)
		if (this.waiting.length > MAX_WAITING) this.waiting.pop()
		return this.waiting.includes(job)
	}

	/** Drops every job that hasn't started, as when the cache was cleared or the tab was hidden. */
	clear(): void {
		this.waiting = []
	}

	/** Takes a job that hasn't started out of the queue, as when the pointer leaves the link. */
	cancel(key: string): void {
		this.waiting = this.waiting.filter((job) => job.key !== key)
	}

	get running(): number {
		return this.inFlight
	}

	get queued(): number {
		return this.waiting.length
	}

	private withinBudget(): boolean {
		const since = this.now() - 60_000
		while (this.started.length && this.started[0] <= since) this.started.shift()
		return this.started.length < BUDGET_PER_MINUTE
	}

	private start(job: PrefetchJob): void {
		this.inFlight++
		this.started.push(this.now())
		const done = () => {
			this.inFlight--
			this.pump()
		}
		let running: Promise<unknown>
		try {
			running = job.run()
		} catch {
			running = Promise.resolve()
		}
		running.then(done, done)
	}

	private pump(): void {
		while (this.inFlight < MAX_IN_FLIGHT && this.waiting.length) {
			if (!this.withinBudget()) {
				this.waiting = []
				return
			}
			const next = this.waiting.shift()
			if (next) this.start(next)
		}
	}
}
