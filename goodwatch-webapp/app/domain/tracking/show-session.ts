// One show's tracking in the browser while its page is open (docs/implementation/tracking/data-model.md, "The
// browser"): the copy the server confirmed, the actions that are on their way, and what the page shows meanwhile.
//
// An action is applied to the copy at once and sent with the ids the browser made. Actions on one show are sent one
// after the other, never in parallel. An answer replaces the guess for that action. When an action fails or the
// server refuses it, the page goes back to what the server last confirmed, the actions waiting behind it are not
// sent, and the page is told why. No clock and no request of its own: both are handed in.
import type { ListedEpisode } from "./machine.ts"
import {
	type ActionAnswer,
	type PageAction,
	type Restore,
	type ShowCopy,
	applyLocally,
	confirmed,
} from "./show-page.ts"

/** An action as it is sent. */
export interface SentAction {
	action: PageAction
	actionId?: string
	restore?: Restore
}

interface Waiting extends SentAction {
	today: string
	now: number
	settle: (answer: ActionAnswer | null) => void
}

export interface ActOptions {
	/** The id the browser made for the action: the watch id of a `watch`, the group id of a group action. */
	actionId?: string
	/** The date on the device, "YYYY-MM-DD". */
	today: string
	/** The time of the action, in milliseconds. */
	now: number
	restore?: Restore
}

export interface Acted {
	/** Why the page refused the action at once; nothing was sent then. */
	refused: string | null
	/** The server's answer, or null when the action failed, was refused there, or was never sent. */
	done: Promise<ActionAnswer | null>
}

export interface ShowSessionOptions {
	showId: number
	episodes: readonly ListedEpisode[]
	/** What the server holds for the member and this show. */
	copy: ShowCopy
	/** Sends one action. Rejects when the request fails. */
	send: (sent: SentAction) => Promise<ActionAnswer>
	/** Called after every change of what the page shows. */
	onChange?: () => void
	/** Called when an action failed or was refused by the server, after the page went back. */
	onError?: (message: string) => void
	/** Called once no action is on its way, when a copy that was read meanwhile was not taken: read again. */
	onStale?: () => void
}

export const FAILED =
	"That didn't reach us, so the last change was taken back. Please try again."

export class ShowSession {
	private options: ShowSessionOptions
	private base: ShowCopy
	private waiting: Waiting[] = []
	private sending = false
	private missed = false
	private view: ShowCopy

	constructor(options: ShowSessionOptions) {
		this.options = options
		this.base = options.copy
		this.view = options.copy
	}

	/** What the page shows: the confirmed copy with the actions that are on their way applied to it. */
	get shown(): ShowCopy {
		return this.view
	}

	/** Actions are on their way. */
	get busy(): boolean {
		return this.waiting.length > 0
	}

	/** Applies an action to what the page shows and queues it for the server. */
	act(action: PageAction, options: ActOptions): Acted {
		const { today, now, actionId, restore } = options
		const local = applyLocally(this.view, action, actionId, {
			showId: this.options.showId,
			episodes: this.options.episodes,
			today,
			now,
		})
		if (local.refused)
			return { refused: local.refused, done: Promise.resolve(null) }
		let settle: Waiting["settle"] = () => {}
		const done = new Promise<ActionAnswer | null>((resolve) => {
			settle = resolve
		})
		this.waiting.push({ action, actionId, restore, today, now, settle })
		this.view = local.copy
		this.options.onChange?.()
		void this.drain()
		return { refused: null, done }
	}

	/**
	 * Takes a newer copy from the server, such as a refetch after an error. While actions are on their way the copy
	 * is not taken, because their answers are newer than a read that may have started before them; `onStale` then
	 * asks for another read once they are through. Answers whether the copy was taken.
	 */
	load(copy: ShowCopy): boolean {
		if (this.busy) {
			this.missed = true
			return false
		}
		this.base = copy
		this.view = copy
		this.options.onChange?.()
		return true
	}

	private replay() {
		let copy = this.base
		for (const item of this.waiting)
			copy = applyLocally(copy, item.action, item.actionId, {
				showId: this.options.showId,
				episodes: this.options.episodes,
				today: item.today,
				now: item.now,
			}).copy
		this.view = copy
	}

	private async drain() {
		if (this.sending) return
		this.sending = true
		while (this.waiting.length) {
			const item = this.waiting[0]
			let answer: ActionAnswer | null = null
			let message = FAILED
			try {
				answer = await this.options.send({
					action: item.action,
					actionId: item.actionId,
					restore: item.restore,
				})
			} catch {}
			if (answer?.status === "applied") {
				this.base = confirmed(this.base, answer)
				this.waiting.shift()
				this.replay()
				this.options.onChange?.()
				item.settle(answer)
				continue
			}
			if (answer) {
				// A refusal still says where the show stands on the server.
				this.base = { ...this.base, state: answer.state }
				message = answer.refused || FAILED
			}
			const dropped = this.waiting
			this.waiting = []
			this.view = this.base
			this.options.onChange?.()
			for (const each of dropped) each.settle(null)
			this.options.onError?.(message)
		}
		this.sending = false
		if (this.missed) {
			this.missed = false
			this.options.onStale?.()
		}
	}
}
