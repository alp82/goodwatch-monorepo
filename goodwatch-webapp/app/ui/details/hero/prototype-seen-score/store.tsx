// PROTOTYPE - throwaway (seen-score). In-memory Seen / score / Want / Not interested for one title page, seeded once
// from the member's real data. Nothing here writes to the account.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useIsNotInterested, useIsOnWishlist, useUserScore, useWatchState } from "~/hooks/useUserDataAccessors"
import type { Score } from "~/server/scores.server"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"

export interface ProtoState {
	seen: boolean
	score: Score | null
	want: boolean
	hidden: boolean
}

export type ProtoEvent =
	| { kind: "seen-on"; at: number } // Seen was pressed on: ask for the score
	| { kind: "auto-seen"; at: number } // a score turned Seen on
	| { kind: "blocked"; at: number; message: string }
	| null

function useProtoStore(media: ScoredMedia) {
	const { mediaType } = media
	const tmdbId = media.details.tmdb_id
	const realScore = useUserScore(mediaType, tmdbId)?.score ?? null
	const realWatch = useWatchState(mediaType, tmdbId)
	const realWant = useIsOnWishlist(mediaType, tmdbId)
	const realHidden = useIsNotInterested(mediaType, tmdbId)
	const real: ProtoState = { seen: realWatch?.state === "seen" || (mediaType === "movie" && realScore != null), score: realScore, want: realWant, hidden: realHidden }

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

	const pressSeen = useCallback(() => {
		if (!state.seen) {
			set((s) => ({ ...s, seen: true, hidden: false }))
			setEvent({ kind: "seen-on", at: Date.now() })
			return
		}
		if (state.score != null) {
			setEvent({ kind: "blocked", at: Date.now(), message: "It counts as Seen because you scored it. Clear your score to change that." })
			return
		}
		set((s) => ({ ...s, seen: false }))
		setEvent(null)
	}, [state.seen, state.score, set])

	const rate = useCallback(
		(score: Score) => {
			const wasSeen = state.seen
			set((s) => ({ ...s, score, seen: true, hidden: false }))
			setEvent(wasSeen ? null : { kind: "auto-seen", at: Date.now() })
		},
		[state.seen, set],
	)

	return {
		state,
		event,
		clearEvent: () => setEvent(null),
		pressSeen,
		rate,
		clearScore: () => set((s) => ({ ...s, score: null })),
		toggleWant: () => set((s) => ({ ...s, want: !s.want, hidden: false })),
		toggleHide: () => set((s) => ({ ...s, hidden: !s.hidden, want: false })),
		reset: () => {
			touched.current = false
			setState(real)
			setEvent(null)
		},
		/** Rated or seen titles can't be hidden, as on the live page. */
		canHide: state.hidden || (!state.seen && state.score == null),
		media,
	}
}

export type ProtoStore = ReturnType<typeof useProtoStore>

const Ctx = createContext<ProtoStore | null>(null)

export function ProtoProvider({ media, children }: { media: ScoredMedia; children: React.ReactNode }) {
	const store = useProtoStore(media)
	return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useProto() {
	const store = useContext(Ctx)
	if (!store) throw new Error("useProto outside ProtoProvider")
	return useMemo(() => store, [store])
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
