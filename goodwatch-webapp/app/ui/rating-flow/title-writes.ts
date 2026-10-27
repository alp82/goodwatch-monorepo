// One write at a time per title, for the rating flow's answers: giving an answer, changing it and clearing it all go
// through `run`, so a clear on its way can't delete a newer score, and a score on its way can't bring back an answer
// that was cleared. A second write for a title with one on its way is turned down (the page shows it as busy) rather
// than queued, so the person never sees an answer they didn't give last. The lock ends only when the write settles:
// ending the acknowledgement (score-ack.ts, `cancel`) or opening the title again doesn't end it.
//
// No React, so the tests run it as it is; `use-rating-core.ts` holds one per flow.

export class TitleWrites {
	private readonly pending = new Set<string>()
	private readonly changed: () => void

	/** `changed` runs whenever a title's lock starts or ends, so the page can draw it as busy. */
	constructor(changed: () => void = () => {}) {
		this.changed = changed
	}

	/** Whether a write for the title with `key` is on its way. */
	busy(key: string | null | undefined): boolean {
		return key != null && this.pending.has(key)
	}

	/**
	 * Runs `write` for the title with `key`, unless a write for it is on its way: then nothing runs and it returns
	 * null. The title stays locked until the write settles, saved or not.
	 */
	run<T>(key: string, write: () => Promise<T>): Promise<T> | null {
		if (this.pending.has(key)) return null
		this.pending.add(key)
		this.changed()
		const release = () => {
			this.pending.delete(key)
			this.changed()
		}
		let running: Promise<T>
		try {
			running = write()
		} catch (error) {
			running = Promise.reject(error)
		}
		return running.then(
			(value) => {
				release()
				return value
			},
			(error) => {
				release()
				throw error
			},
		)
	}
}

type Mark = "score" | "skip" | "plan" | "not-interested"

/**
 * What giving `given` to a title opened again saves, after its earlier answer `before`: "nothing" for the same answer
 * the store is confirmed to hold (a guest's browser always is; a member's account only when `stored` says so, so a
 * half-done clear is saved again rather than shown as done), "clear-then-save" when a member's earlier answer has to
 * go first (anything but a score over a score), or "save".
 */
export function answerPlan({
	before,
	given,
	member,
	stored,
}: {
	before: { type: Mark; score?: number } | null
	given: { type: Mark; score?: number }
	member: boolean
	/** The member's account holds `given` already (answered.ts, `storedAnswerIs`). */
	stored: boolean
}): "nothing" | "save" | "clear-then-save" {
	if (!before) return "save"
	const same =
		before.type === given.type &&
		(given.type !== "score" || before.score === given.score)
	if (same) return !member || stored ? "nothing" : "save"
	if (member && !(before.type === "score" && given.type === "score"))
		return "clear-then-save"
	return "save"
}
