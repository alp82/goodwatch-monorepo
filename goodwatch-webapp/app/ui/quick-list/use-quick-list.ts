// Binds Quick list (model.ts) to the person: the titles (the rating flow's source, paged as rows are answered, or a
// search of the whole catalog), the filters and order, the person's answers, the saves and Undo's saves (the rating
// flow's save functions, one write at a time per title), and the flow's totals, milestones and guest limit.
import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { SEARCH_MIN_CHARS } from "~/domain/discover-search"
import { NO_FILTERS, type ScoreFilters } from "~/domain/my-scores"
import { GUEST_RATING_LIMIT } from "~/domain/taste-rules"
import { fetchSmartTitles } from "~/routes/api.smart-titles"
import { useUserData } from "~/routes/api.user-data"
import type { Score } from "~/server/scores.server"
import { useProductAnalytics, useProductExposure } from "~/telemetry/useProductAnalytics"
import {
	INITIAL_FLOW,
	isLocked,
	justLanded,
	litMilestone,
	nextStep,
	ratingFlow,
	tally as tallyOf,
} from "~/ui/rating-flow/flow"
import { TitleWrites, answerPlan } from "~/ui/rating-flow/title-writes"
import type { ScoringMedia } from "~/ui/scoring/types"
import { requestSearch } from "~/ui/search/search-client"
import { accountAnsweredKeys, excludeIdsFor, storedAnswerIs } from "~/ui/taste/answered"
import { useTasteScoring } from "~/ui/taste/hooks/useTasteScoring"
import { useHydrated } from "~/utils/hydrated"
import useLocale from "~/utils/locale"
import {
	INITIAL_QUICK,
	LEAVE_MS,
	type Order,
	type QuickAnswer,
	type QuickTitle,
	ROWS,
	SOURCE_ORDER,
	answerOf,
	fillOf,
	fromScoring,
	fromSearchRow,
	heldAnswer,
	listOf,
	quickList,
	sameAnswer,
	scorable,
	staleRows,
	uniqueTitles,
} from "./model"
import { QUICK_WORDS } from "./words"

/** Titles asked for at a time once the first ones run low. */
const BATCH = 50
/** Ask for more when fewer than this many titles wait behind the rows. */
const SPARE = 10
/** At most this many titles in the list: past it, more come only from a search. */
const POOL_MAX = 1000
/** Batches in a row that bring nothing the filters let through before the list stops asking (the person can ask again). */
const MISSES_MAX = 3
/** How long typing rests before a search starts. */
const SEARCH_REST_MS = 400

/** The whole catalog for a query, a moment after typing stops. The site's search (the header's and Discover's). */
function useCatalogSearch(raw: string) {
	const q = raw.trim()
	const [settled, setSettled] = useState(q)
	useEffect(() => {
		const id = window.setTimeout(() => setSettled(q), SEARCH_REST_MS)
		return () => window.clearTimeout(id)
	}, [q])
	const { locale } = useLocale()
	const searching = q.length >= SEARCH_MIN_CHARS
	const on = settled.length >= SEARCH_MIN_CHARS
	const query = useQuery({
		queryKey: ["quick-list-search", settled, locale.language],
		queryFn: async ({ signal }) => {
			const batch = await requestSearch({
				body: { q: settled },
				language: locale.language,
				signal,
				onReading: () => {},
				unavailable: QUICK_WORDS.searchUnavailable,
			})
			const titles = uniqueTitles(batch.rows.flatMap((r) => fromSearchRow(r) ?? []))
			return { q: settled, titles }
		},
		enabled: on,
		staleTime: Number.POSITIVE_INFINITY,
		// One search per query: each costs money and has a per-visitor limit.
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		// The last answer stays while the next query runs, so the rows don't empty between letters.
		placeholderData: (previous) => previous,
	})
	return {
		/** The answer the rows show, and the query it answers; null without a query (the person's titles show). */
		answer: searching && on ? (query.data ?? null) : null,
		pending: searching && (q !== settled || query.isFetching),
		error: searching && query.error ? (query.error as Error).message : null,
	}
}

export function useQuickList({ titles, member }: { titles: ScoringMedia[]; member: boolean }) {
	const track = useProductAnalytics({ source: "quick_list" })
	useProductExposure("taste quiz started", "quick", { source: "quick_list" })
	const scoring = useTasteScoring({ isAuthenticated: member })
	const { data: userData } = useUserData()
	const latestUserData = useRef(userData)
	latestUserData.current = userData
	const hydrated = useHydrated()
	const { locale } = useLocale()
	// A guest's answers live in this browser: the rows wait for them, so no answered title shows for a moment.
	const ready = member || hydrated

	// ---------------------------------------------------------------- totals, milestones, the guest limit

	const known = member ? userData !== undefined : hydrated
	const scores = userData?.scores
	const totals = useMemo(() => tallyOf(Object.values(scores ?? {}).map((s) => s?.score)), [scores])
	const [flow, send] = useReducer(ratingFlow, INITIAL_FLOW)
	useEffect(() => {
		if (known) send({ type: "tally", tally: totals, member })
	}, [known, totals, member])
	const milestoneAt = flow.milestone?.rated
	const milestoneKind = flow.milestone?.kind
	useEffect(() => {
		if (milestoneAt == null) return
		track("taste quiz completed", { rating_count: milestoneAt, milestone: milestoneKind })
	}, [milestoneAt, milestoneKind, track])

	// ---------------------------------------------------------------- the titles

	const [filters, setFilters] = useState<ScoreFilters>(NO_FILTERS)
	const [order, setOrder] = useState<Order>(SOURCE_ORDER)
	const search = useCatalogSearch(filters.q)
	const [pool, setPool] = useState(() => uniqueTitles(titles.map(fromScoring)))
	const [paging, setPaging] = useState({ fetching: false, exhausted: false, failed: false, misses: 0 })

	// Every title met (the list and searches), for the saves and the undo bar.
	const met = useRef(new Map<string, QuickTitle>())
	for (const t of pool) if (!met.current.has(t.key)) met.current.set(t.key, t)
	for (const t of search.answer?.titles ?? []) if (!met.current.has(t.key)) met.current.set(t.key, t)

	const answeredKeys = useMemo(() => accountAnsweredKeys(userData), [userData])
	const held = useCallback((key: string) => heldAnswer(latestUserData.current, key), [])

	const inSearch = search.answer != null
	const source = search.answer?.titles ?? pool
	const list = useMemo(() => listOf(source, filters, order), [source, filters, order])
	const sheetKey = JSON.stringify({ ...filters, q: "" })
	// A new list starts its rows over: another search answer, other filters, another order.
	const listId = `${inSearch ? `search:${search.answer?.q}` : "titles"}|${sheetKey}|${order.by}:${order.dir}`

	const [state, dispatch] = useReducer(quickList, INITIAL_QUICK)
	const stateNow = useRef(state)
	stateNow.current = state
	const fill = useMemo(() => fillOf(list, state, answeredKeys, inSearch), [list, state, answeredKeys, inSearch])
	const fillNow = useRef(fill)
	fillNow.current = fill

	// Deliberate dependencies: a new list (its id) or the first moment the rows can show
	useEffect(() => {
		if (!ready) return
		dispatch({ type: "rows", fill: fillOf(list, { ...stateNow.current, shown: [] }, answeredKeys, inSearch) })
	}, [listId, ready])
	useEffect(() => {
		if (ready && state.shown.length < ROWS && fill.length) dispatch({ type: "fill", fill })
	}, [ready, state.shown.length, fill])
	// Rows answered somewhere else (a guest's browser read late, another tab) go.
	const stale = useMemo(() => staleRows(state, answeredKeys, inSearch), [state, answeredKeys, inSearch])
	useEffect(() => {
		if (stale.length) dispatch({ type: "settle", keys: stale, fill: fillNow.current })
	}, [stale])

	// More of the person's titles when the ones behind the rows run low. One request at a time, a bounded list, and a
	// stop after a few batches the filters let nothing through from.
	// Deliberate dependencies: new filters give the list another try
	useEffect(() => setPaging((p) => (p.misses ? { ...p, misses: 0 } : p)), [sheetKey])
	const answeredInOrder = useRef<string[]>([])
	answeredInOrder.current = [...scoring.interactions]
		.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
		.map((i) => `${i.media_type}-${i.tmdb_id}`)
	const wantsMore =
		ready &&
		!inSearch &&
		fill.length < SPARE &&
		!paging.fetching &&
		!paging.exhausted &&
		!paging.failed &&
		paging.misses < MISSES_MAX &&
		pool.length < POOL_MAX
	useEffect(() => {
		if (!wantsMore) return
		setPaging((p) => ({ ...p, fetching: true }))
		const have = new Set(pool.map((t) => t.key as string))
		fetchSmartTitles({
			count: BATCH,
			language: locale.language,
			excludeIds: excludeIdsFor(answeredInOrder.current, [...have]),
		}).then(
			(more) => {
				const added = uniqueTitles(more.map(fromScoring)).filter((t) => !have.has(t.key))
				const passing = listOf(added, filters, SOURCE_ORDER).filter((t) => !answeredKeys.has(t.key)).length
				setPool((p) => uniqueTitles([...p, ...added]))
				setPaging((p) => ({
					fetching: false,
					failed: false,
					exhausted: more.length === 0,
					misses: passing ? 0 : p.misses + 1,
				}))
			},
			() => setPaging((p) => ({ ...p, fetching: false, failed: true })),
		)
	}, [wantsMore])
	const lookFurther = useCallback(() => setPaging((p) => ({ ...p, failed: false, misses: 0 })), [])

	// ---------------------------------------------------------------- answers and Undo

	const [, redraw] = useReducer((n: number) => n + 1, 0)
	const writes = useRef<TitleWrites>()
	if (!writes.current) writes.current = new TitleWrites(redraw)
	const titleWrites = writes.current
	const stepId = useRef(0)
	const timers = useRef<number[]>([])
	useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])
	const [error, setError] = useState<string | null>(null)

	const { saveScore, saveSkip, saveWantToSee, saveNotInterested, clearAnswer } = scoring
	/** Takes a title from `from` to `to` through the rating flow's saves; null when a write for it is on its way. */
	const write = useCallback(
		(t: QuickTitle, from: QuickAnswer | null, to: QuickAnswer | null) =>
			titleWrites.run(t.key, async () => {
				if (!to) {
					if (from) await clearAnswer(t.media, from.type)
					return
				}
				const plan = answerPlan({
					before: from,
					given: to,
					member,
					stored: storedAnswerIs(latestUserData.current, t.key, to.type, to.type === "score" ? to.score : undefined),
				})
				if (plan === "nothing") return
				if (plan === "clear-then-save" && from) await clearAnswer(t.media, from.type)
				if (to.type === "score") await saveScore(t.media, to.score as Score)
				else if (to.type === "skip") await saveSkip(t.media)
				else if (to.type === "plan") await saveWantToSee(t.media)
				else await saveNotInterested(t.media)
			}),
		[titleWrites, member, clearAnswer, saveScore, saveSkip, saveWantToSee, saveNotInterested],
	)

	/** Gives `to` to the rows with `keys` (null: takes a score back). Rows with a write on its way are left as they are. */
	const answer = useCallback(
		(keys: readonly string[], to: QuickAnswer | null) => {
			const s = stateNow.current
			let ks = keys.filter((k) => met.current.has(k) && !titleWrites.busy(k))
			// A guest's scores stop at the limit; a title scored already is a change.
			if (to?.type === "score")
				ks = scorable(ks, (k) => answerOf(s, held, k)?.type === "score", totals.rated, GUEST_RATING_LIMIT, member)
			const items = ks
				.map((key) => ({ key, before: answerOf(s, held, key), after: to }))
				.filter((i) => !sameAnswer(i.before, i.after))
			if (!items.length) return
			setError(null)
			const id = ++stepId.current
			dispatch({ type: "answer", id, items })
			// The rows the last answer kept slide out, then the rows close up and fill.
			const given = new Set(items.map((i) => i.key))
			const going = to ? s.latest.filter((k) => !given.has(k) && !s.leaving.includes(k)) : []
			if (going.length)
				timers.current.push(
					window.setTimeout(() => dispatch({ type: "settle", keys: going, fill: fillNow.current, left: true }), LEAVE_MS),
				)
			for (const i of items) {
				const t = met.current.get(i.key)
				if (!t) continue
				write(t, i.before, i.after)?.catch(() => {
					dispatch({ type: "failed", step: id, key: i.key })
					setError(QUICK_WORDS.saveFailed(t.title))
				})
			}
		},
		[titleWrites, held, totals.rated, member, write],
	)

	const last = state.steps[0] ?? null
	const undoBusy = !!last?.items.some((i) => titleWrites.busy(i.key))
	/** Takes the latest change back: the answers return to what they were, saved, and the rows to their places. */
	const undo = useCallback(() => {
		const step = stateNow.current.steps[0]
		if (!step || step.items.some((i) => titleWrites.busy(i.key))) return
		setError(null)
		dispatch({ type: "undo" })
		for (const i of step.items) {
			const t = met.current.get(i.key)
			if (!t) continue
			write(t, i.after, i.before)?.catch(() => {
				dispatch({ type: "forget", key: i.key })
				setError(QUICK_WORDS.undoFailed(t.title))
			})
		}
	}, [titleWrites, write])

	const rows = useMemo(() => state.shown.flatMap((k) => met.current.get(k) ?? []), [state.shown])
	const answers = useMemo(() => {
		const out: Record<string, QuickAnswer | null> = {}
		for (const k of state.shown) out[k] = answerOf(state, held, k)
		return out
		// Deliberate dependencies: the person's marks change with userData
	}, [state, held, userData])

	return {
		member,
		/** The rows can show: a guest's answers are read. */
		ready,
		tally: flow.tally,
		next: flow.tally ? nextStep(flow.tally, flow.lastMilestoneAt, member) : null,
		lit: litMilestone(flow) ?? justLanded(flow),
		/** A guest at the limit: new scores wait for sign-up. Changing a score and the marks still go through. */
		locked: isLocked(flow.tally, member),
		filters,
		setFilters,
		order,
		setOrder,
		/** The titles the filter sheet offers its options from. */
		sheetTitles: inSearch ? source : pool.filter((t) => !answeredKeys.has(t.key)),
		inSearch,
		searchPending: search.pending,
		searchError: search.error,
		rows,
		answers,
		leaving: state.leaving,
		latest: state.latest,
		back: state.back,
		busy: (key: string) => titleWrites.busy(key),
		answer,
		undo,
		/** The change Undo takes back next, with the title it names. */
		last: last
			? {
					label:
						last.items.length === 1
							? (met.current.get(last.items[0].key)?.title ?? "")
							: QUICK_WORDS.titles(last.items.length),
					/** Null: a score taken back. */
					answer: last.items[0]?.after ?? null,
					busy: undoBusy,
				}
			: null,
		error,
		/** Asking for more of the person's titles: on its way, failed, or stopped for now (filters let nothing through). */
		loadingMore: paging.fetching,
		moreFailed: paging.failed,
		moreStopped: !paging.exhausted && paging.misses >= MISSES_MAX && pool.length < POOL_MAX,
		lookFurther,
	}
}

export type QuickListModel = ReturnType<typeof useQuickList>
