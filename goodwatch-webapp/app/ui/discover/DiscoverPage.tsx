// Discover, browsing and searching on one page: the static title, the controls in Easy or Advanced (DiscoverControls,
// with the panel or phone sheet the filter bar opens), and the grid of title cards, loaded 40 at a time as the person scrolls. The grid
// is never replaced between browsing and searching: titles in both lists glide to their new places.
//
// Searching, the reading line shows how the search read the query, Relevance joins the sorts and is
// chosen, and the counts and recoveries cover the search's frozen candidate set. Clearing the search returns to the sort used
// before it.
//
// The grid's pages carry the counts every choice needs. The open sub-tab's extra counts (`counts=`, useDiscoverBar)
// come from one more request for the first page while that sub-tab is on screen, so opening the panel never reloads
// the grid. The sub-tabs' content loads on demand (sub-tabs/lazy.ts).
//
// Best match (the sort by taste match) and the Taste match filter need taste; the bar hears from the results whether
// the viewer has it. For you sits in You's Order block.
//
// Sides of you: while For you is on (with any sort; Best match counts as on), a member with sides sees a row per group
// of their taste instead of the grid (SideRows). A row's "More like this" narrows the grid to that group (`side` in
// the URL) until "All of your taste", For you turned off, or a search.
import { useLocation, useNavigation, useSearchParams } from "@remix-run/react"
import { MotionConfig } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { useInView } from "react-intersection-observer"
import { withSides } from "~/domain/discover-layout"
import {
	DISCOVER_DEFAULTS,
	type SearchScope,
	searchEligibility,
	searchText,
	withSearchFilters,
} from "~/domain/discover-search"
import {
	type SortKey,
	secondaryFilterCount,
	stateAsApplied,
} from "~/domain/filter-state"
import { groupsByTaste } from "~/domain/side-rows"
import { useDiscoverResults } from "~/routes/api.discover_.results"
import type { DiscoverResults } from "~/server/discover-results.server"
import { discoveryProperties } from "~/telemetry/product-events"
import { useProductExposure } from "~/telemetry/useProductAnalytics"
import {
	DiscoverControls,
	type DiscoverPageContext,
} from "~/ui/discover-bar/DiscoverControls"
import { GridDim } from "~/ui/discover-bar/DiscoverPanel"
import {
	preloadSubTabs,
	useSubTabContent,
} from "~/ui/discover-bar/sub-tabs/lazy"
import { useDescribedSearch } from "~/ui/discover-bar/useDescribedSearch"
import { useDesktop, useDiscoverBar } from "~/ui/discover-bar/useDiscoverBar"
import { NextPageLink } from "~/ui/explore/GridUtils"
import { BestMatchSignUp } from "~/ui/filter-bar/SignUpPanel"
import { discoverSorts, sortShown, tasteStateOf } from "~/ui/filter-bar/labels"
import type { ForYouControl } from "~/ui/filter-bar/types"
import { useFilterState } from "~/ui/filter-bar/useFilterState"
import { SearchPeople } from "~/ui/search/SearchPeople"
import { Spinner } from "~/ui/wait/Spinner"
import type { TitleKey } from "~/utils/title-key"
import { DiscoverGrid } from "./DiscoverGrid"
import { HiddenTitles } from "./HiddenTitles"
import { SideBanner, SideRows, sideRowsOf } from "./SideRows"
import {
	type InitialBrowse,
	browseKey,
	useDiscoverBrowse,
	useForYou,
	useGuestBody,
} from "./useDiscoverBrowse"
import { type DiscoverSearchResult, useDiscoverSearch } from "./useDiscoverSearch"
// PROTOTYPE - throwaway (discover search preferences): see prototype-preferences/README.md.
import { DetailsStandIn } from "./prototype-preferences/DetailsStandIn"
import { Inspector } from "./prototype-preferences/Inspector"
import { PrototypeGrid, prototypeTierLine } from "./prototype-preferences/PrototypeGrid"
import {
	itemsOf,
	readText,
	setOff,
	useInterpretedFilters,
} from "./prototype-preferences/interpretation"
import { MatchesRead, SCOPE_COLOR, readColor } from "./prototype-preferences/read-parts"
import { ReadStrip } from "./prototype-preferences/ReadVariants"
import { titleKey } from "~/utils/title-key"
import { usePreferencePrototype } from "./prototype-preferences/usePreferencePrototype"

/**
 * Everything, on any service, seen or not: Ready to watch turns on My services and Not seen yet in one tap. The same
 * as the server's discoverFilterDefaults.
 */

/** How long the per-card movement marks show after For you flips. */
const MARKS_MS = 2600

export interface DiscoverPageProps {
	initial: InitialBrowse | null
	member: boolean
	/** The member has saved services (Ready to watch reads them from the settings itself). */
	hasServices: boolean
	/** The member's saved For you setting; true for guests. */
	savedForYou: boolean
	/** Where a search's On my services looks: the viewer's country and saved services (guests choose theirs). */
	searchScope: SearchScope
	/** PROTOTYPE - throwaway: set only by the isolated prototype server's loader. */
	prototypePreferences?: boolean
}

// A For you flip in progress: where each title was before, and when the new order landed.
interface Flip {
	/** The query before the flip, and the one that answers it. */
	from: string
	key: string
	/** For you was turned on. */
	on: boolean
	before: Map<TitleKey, number>
	pages: number
	at: number | null
}

const ids = (value: string | null | undefined) =>
	(value ?? "")
		.split(",")
		.map(Number)
		.filter((id) => Number.isSafeInteger(id) && id > 0)

export function DiscoverPage({
	initial,
	member,
	savedForYou,
	searchScope,
	prototypePreferences,
}: DiscoverPageProps) {
	const [params, setParams] = useSearchParams()
	// PROTOTYPE - throwaway: the V7 preview answers the search; never in production. `qTyped` is the query as typed
	// (the field shows it); `q` is what the search reads: without the phrases switched off on the read line (`off`).
	const protoOn =
		prototypePreferences === true && process.env.NODE_ENV !== "production"
	const qTyped = searchText(params.get("q"))
	const off = protoOn ? params.getAll("off") : []
	const q = protoOn ? readText(qTyped, off) : qTyped
	const proto = usePreferencePrototype(protoOn, qTyped, q)
	const searching = q !== null
	const allTitles = params.get("allTitles") === "1"
	const side = params.get("side")

	const guest = useGuestBody(member)
	const filters = useFilterState({
		defaults: DISCOVER_DEFAULTS,
		member,
		searching,
	})
	// PROTOTYPE - throwaway: what the whole query read, and the filter state the controls show (manual + read items).
	const readItems = useMemo(
		() => (protoOn ? itemsOf(proto.full, off, filters.defaults) : []),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[protoOn, proto.full, off.join("\u0000"), filters.defaults],
	)
	const shownFilters = useInterpretedFilters(filters, readItems, protoOn && qTyped !== null)
	const forYou = useForYou({ member, saved: savedForYou })
	const bar = useDiscoverBar(filters.state)
	const desktop = useDesktop()
	const { renderSubTab, renderFind } = useSubTabContent(bar.panel.open !== null)

	// The search: the query and the ranking's eligibility; everything else filters its ranked list in memory.
	const scope = useMemo<SearchScope>(
		() => ({
			country: guest?.country || searchScope.country,
			services: member ? searchScope.services : ids(guest?.services),
		}),
		[member, guest?.country, guest?.services, searchScope],
	)
	const eligibility = useMemo(
		() => searchEligibility(filters.state, scope),
		[filters.state, scope],
	)
	const realSearch = useDiscoverSearch({
		q,
		filters: eligibility,
		allTitles,
		enabled: guest !== undefined && !protoOn,
	})
	// PROTOTYPE - throwaway: the same shape as the real search, from V7's order for the chosen sort.
	const protoCurrent = useMemo<DiscoverSearchResult | null>(
		() =>
			proto.ranked && q
				? { q, ranked: proto.ranked, reading: [], people: [], creditScope: null, errors: [] }
				: null,
		[proto.ranked, q],
	)
	const search = protoOn
		? {
				...realSearch,
				current: protoCurrent,
				last: protoCurrent,
				partial: false,
				pendingTitleLookup: false,
				pendingRanking: false,
				reading: null,
				loading: proto.loading,
				error: proto.error,
				retry: proto.retry,
			}
		: realSearch
	// PROTOTYPE - throwaway: Top rated over V7 is its tiered order as sent, so the results endpoint keeps the order.
	// A catalogue answer (every word became a filter, up to tens of thousands of titles) sends no ranked list: its hard
	// parameters join the results request, not the URL, and Discover's own list and sorts answer it.
	const protoCatalogue = protoOn && searching && proto.catalogueParams !== null
	const protoTop = protoOn && searching && !protoCatalogue && filters.sort === "top"
	const keepOrder = (query: string) => {
		if (!protoTop && !protoCatalogue) return query
		const next = new URLSearchParams(query)
		if (protoCatalogue)
			for (const [key, value] of new URLSearchParams(proto.catalogueParams ?? "")) next.set(key, value)
		else next.set("sort", "relevance")
		return next.toString()
	}

	const browseQuery = withSides(
		keepOrder(filters.query),
		side,
		params.get("layout") !== "grid",
	)
	// PROTOTYPE - throwaway: For you stays off for prototype searches, so V7's order and Top rated tiers arrive as sent.
	const forYouSent = protoOn && searching ? false : forYou.on
	const browse = useDiscoverBrowse({
		query: browseQuery,
		forYou: forYouSent,
		member,
		guest,
		initial,
		ranked: searching
			? protoCatalogue
				? undefined
				: (search.current?.ranked ?? null)
			: undefined,
		searchSet: searching ? search.current?.searchSet : undefined,
		provisional: searching && search.partial,
	})

	// Entering a search chooses Relevance; clearing it returns to the sort used before.
	const browseSort = useRef<string | null>(null)
	const navigation = useNavigation()
	const describe = useDescribedSearch()
	const onSearch = async (text: string) => {
		if (!text) return clearSearch()
		if (protoOn) {
			// PROTOTYPE - throwaway: only the words go into the URL; V7 reads them on every change, so nothing the
			// last words implied can stay behind as a manual filter. Manual filters (pins) stay as they are.
			const entering = !searching
			setParams(
				(previous) => {
					const out = new URLSearchParams(previous)
					out.set("q", text)
					for (const key of ["asked", "page", "strict", "open", "off"]) out.delete(key)
					if (entering) {
						browseSort.current = previous.get("sort")
						out.delete("sort")
					}
					return out
				},
				{ replace: !entering, preventScrollReset: true },
			)
			return
		}
		const entering = !searching && !params.has("asked")
		const next = await describe.search(text, entering)
		if (!next) return
		if (entering) browseSort.current = params.get("sort")
		setParams(next, { replace: !entering, preventScrollReset: true })
	}
	const clearSearch = () => {
		const sort = browseSort.current
		browseSort.current = null
		setParams(
			(previous) => {
				const out = protoOn ? new URLSearchParams(previous) : describe.clear(previous)
				if (protoOn) for (const key of ["q", "asked", "page", "strict", "open", "off"]) out.delete(key)
				if (sort && sort !== "relevance") out.set("sort", sort)
				else out.delete("sort")
				return out
			},
			{ preventScrollReset: true },
		)
	}

	const pages = browse.data?.pages ?? []
	const first: DiscoverResults | null = pages[0] ?? null
	const cards = useMemo(() => pages.flatMap((page) => page.cards), [pages])
	const answered = !browse.isPlaceholderData && Boolean(first)
	const stale = searching
		? protoCatalogue
			? !answered
			: !first?.searching || !answered
		: false
	useProductExposure(
		"discovery results shown",
		answered && !stale
			? `${params.toString()}:${cards.map((c) => c.key).join(",")}`
			: null,
		{
			...discoveryProperties(params),
			result_count: cards.length,
			source: searching ? "search" : "discover",
			on_my_services: filters.state.onMyServices,
			for_you: forYou.on,
			sort: filters.sort,
			moods: filters.state.moods,
			country: scope.country,
			service_ids: scope.services,
		},
	)

	// Movement marks: positions before the flip against the order that answers it.
	const [flip, setFlip] = useState<Flip | null>(null)
	const flipTo = (on: boolean) => {
		setFlip({
			on,
			from: browse.key,
			key: browseKey(
				browseQuery,
				on,
				searching ? (search.current?.ranked ?? undefined) : undefined,
				new URLSearchParams(browse.key).get("displayLanguage") ?? undefined,
				searching ? search.current?.searchSet : undefined,
			),
			before: new Map(cards.map((card, i) => [card.key, i])),
			pages: pages.length,
			at: null,
		})
		forYou.set(on)
	}
	useEffect(() => {
		if (!flip) return
		// Another change took over (a filter, the sort): no marks for it. The URL may not have caught up with the flip yet.
		if (browse.key !== flip.key && browse.key !== flip.from)
			return setFlip(null)
		if (flip.at === null && answered) setFlip({ ...flip, at: Date.now() })
	}, [flip, browse.key, answered])
	useEffect(() => {
		if (flip?.at == null) return
		const id = setTimeout(
			() => setFlip(null),
			Math.max(0, flip.at + MARKS_MS - Date.now()),
		)
		return () => clearTimeout(id)
	}, [flip?.at])
	// The person may have scrolled several pages down: load as many of the new order.
	useEffect(() => {
		if (
			flip &&
			answered &&
			browse.key === flip.key &&
			pages.length < flip.pages &&
			browse.hasNextPage &&
			!browse.isFetchingNextPage
		)
			browse.fetchNextPage()
	}, [
		flip,
		answered,
		browse.key,
		pages.length,
		browse.hasNextPage,
		browse.isFetchingNextPage,
		browse.fetchNextPage,
	])
	const marks = useMemo(() => {
		if (flip?.at == null) return null
		const moved = new Map<TitleKey, number>()
		if (flip.on) {
			// Turned on, For you brings titles from far down the sort, so most of the page is new: every title it lifted
			// says how far it came in the whole list. A title that only fell behind them is marked when the person had it
			// in view before.
			for (const page of pages)
				for (const { key, by } of page.moved)
					if (by > 0 || flip.before.has(key)) moved.set(key, by)
			return moved
		}
		// Turned off, the lifted titles leave; the ones that stay say how far they moved among the loaded cards.
		cards.forEach((card, i) => {
			const was = flip.before.get(card.key)
			if (was !== undefined && was !== i) moved.set(card.key, was - i)
		})
		return moved
	}, [flip, cards, pages])

	// Infinite scroll.
	const { ref: moreRef, inView } = useInView({ rootMargin: "600px 0px" })
	useEffect(() => {
		if (
			inView &&
			browse.hasNextPage &&
			!browse.isFetching &&
			!browse.isFetchNextPageError &&
			!browse.isPlaceholderData &&
			!search.partial &&
			!flip
		)
			browse.fetchNextPage()
	}, [
		inView,
		browse.isFetching,
		browse.isFetchNextPageError,
		browse.isPlaceholderData,
		search.partial,
		browse.hasNextPage,
		browse.isFetchingNextPage,
		browse.fetchNextPage,
		flip,
	])

	const status = first?.forYou.status ?? (member ? "ready" : "signUp")
	const taste = tasteStateOf(first)

	// Sides of you: the rows, or the side the grid is narrowed to, while the grouping applies (For you on, or Best match
	// as shown). While the last answer, laid out with rows, stands in for a grid, a spinner waits for the new one.
	// Turning For you off, a search, or Best match falling back leaves the side.
	const grouped = groupsByTaste({
		searching,
		forYou: forYou.on,
		sort: sortShown(filters.sort, searching, taste),
	})
	// Browsing only: while searching, the last answer is stale and hidden anyway, and the status line speaks for the search.
	const layoutPending =
		!searching && !grouped && Boolean(first?.sides) && browse.isPlaceholderData
	const rows = stale || layoutPending ? null : sideRowsOf(first)
	const narrowed =
		!stale && !layoutPending && first?.sides?.layout === "side"
			? first.sides.side
			: null
	const goToSide = (id: string | null) => {
		setParams(
			(previous) => {
				const out = new URLSearchParams(previous)
				if (id) out.set("side", id)
				else out.delete("side")
				out.delete("page")
				return out
			},
			{ preventScrollReset: true },
		)
		window.scrollTo({ top: 0 })
	}
	useEffect(() => {
		if (side === null || grouped || !first || stale) return
		setParams(
			(previous) => {
				const out = new URLSearchParams(previous)
				out.delete("side")
				return out
			},
			{ replace: true, preventScrollReset: true },
		)
	}, [side, grouped, first, stale, setParams])
	const applied = Boolean(first?.forYou.applied) && forYou.on
	// "↑N moved" describes the whole list's order: rows, and a list narrowed to one group, have no movement to show.
	const noMoves = Boolean(rows || narrowed)
	const movedUp = applied && !stale && !noMoves ? (first?.movedUp ?? 0) : 0
	const forYouControl: ForYouControl = {
		on: forYou.on,
		onChange: flipTo,
		movedUp,
		disabled: status === "needsTaste",
		hint:
			status === "needsTaste"
				? "Rate a few more titles you love"
				: searching
					? "Close matches you'd rate highly rise"
					: undefined,
		explanation: null,
	}

	// The open sub-tab's extra counts: the first page again with its `counts=` flag, laid out as a grid (rows carry
	// no counts of their own) and narrowed to the side the grid shows.
	const ranked = searching ? (search.current?.ranked ?? null) : null
	const searchSet = searching ? search.current?.searchSet : undefined
	const countsQuery = withSides(keepOrder(filters.query), side, false)
	const extra = useDiscoverResults({
		query: searchSet
			? `${countsQuery}&searchSet=${searchSet}`
			: ranked
				? `${countsQuery}&ranked=${ranked.join(",")}`
				: countsQuery,
		forYou: forYouSent,
		guest: guest ?? null,
		counts: bar.counts,
		enabled:
			bar.counts.length > 0 &&
			guest !== undefined &&
			(!searching || !!ranked || protoCatalogue),
	})
	// Not the last query's counts while this one's load: the search's own filter counts are this query's.
	const extraShown =
		bar.counts.length > 0 && extra.data && !extra.isPlaceholderData
			? extra.data
			: null
	const listCounts = stale ? null : (extraShown ?? first)
	// The filters the search applies itself: their counts come from the search (a topic's), else "set in search".
	const counts =
		listCounts && searching && ranked
			? withSearchFilters(
					listCounts,
					filters.state,
					scope,
					search.current?.filterHides,
				)
			: listCounts
	// PROTOTYPE - throwaway: one way to switch read parts, for the line and the Matches popout alike. Words set aside
	// by your own choice aren't switches. The Matches rows keep only your own filters; read parts are listed there too.
	const readChipKeys = new Set(readItems.filter((item) => item.on).flatMap((item) => item.chipKeys))
	const keepChip = (chip: { key: string }) => !readChipKeys.has(chip.key)
	// Hard filters' hide counts come with the answer on screen (the words read now), so they follow every switch.
	const hardHides = new Map((proto.answer?.hardHides ?? []).map((h) => [h.phrase.toLowerCase(), h.hides]))
	// The same read filters for the Matches meter: only hard filters that are on, with a count from the answer on screen.
	const readRows = readItems.flatMap((item) => {
		const hides = hardHides.get(item.phrase.toLowerCase())
		if (!item.on || item.aside || item.soft || item.words || !hides) return []
		return [{ group: `read:${item.phrase}`, label: `${item.field} ${item.label}`.trim(), color: readColor(item), hides }]
	})
	// The search's own scope: eligible titles the words don't bring in. One segment, whatever the number of words.
	const outside = proto.answer?.scope?.outside ?? null
	if (outside) readRows.push({ group: "read:scope", label: "Outside your search", color: SCOPE_COLOR, hides: outside })
	const toggleRead = (item: (typeof readItems)[number]) => {
		if (item.aside) return
		setParams(
			setOff(
				params,
				item.on ? [...off, item.phrase] : off.filter((o) => o.toLowerCase() !== item.phrase.toLowerCase()),
			),
			{ replace: true, preventScrollReset: true },
		)
	}
	const allRead = (allOff: boolean) =>
		setParams(
			setOff(params, allOff ? readItems.filter((item) => !item.aside).map((item) => item.phrase) : []),
			{ replace: true, preventScrollReset: true },
		)
	const page = useMemo<DiscoverPageContext>(
		() => ({
			scope,
			searchSet,
			ranked: searching && !search.partial ? ranked : null,
			cards,
			countsFresh: extraShown
				? !extra.isPlaceholderData && (!searching || !search.partial)
				: answered && !stale,
			guest: guest ?? null,
		}),
		[
			scope,
			searchSet,
			searching,
			search.partial,
			ranked,
			cards,
			extraShown,
			extra.isPlaceholderData,
			answered,
			stale,
			guest,
		],
	)
	const busy =
		search.loading ||
		(browse.isFetching && !browse.isFetchingNextPage) ||
		(navigation.state === "loading" &&
			navigation.location?.pathname === "/discover")
	// For crawlers: advance from the last loaded page, including SSR windows beyond page five. Browsing only.
	const { pathname, search: locationSearch } = useLocation()
	const nextPage =
		browse.hasNextPage && !searching ? (pages.at(-1)?.page ?? 0) + 1 : null
	const nextPageUrl = useMemo(() => {
		if (!nextPage) return null
		const next = new URLSearchParams(locationSearch)
		next.set("page", String(nextPage))
		return `${pathname}?${next}`
	}, [nextPage, pathname, locationSearch])

	const found = searching ? search.current : null
	const warm = () => {
		preloadSubTabs().catch(() => {})
	}
	const allTitlesHref = useMemo(() => {
		const next = new URLSearchParams(locationSearch)
		next.set("allTitles", "1")
		return `${pathname}?${next}`
	}, [pathname, locationSearch])

	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-7xl px-4 pt-5 lg:pt-8">
				{/* Reaching for the bar starts loading the panel's content. */}
				<div onPointerEnter={warm} onTouchStart={warm} onFocus={warm}>
					<DiscoverControls
						heading={
							<h1 className="brand-header text-[23px] leading-tight text-white lg:text-[34px]">
								Discover
							</h1>
						}
						className="mt-3 lg:mt-5"
						bar={bar}
						filters={shownFilters}
						counts={counts}
						member={member}
						query={protoOn ? qTyped : q}
						reading={search.reading ?? undefined}
						onSearch={onSearch}
						onClearSearch={clearSearch}
						page={page}
						forYou={forYouControl}
						renderSubTab={renderSubTab}
						renderFind={renderFind}
						prototypeReading={
							protoOn && qTyped !== null
								? ({ chips, onRemove, onOpen }) => (
										<ReadStrip
											items={readItems}
											reading={proto.answer?.readingChips ?? []}
											chips={chips}
											pending={proto.reading || proto.loading}
											onToggle={toggleRead}
											onAll={allRead}
											onRemoveChip={onRemove}
											onOpenChip={onOpen}
										/>
									)
								: undefined
						}
						prototypeMatchesRead={
							protoOn && qTyped !== null ? (
								<MatchesRead
									items={readItems}
									reading={proto.answer?.readingChips ?? []}
									onToggle={toggleRead}
									onAll={allRead}
									hides={hardHides}
									outside={proto.answer?.scope?.outside ?? null}
								/>
							) : undefined
						}
						prototypeHideShown={protoOn}
						prototypeReadRows={protoOn ? readRows : undefined}
						prototypeKeepChip={protoOn ? keepChip : undefined}
						sort={{
							options: discoverSorts(searching, taste),
							value: sortShown(filters.sort, searching, taste),
							onChange: (key) => filters.setSort(key as SortKey),
							footnote: searching
								? undefined
								: "Relevance joins once you search.",
							signUp: taste === "signUp" ? <BestMatchSignUp /> : undefined,
						}}
					/>
				</div>
				{/* A failed search says so; progress shows nothing, so the grid never moves. */}
				<div role="status">
					{searching && search.error && (
						<div className="mt-1 flex min-h-5 flex-wrap items-center gap-3 text-sm text-gray-400 lg:mt-4">
							<span>{search.error}</span>
							<button
								type="button"
								onClick={() => search.retry()}
								className="font-bold text-amber-400 underline-offset-2 hover:text-amber-300 hover:underline cursor-pointer"
							>
								Retry
							</button>
						</div>
					)}
				</div>
				{found && found.people.length > 0 && (
					<div className="search-private ph-no-capture sentry-mask mt-5">
						<SearchPeople
							people={found.people}
							scope={found.creditScope}
							allTitlesHref={allTitlesHref}
						/>
					</div>
				)}
				<div
					className="relative mt-3 lg:mt-5"
					aria-busy={busy}
					onClickCapture={
						protoOn
							? (event) => {
									// PROTOTYPE - throwaway: a card opens the details stand-in (open=<key>), a new history entry.
									if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
									const link = (event.target as HTMLElement).closest("a[href]")
									const match = link?.getAttribute("href")?.match(/^\/(movie|show)\/(\d+)/)
									if (!match) return
									event.preventDefault()
									const next = new URLSearchParams(params)
									next.set("open", String(titleKey(match[1] as "movie" | "show", Number(match[2]))))
									setParams(next, { preventScrollReset: true })
								}
							: undefined
					}
				>
					<GridDim on={desktop && bar.panel.open !== null} />
					{browse.isError && !first ? (
						<p className="py-16 text-center text-gray-400">
							Discover couldn't load right now. Try again in a moment.
						</p>
					) : protoOn && searching && proto.error && !first ? null : !first || layoutPending ? (
						<div className="flex justify-center py-16">
							<Spinner size="large" />
						</div>
					) : rows ? (
						<SideRows rows={rows} onSeeAll={goToSide} />
					) : (
						<>
							{narrowed && (
								<SideBanner side={narrowed} onAll={() => goToSide(null)} />
							)}
							<PrototypeGrid
								on={protoOn && searching}
								readout={proto.readout}
								sort={filters.sort}
								cards={first.total === 0 && !stale ? [] : cards}
								marks={marks}
								flipping={Boolean(flip)}
							>
								{/* A partial list without a title is not a search that found nothing: the status line above says what
							    it still waits for, and the people it names show above the grid. */}
								{!browse.hasNextPage &&
									!browse.isPlaceholderData &&
									!stale &&
									!(search.partial && first.total === 0) && (
										<HiddenTitles
											counts={first}
											state={filters.state}
											onDrop={filters.drop}
											onClear={filters.clearSecondary}
											canClear={
												secondaryFilterCount(
													stateAsApplied(
														filters.state,
														first.ladder,
														member,
														scope.country,
														first.facts,
													),
												) > 0
											}
											searching={searching}
										/>
									)}
							</PrototypeGrid>
						</>
					)}
					<div
						ref={moreRef}
						className="flex min-h-24 items-center justify-center gap-3 text-sm text-gray-400"
						role="status"
					>
						{browse.isFetchingNextPage ? (
							<>
								<Spinner size="large" />
								<span className="sr-only">Loading more matches.</span>
							</>
						) : browse.isFetchNextPageError ? (
							<>
								<span>
									Couldn't load more {searching ? "matches" : "titles"}.
								</span>
								<button
									type="button"
									onClick={() => browse.fetchNextPage()}
									className="font-bold text-amber-400 cursor-pointer underline underline-offset-4"
								>
									Retry
								</button>
							</>
						) : searching &&
							first &&
							!browse.hasNextPage &&
							!busy &&
							!search.partial &&
							!stale &&
							first.total > 0 ? (
							<span>You've reached the end of these matches.</span>
						) : null}
					</div>
					<NextPageLink url={nextPageUrl} />
				</div>
			</div>
			{protoOn && (
				<>
					<DetailsStandIn
						tagged={(key) => prototypeTierLine(proto.readout, key)}
						why={proto.readout?.how ?? null}
					/>
					<Inspector
						proto={proto}
						items={readItems}
						variant="A (Read strip), selected"
						page={{
							cardsLoaded: cards.length,
							pagesLoaded: pages.length,
							hasNextPage: browse.hasNextPage ?? false,
							resultsEndpointTotal: first?.total ?? null,
							v7Total: proto.readout?.total ?? null,
							totalsAgree: first && proto.readout ? first.total === proto.readout.total : null,
							sortShown: sortShown(filters.sort, searching, taste),
							sortSentToResults: protoTop
								? "relevance (keeps V7's tiered Top rated order)"
								: protoCatalogue
									? `${filters.sort === "relevance" ? "popular (catalogue: no ranking)" : filters.sort}`
									: filters.sort,
							catalogueParamsSentToResults_notInUrl: proto.catalogueParams,
							firstKeys: cards.slice(0, 10).map((c) => c.key),
							forYouSwitch: forYou.on,
							forYouSentToResults: forYouSent,
						}}
					/>
				</>
			)}
		</MotionConfig>
	)
}
