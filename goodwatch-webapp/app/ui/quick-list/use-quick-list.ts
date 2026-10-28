// Binds Quick list (model.ts) to the person: the titles (the rating flow's source, paged as rows are answered, or a
// search of the whole catalog), the filters and order, the person's answers, the saves and Undo's saves (the rating
// flow's save functions, one write at a time per title), and the flow's totals, milestones and guest limit.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { SEARCH_MIN_CHARS } from "~/domain/discover-search"
import { NO_FILTERS, type ScoreFilters } from "~/domain/my-scores"
import { GUEST_RATING_LIMIT } from "~/domain/taste-rules"
import { fetchSmartTitles } from "~/routes/api.smart-titles"
import { queryKeyUserData, useUserData } from "~/routes/api.user-data"
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
import { accountAnsweredKeys, storedAnswerIs } from "~/ui/taste/answered"
import { type SaveOptions, useTasteScoring } from "~/ui/taste/hooks/useTasteScoring"
import { useHydrated } from "~/utils/hydrated"
import useLocale from "~/utils/locale"
import {
	BULK_AT_ONCE,
	INITIAL_PAGING,
	INITIAL_QUICK,
	LEAVE_MS,
	MISSES_MAX,
	type Change,
	type Order,
	type QuickAnswer,
	type QuickTitle,
	SOURCE_ORDER,
	afterBatch,
	answerOf,
	atEnd,
	bounded,
	fillOf,
	fromScoring,
	fromSearchRow,
	heldAnswer,
	listOf,
	lookFurther as lookFurtherFrom,
	mayAsk,
	moreRequest,
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
	const [paging, setPaging] = useState(INITIAL_PAGING)

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
		dispatch({ type: "rows", fill: fillOf(list, { ...stateNow.current, shown: [], gone: [] }, answeredKeys, inSearch) })
	}, [listId, ready])
	useEffect(() => {
		if (ready && state.shown.length < state.cap && fill.length) dispatch({ type: "fill", fill })
	}, [ready, state.shown.length, state.cap, fill])
	/** Scrolling reached the end of the rows: 20 more, from the titles behind them (more are fetched as they run low). */
	const showMore = useCallback(() => dispatch({ type: "more", fill: fillNow.current }), [])
	// Rows answered somewhere else (a guest's browser read late, another tab) go.
	const stale = useMemo(() => staleRows(state, answeredKeys, inSearch), [state, answeredKeys, inSearch])
	useEffect(() => {
		if (stale.length) dispatch({ type: "settle", keys: stale, fill: fillNow.current })
	}, [stale])

	// More of the person's titles when the ones behind the rows run low. One request at a time, a bounded list, and a
	// stop after a few batches the filters let nothing through from.
	// Deliberate dependencies: new filters give the list another try
	useEffect(() => setPaging((p) => (p.misses ? { ...p, misses: 0 } : p)), [sheetKey])
	const answeredInOrder = useMemo(
		() =>
			[...scoring.interactions]
				.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
				.map((i) => `${i.media_type}-${i.tmdb_id}`),
		[scoring.interactions],
	)
	// The next request names every title known, so it never brings back one the list has (moreRequest).
	const request = useMemo(() => moreRequest(answeredInOrder, pool.map((t) => t.key)), [answeredInOrder, pool])
	const wantsMore =
		ready && !inSearch && fill.length < SPARE && pool.length < POOL_MAX && mayAsk(paging, request.exclusion)
	const requestNow = useRef(request)
	requestNow.current = request
	useEffect(() => {
		if (!wantsMore) return
		const { excludeIds, exclusion } = requestNow.current
		setPaging((p) => ({ ...p, fetching: true }))
		const have = new Set(pool.map((t) => t.key as string))
		fetchSmartTitles({ count: BATCH, language: locale.language, excludeIds }).then(
			(more) => {
				const added = uniqueTitles(more.map(fromScoring)).filter((t) => !have.has(t.key))
				const passing = listOf(added, filters, SOURCE_ORDER).filter((t) => !answeredKeys.has(t.key)).length
				setPool((p) => uniqueTitles([...p, ...added]))
				setPaging((p) => afterBatch(p, exclusion, added.length, passing))
			},
			() => setPaging((p) => ({ ...p, fetching: false, failed: true })),
		)
	}, [wantsMore])
	const lookFurther = useCallback(() => setPaging((p) => lookFurtherFrom(p, requestNow.current.exclusion)), [])

	// ---------------------------------------------------------------- answers and Undo

	const [, redraw] = useReducer((n: number) => n + 1, 0)
	const writes = useRef<TitleWrites>()
	if (!writes.current) writes.current = new TitleWrites(redraw)
	const titleWrites = writes.current
	const stepId = useRef(0)
	const timers = useRef<number[]>([])
	useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])
	const [error, setError] = useState<string | null>(null)
	const queryClient = useQueryClient()
	// A bulk answer's saves (and its undo's) wait their turn here, a few at a time.
	const gate = useRef<ReturnType<typeof bounded>>()
	if (!gate.current) gate.current = bounded(BULK_AT_ONCE)
	const bulkGate = gate.current

	const { saveScore, saveSkip, saveWantToSee, saveNotInterested, clearAnswer } = scoring
	/**
	 * Takes a title from `from` to `to` through the rating flow's saves; null when a write for it is on its way. In a
	 * bulk change (`bulk`) the save waits its turn, and doesn't read the member data again: the caller does once.
	 */
	const write = useCallback(
		(t: QuickTitle, from: QuickAnswer | null, to: QuickAnswer | null, bulk = false) => {
			const options: SaveOptions | undefined = bulk ? { deferSync: true } : undefined
			const save = async () => {
				if (!to) {
					if (from) await clearAnswer(t.media, from.type, options)
					return
				}
				const plan = answerPlan({
					before: from,
					given: to,
					member,
					stored: storedAnswerIs(latestUserData.current, t.key, to.type, to.type === "score" ? to.score : undefined),
				})
				if (plan === "nothing") return
				if (plan === "clear-then-save" && from) await clearAnswer(t.media, from.type, options)
				if (to.type === "score") await saveScore(t.media, to.score as Score, options)
				else if (to.type === "skip") await saveSkip(t.media, options)
				else if (to.type === "plan") await saveWantToSee(t.media, options)
				else await saveNotInterested(t.media, options)
			}
			// The title is busy from the press on, also while its save waits its turn.
			return titleWrites.run(t.key, bulk ? () => bulkGate(save) : save)
		},
		[titleWrites, bulkGate, member, clearAnswer, saveScore, saveSkip, saveWantToSee, saveNotInterested],
	)

	/**
	 * Runs the writes of one change: one by itself; many a few at a time, the member data read once after all of them
	 * settled. `failed` runs for each write that wasn't saved.
	 */
	const runWrites = useCallback(
		(items: readonly Change[], from: (i: Change) => QuickAnswer | null, to: (i: Change) => QuickAnswer | null, failed: (i: Change, t: QuickTitle) => void) => {
			const bulk = items.length > 1
			const running: Promise<unknown>[] = []
			for (const i of items) {
				const t = met.current.get(i.key)
				if (!t) continue
				const w = write(t, from(i), to(i), bulk)
				if (!w) continue
				running.push(w.catch(() => failed(i, t)))
			}
			if (bulk && member && running.length)
				void Promise.allSettled(running).then(() => queryClient.invalidateQueries({ queryKey: queryKeyUserData }))
		},
		[write, member, queryClient],
	)

	/**
	 * Gives `to` to the rows with `keys` (null: takes a score back). Rows with a write on its way are left as they are:
	 * `busy` names them, `written` the rows answered.
	 */
	const answer = useCallback(
		(keys: readonly string[], to: QuickAnswer | null): { written: string[]; busy: string[] } => {
			const s = stateNow.current
			const known = keys.filter((k) => met.current.has(k))
			const busy = known.filter((k) => titleWrites.busy(k))
			let ks = known.filter((k) => !titleWrites.busy(k))
			// A guest's scores stop at the limit; a title scored already is a change.
			if (to?.type === "score")
				ks = scorable(ks, (k) => answerOf(s, held, k)?.type === "score", totals.rated, GUEST_RATING_LIMIT, member)
			const items = ks
				.map((key) => ({ key, before: answerOf(s, held, key), after: to }))
				.filter((i) => !sameAnswer(i.before, i.after))
			if (!items.length) return { written: [], busy }
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
			runWrites(
				items,
				(i) => i.before,
				(i) => i.after,
				(i, t) => {
					dispatch({ type: "failed", step: id, key: i.key })
					setError(QUICK_WORDS.saveFailed(t.title))
				},
			)
			return { written: items.map((i) => i.key), busy }
		},
		[titleWrites, held, totals.rated, member, runWrites],
	)

	const last = state.steps[0] ?? null
	const undoBusy = !!last?.items.some((i) => titleWrites.busy(i.key))
	/** Takes the latest change back: the answers return to what they were, saved, and the rows to their places. */
	const undo = useCallback(() => {
		const step = stateNow.current.steps[0]
		if (!step || step.items.some((i) => titleWrites.busy(i.key))) return
		setError(null)
		dispatch({ type: "undo" })
		runWrites(
			step.items,
			(i) => i.after,
			(i) => i.before,
			(i, t) => {
				dispatch({ type: "forget", key: i.key })
				setError(QUICK_WORDS.undoFailed(t.title))
			},
		)
	}, [titleWrites, runWrites])

	const rows = useMemo(() => state.shown.flatMap((k) => met.current.get(k) ?? []), [state.shown])
	const answers = useMemo(() => {
		const out: Record<string, QuickAnswer | null> = {}
		for (const k of state.shown) out[k] = answerOf(state, held, k)
		return out
		// Deliberate dependencies: the person's marks change with userData
	}, [state, held, userData])

	return {
		member,
		/** The rows can show: a guest's answers are read, and the first rows are drawn. */
		ready: ready && state.list > 0,
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
		moreStopped: !atEnd(paging, request.exclusion) && paging.misses >= MISSES_MAX && pool.length < POOL_MAX,
		lookFurther,
		showMore,
		/** Rows fill their cap, so scrolling to the end may show more. */
		full: state.shown.length >= state.cap,
	}
}

export type QuickListModel = ReturnType<typeof useQuickList>
