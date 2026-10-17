// PROTOTYPE - throwaway (seen-score). In-memory watch state / score / Want / Not interested for one title page,
// seeded once from the member's real data. Nothing here writes to the account.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useIsNotInterested, useIsOnWishlist, useUserScore, useWatchState } from "~/hooks/useUserDataAccessors"
import type { Score } from "~/server/scores.server"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"

/** The tracking machine's states. A movie only uses not_started and seen. */
export type Watch = "not_started" | "watching" | "on_hold" | "dropped" | "seen"

export interface ProtoState {
	watch: Watch
	/** Shows: regular episodes watched in this pass. */
	episodes: number
	score: Score | null
	want: boolean
	hidden: boolean
}

export type ProtoEvent =
	| { kind: "seen-on"; at: number } // Seen was pressed on: ask for the score
	| { kind: "auto-seen"; at: number; from: Watch } // a score set the state
	| { kind: "cleared"; at: number; undo: ProtoState } // going back to not seen took the score away
	| { kind: "blocked"; at: number; message: string }
	| null

export type ProtoMedia = ScoredMedia & { details: { number_of_episodes?: number; in_production?: boolean } }

function useProtoStore(media: ProtoMedia) {
	const { mediaType } = media
	const tmdbId = media.details.tmdb_id
	const total = media.details.number_of_episodes ?? 0
	const realScore = useUserScore(mediaType, tmdbId)?.score ?? null
	const realWatch = useWatchState(mediaType, tmdbId)
	const realWant = useIsOnWishlist(mediaType, tmdbId)
	const realHidden = useIsNotInterested(mediaType, tmdbId)
	const real: ProtoState = {
		watch: realWatch?.state ?? (mediaType === "movie" && realScore != null ? "seen" : "not_started"),
		episodes: realWatch?.episodesWatched ?? 0,
		score: realScore,
		want: realWant,
		hidden: realHidden,
	}

	const [state, setState] = useState<ProtoState>(real)
	const [event, setEvent] = useState<ProtoEvent>(null)
	const touched = useRef(false)
	// The member's data loads after the page: take it until the first press.
	const realKey = JSON.stringify(real)
	useEffect(() => {
		if (!touched.current) setState(JSON.parse(realKey))
	}, [realKey])

	const set = useCallback((next: (s: ProtoState) => ProtoState) => {
		touched.current = true
		setState(next)
	}, [])

	/** Episodes that go with a state: all for Seen, none for Not started, a few to start Watching. */
	// The episode count is the episode list's (stubbed here). A status never invents progress: Seen all ticks every
	// episode, and leaving Seen all goes back to the count from before it. Other moves keep the count.
	const beforeSeenAll = useRef(0)
	const episodesFor = (watch: Watch, from: Watch, now: number) => {
		if (watch === "seen") {
			if (from !== "seen") beforeSeenAll.current = now
			return total
		}
		if (watch === "not_started") return 0
		return from === "seen" ? beforeSeenAll.current : now
	}

	const setWatch = useCallback(
		(watch: Watch) => {
			if (watch === state.watch) return
			const before = state
			set((s) => ({
				...s,
				watch,
				episodes: episodesFor(watch, s.watch, s.episodes),
				// The score stays whatever the state: only Clear score removes it.
				hidden: watch === "not_started" ? s.hidden : false,
			}))
			if (watch === "seen" && before.score == null) setEvent({ kind: "seen-on", at: Date.now() })
			else setEvent(null)
		},
		[state, set],
	)

	/** Taking back Seen on a scored movie asks first: the score goes with it. */
	const [confirming, setConfirming] = useState(false)

	/** The Seen toggle. */
	const pressSeen = useCallback(() => {
		if (state.watch === "not_started") return setWatch("seen")
		if (state.score != null && mediaType === "movie") return setConfirming(true)
		setWatch("not_started")
	}, [state.watch, state.score, mediaType, setWatch])

	const confirmUnsee = useCallback(() => {
		set((s) => ({ ...s, watch: "not_started", episodes: 0, score: null }))
		setEvent(null)
		setConfirming(false)
	}, [set])

	// A score marks a movie as Seen. A show's status stays: a score says nothing about how far you got.
	const rate = useCallback(
		(score: Score) => {
			const auto = mediaType === "movie" && state.watch === "not_started"
			set((s) => ({ ...s, score, watch: auto ? "seen" : s.watch, hidden: false }))
			setEvent(auto ? { kind: "auto-seen", at: Date.now(), from: "not_started" } : null)
		},
		[state.watch, set, mediaType],
	)

	return {
		state,
		/** Seen in the movie sense: anything but Not started counts as having watched some of it. */
		seen: state.watch !== "not_started",
		total,
		running: Boolean(media.details.in_production),
		event,
		clearEvent: () => setEvent(null),
		setWatch,
		pressSeen,
		confirming,
		confirmUnsee,
		cancelUnsee: () => setConfirming(false),
		rate,
		clearScore: () => set((s) => ({ ...s, score: null })),
		undo: (to: ProtoState) => {
			set(() => to)
			setEvent(null)
		},
		toggleWant: () => set((s) => ({ ...s, want: !s.want, hidden: false })),
		toggleHide: () => set((s) => ({ ...s, hidden: !s.hidden, want: false })),
		reset: () => {
			touched.current = false
			setState(real)
			setEvent(null)
		},
		/** Rated or started titles can't be hidden, as on the live page. */
		canHide: state.hidden || (state.watch === "not_started" && state.score == null),
		media,
	}
}

export type ProtoStore = ReturnType<typeof useProtoStore>

const Ctx = createContext<ProtoStore | null>(null)

export function ProtoProvider({ media, children }: { media: ProtoMedia; children: React.ReactNode }) {
	const store = useProtoStore(media)
	return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useProto() {
	const store = useContext(Ctx)
	if (!store) throw new Error("useProto outside ProtoProvider")
	return store
}

/** True for a moment after `at` changes: drives a short highlight. */
export function useFlash(at: number | undefined, ms = 1800) {
	const [on, setOn] = useState(false)
	useEffect(() => {
		if (!at) return
		setOn(true)
		const t = setTimeout(() => setOn(false), ms)
		return () => clearTimeout(t)
	}, [at, ms])
	return on
}
