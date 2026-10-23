// Keeps our prefetches from loading the server: at most MAX_IN_FLIGHT at a time and BUDGET_PER_MINUTE a minute.
// A press (pointer or touch down on a link) skips both limits: the click that follows would ask for the same data
// anyway, so it adds no work. Hover and focus wait in front of viewport prefetches. This file has no browser
// imports, so `node --test` runs its tests directly.

export const MAX_IN_FLIGHT = 2
export const BUDGET_PER_MINUTE = 40
export const MAX_WAITING = 4

export type Priority = "press" | "intent" | "viewport"

export interface PrefetchJob {
	key: string
	priority: Priority
	run: () => Promise<unknown>
}

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
		if (job.priority === "press") {
			this.cancel(job.key)
			this.start(job)
			return true
		}
		if (this.waiting.some((waiting) => waiting.key === job.key)) return true
		if (!this.withinBudget()) return false
		if (this.inFlight < MAX_IN_FLIGHT) {
			this.start(job)
			return true
		}
		if (job.priority === "intent") this.waiting.unshift(job)
		else this.waiting.push(job)
		if (this.waiting.length > MAX_WAITING) this.waiting.pop()
		return this.waiting.includes(job)
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
