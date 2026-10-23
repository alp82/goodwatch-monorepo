// The member's season, episode and part scores of one show on its page (#759), outside React: seeded from the
// show's tracking read, changed at once on the page and sent in the background, one change per score at a time so
// the server keeps the member's latest. A change the server refuses goes back to what the server last confirmed. Separate from the tracking session: a score never records a watch or
// changes the show's status, so it needs none of the session's ordering.
import {
	type EpisodeScoreTarget,
	type MemberEpisodeScore,
	episodeScoreKey,
} from "../../domain/episode-scores.ts"

/** What POST /api/episode-scores answers. */
export interface EpisodeScoreSendAnswer {
	status: "saved" | "cleared" | "unchanged"
	score: MemberEpisodeScore | null
	previous: number | null
}
export type EpisodeScoreSend = (body: object) => Promise<EpisodeScoreSendAnswer>

/** The server found the score gone: removed on another page. The page drops it rather than show it again. */
export class EpisodeScoreGoneError extends Error {
	constructor() {
		super("That score isn't there anymore.")
		this.name = "EpisodeScoreGoneError"
	}
}

/** A target to score: a season, an episode, or a stored part (which carries its key). */
export type ScoreTarget = EpisodeScoreTarget & {
	key?: string
	label?: string | null
}

const requestOf = (target: ScoreTarget, key: string) =>
	target.scope === "season"
		? { scope: "season", season: target.season }
		: target.scope === "episode"
			? { scope: "episode", episodeId: target.episodeTmdbId }
			: { scope: "part", key }

export class EpisodeScoreStore {
	/** What the server last confirmed, by key. */
	private confirmed = new Map<string, MemberEpisodeScore>()
	/** Changes on their way, by key: what shows, and which write is the latest. */
	private pending = new Map<
		string,
		{ shown: MemberEpisodeScore | null; write: number }
	>()
	private writes = 0
	/** Per key, the write on its way: the next one waits for it, so the server gets them in the member's order. */
	private queues = new Map<string, Promise<unknown>>()
	private listeners = new Set<() => void>()
	/** Changes with every change, for useSyncExternalStore. */
	version = 0

	private send: EpisodeScoreSend
	private onError: (message: string) => void

	constructor(
		send: EpisodeScoreSend,
		onError: (message: string) => void = () => {},
	) {
		this.send = send
		this.onError = onError
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}
	getVersion = () => this.version
	private changed() {
		this.version += 1
		for (const listener of this.listeners) listener()
	}

	/** Takes what the server read. Changes still on their way keep showing. */
	seed(scores: MemberEpisodeScore[] | undefined) {
		this.confirmed = new Map((scores ?? []).map((score) => [score.key, score]))
		this.changed()
	}

	get(key: string): MemberEpisodeScore | null {
		const pending = this.pending.get(key)
		return pending ? pending.shown : (this.confirmed.get(key) ?? null)
	}
	isSaving(key: string) {
		return this.pending.has(key)
	}
	/** Every part score, as shown. */
	parts(): MemberEpisodeScore[] {
		const keys = new Set([...this.confirmed.keys(), ...this.pending.keys()])
		return [...keys]
			.filter((key) => key.startsWith("p:"))
			.flatMap((key) => {
				const score = this.get(key)
				return score ? [score] : []
			})
	}

	/** Sets, changes or clears a score. Resolves false when the server refused it and the page went back. */
	async set(target: ScoreTarget, score: number | null): Promise<boolean> {
		const key = target.key ?? episodeScoreKey(target)
		const before = this.get(key)
		const write = ++this.writes
		const {
			key: _key,
			label,
			...rest
		} = target as ScoreTarget & Partial<MemberEpisodeScore>
		this.pending.set(key, {
			write,
			shown:
				score === null
					? null
					: ({
							...(before ?? {}),
							...rest,
							key,
							score,
							label: before?.label ?? label ?? null,
							updatedAt: before?.updatedAt ?? new Date().toISOString(),
						} as MemberEpisodeScore),
		})
		this.changed()
		const body = { ...requestOf(target, key), score }
		const waiting = this.queues.get(key)
		const sent = waiting
			? waiting.then(() =>
					// A newer change came while this one waited: that one is sent instead.
					this.pending.get(key)?.write === write
						? this.deliver(key, write, body)
						: true,
				)
			: this.deliver(key, write, body)
		const queued = sent.catch(() => {})
		this.queues.set(key, queued)
		void queued.then(() => {
			if (this.queues.get(key) === queued) this.queues.delete(key)
		})
		return sent
	}

	private async deliver(key: string, write: number, body: object) {
		try {
			const answer = await this.send(body)
			if (answer.score) this.confirmed.set(key, answer.score)
			else this.confirmed.delete(key)
			if (this.pending.get(key)?.write === write) this.pending.delete(key)
			this.changed()
			return true
		} catch (error) {
			if (error instanceof EpisodeScoreGoneError) {
				this.confirmed.delete(key)
				if (this.pending.get(key)?.write === write) this.pending.delete(key)
				this.onError(
					"That score isn't there anymore. It was removed on another page.",
				)
				this.changed()
				return false
			}
			if (this.pending.get(key)?.write === write) {
				this.pending.delete(key)
				this.onError("Your score wasn't saved. Try again.")
				this.changed()
			}
			return false
		}
	}
}
