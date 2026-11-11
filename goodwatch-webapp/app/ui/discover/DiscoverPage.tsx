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
import type { SearchTrigger } from "~/domain/search-attribution"
import { navigationSearchOrigin, searchNavigationState } from "~/ui/search/search-attribution"
import { useLocation, useNavigation, useNavigationType, useSearchParams } from "@remix-run/react"
import { MotionConfig } from "framer-motion"
import { Suspense, lazy, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useInView } from "react-intersection-observer"
import {
	DISCOVER_DEFAULTS,
	type SearchScope,
	searchEligibility,
	searchText,
	withSearchFilters,
} from "~/domain/discover-search"
import {
	type SortKey,
	filterQuery,
	filterStateFromParams,
	secondaryFilterCount,
	stateAsApplied,
} from "~/domain/filter-state"
import { preferencesParam } from "~/domain/search-preferences"
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
import { filtersToKeep } from "~/ui/discover-bar/described-search"
import type { ReadRow } from "~/ui/discover-bar/FilterMix"
import { useDesktop, useDiscoverBar } from "~/ui/discover-bar/useDiscoverBar"
import { NextPageLink } from "~/ui/explore/GridUtils"
import { BestMatchSignUp } from "~/ui/filter-bar/SignUpPanel"
import { discoverSorts, sortShown, tasteStateOf } from "~/ui/filter-bar/labels"
import type { FilterBarCounts, ForYouControl } from "~/ui/filter-bar/types"
import { useFilterState } from "~/ui/filter-bar/useFilterState"
import { SearchPeople } from "~/ui/search/SearchPeople"
import { Spinner } from "~/ui/wait/Spinner"
import type { TitleKey } from "~/utils/title-key"
import { DiscoverGrid } from "./DiscoverGrid"
import { DiscoverRoles } from "./DiscoverRoles"
import { HiddenTitles } from "./HiddenTitles"
import {
	type InitialBrowse,
	browseKey,
	useDiscoverBrowse,
	useForYou,
	useGuestBody,
} from "./useDiscoverBrowse"
import { useDiscoverSearch } from "./useDiscoverSearch"
import { type ReadItem, readText, scopeOwner, withOff } from "./search-reading/read-items"
import { SCOPE_COLOR, readColor } from "./search-reading/read-colors"
import type { HideCount } from "./search-reading/read-parts"
import { useReadFilters, useSearchReading } from "./search-reading/useSearchReading"
import { useHydrated } from "~/utils/hydrated"
import { awardParam, readAwardWords } from "~/domain/award-filter"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { searchPending, unsentWords } from "./search-pending"

// The Matches popout's read parts: loaded when the popout first shows them.
const MatchesRead = lazy(reloadOnStaleChunk(() => import("./search-reading/MatchesRead")))
// The read strip shows only while searching: browsing never loads it. Its reading comes from the browser, so it mounts
// after hydration (a lazy boundary that hydrates while the reading streams in would throw away the page's HTML).
const ReadStrip = lazy(
	reloadOnStaleChunk(() => import("./search-reading/ReadStrip").then((m) => ({ default: m.ReadStrip }))),
)

/** The read filters' counts as the meter shows them (a share of the results' hidden titles where it applies). */
function withShownCounts(hides: ReadonlyMap<string, HideCount>, shown: ReadonlyMap<string, number>) {
	const out = new Map<string, HideCount>()
	for (const [phrase, count] of hides) out.set(phrase, { ...count, n: shown.get(`read:${phrase}`) ?? count.n })
	return out
}

/** Which streamed count belongs to a read filter (preference-pools.server.ts counts years, type and anime). */
function countedName(item: ReadItem) {
	const keys = item.params.map(([key]) => key)
	if (keys.includes("minYear") || keys.includes("maxYear")) return "years"
	if (keys.includes("type")) return "type"
	if (keys.includes("anime")) return "anime"
	return null
}

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
}: DiscoverPageProps) {
	const [params, setParams] = useSearchParams()
	const hydrated = useHydrated()
	// The words as typed. An older link keeps them in `asked`, with what they read as the person's own filters.
	const fullTyped = searchText(params.get("asked") ?? params.get("q"))
	const invocationLocation = useLocation()
	const invocationNavigation = useNavigationType()
	const attribution = navigationSearchOrigin(fullTyped, invocationLocation.state, invocationNavigation)
	// Award words that became the awards filter ("oscar winners") leave the search: only the rest is searched.
	const awardWords = fullTyped && params.get("awards") ? readAwardWords(fullTyped) : null
	const typed = awardWords ? searchText(awardWords.rest) : fullTyped
	// The phrases switched off on the read strip: left out of what the search reads.
	const off = useMemo(() => params.getAll("off"), [params])
	const searching = typed !== null
	const allTitles = params.get("allTitles") === "1"

	const guest = useGuestBody(member)
	const filters = useFilterState({
		defaults: DISCOVER_DEFAULTS,
		member,
		searching,
	})
	// What the search reads from the words, and how it uses it (docs/implementation/search-preferences.md).
	const existing = useMemo(() => {
		const own = filtersToKeep(params, undefined)
		own.delete("off")
		return own.toString()
	}, [params])
	const [named, setNamed] = useState<string | null>(null)
	const switchedOn = readText(typed, off)
	const reading = useSearchReading({
		typed,
		off,
		existing,
		namedTitle: named !== null && named === switchedOn,
		defaults: filters.defaults,
		enabled: searching,
	})
	// While the words are read again, the last plan stays, so its list stays too.
	const lastPlan = useRef(reading.plan ? reading : null)
	if (reading.plan) lastPlan.current = reading
	const settled = searching ? (reading.plan ? reading : lastPlan.current) : null
	const plan = settled?.plan ?? null
	// Every word became a filter: Discover's list for those filters, no search.
	const catalogue = plan?.branch === "catalogue"
	// The filters the list uses: the person's own and the hard ones read from the words (preferences only order it).
	const listState = useMemo(
		() => (plan ? filterStateFromParams(plan.filters, filters.defaults) : filters.state),
		[plan, filters.state, filters.defaults],
	)
	const q = !plan || catalogue ? null : plan.branch === "title" ? settled?.text ?? null : settled?.words || null
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
		() => searchEligibility(listState, scope),
		[listState, scope],
	)
	// A single genre read as a preference widens what the search finds: the original reading's pool comes along, and
	// each read filter the search applies itself gets a count of what it keeps out.
	const preferences = useMemo(() => {
		if (!plan || plan.branch !== "positive") return undefined
		const original = searchEligibility(filterStateFromParams(plan.original, filters.defaults), scope)
		const own = searchEligibility(filters.state, scope)
		const differs = (a: unknown, b: unknown) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)
		const counted: string[] = []
		if (differs([own.minYear, own.maxYear], [eligibility.minYear, eligibility.maxYear])) counted.push("years")
		if (differs(own.type, eligibility.type)) counted.push("type")
		if (differs(own.anime, eligibility.anime)) counted.push("anime")
		return {
			originalGenres: differs(original.genres, eligibility.genres) ? original.genres : undefined,
			counted,
			named: settled?.text ?? undefined,
		}
	}, [plan, settled?.text, filters.defaults, filters.state, eligibility, scope])
	const search = useDiscoverSearch({
		q,
		attribution,
		filters: eligibility,
		allTitles,
		enabled: guest !== undefined && reading.plan !== null,
		preferences,
	})
	// The words name a title: read again with only the person's own filters.
	const namesTitle = Boolean(search.current?.namedTitle) && plan !== null && plan.branch !== "title"
	useEffect(() => {
		if (namesTitle && switchedOn) setNamed(switchedOn)
	}, [namesTitle, switchedOn])

	// The results: the list's filters, the read preferences that order it, the original pool, and the search's scope.
	const listQuery = useMemo(() => {
		if (!searching || !plan) return filters.query
		const out = new URLSearchParams(filterQuery(listState, filters.sort, filters.defaults))
		if (!catalogue && plan.preferences.length) out.set("prefer", preferencesParam(plan.preferences))
		if (!catalogue && search.current?.originalSet) out.set("originalSet", search.current.originalSet)
		if (!catalogue && search.current?.identitySet) out.set("identitySet", search.current.identitySet)
		if (!catalogue) out.set("scope", "1")
		return out.toString()
	}, [searching, plan, catalogue, filters.query, filters.sort, filters.defaults, listState, search.current?.originalSet, search.current?.identitySet])
	const shownFilters = useReadFilters(filters, reading.items, searching, listQuery)

	const browse = useDiscoverBrowse({
		query: listQuery,
		forYou: forYou.on,
		member,
		guest,
		initial,
		ranked: searching && !catalogue ? (search.current?.ranked ?? null) : undefined,
		searchSet: searching && !catalogue ? search.current?.searchSet : undefined,
		provisional: searching && !catalogue && search.partial,
	})

	// Entering a search chooses Relevance; clearing it returns to the sort used before.
	const browseSort = useRef<string | null>(null)
	const navigation = useNavigation()
	// Only the words go into the URL: what they read is read again on every change, so nothing the last words implied
	// stays behind as the person's own filter. Entering a search chooses Relevance.
	const onSearch = (text: string, trigger: SearchTrigger = "selection") => {
		if (!text) return clearSearch()
		const entering = !searching
		if (entering) browseSort.current = params.get("sort")
		setParams(
			(previous) => {
				const out = new URLSearchParams(previous)
				out.set("q", text)
				for (const key of ["asked", "page", "off"]) out.delete(key)
				// Award words in the search become the awards filter right away.
				const awards = readAwardWords(text)
				if (awards) out.set("awards", awardParam(awards.filter) ?? "won")
				if (entering) out.delete("sort")
				return out
			},
			{ replace: !entering, preventScrollReset: true, state: searchNavigationState(text, "discover", trigger) },
		)
	}
	const clearSearch = () => {
		const sort = browseSort.current
		browseSort.current = null
		setParams(
			(previous) => {
				const out = new URLSearchParams(previous)
				for (const key of ["q", "asked", "page", "off"]) out.delete(key)
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
		? catalogue
			? !answered
			: !first?.searching || !answered
		: false
	// From the first keystroke until the results are painted, the field's line runs and the old results dim.
	const [unsent] = useState(unsentWords)
	const waitingForWords = useSyncExternalStore(
		unsent.subscribe,
		() => {
			const words = unsent.get()
			return words !== null && searchText(words) !== fullTyped
		},
		() => false,
	)
	useEffect(() => {
		if (!waitingForWords) unsent.set(null)
	}, [waitingForWords, unsent])
	// A partial list already on screen for these words stays bright while its completed list loads.
	const shownWords = useRef<string | null>(null)
	if (!searching) shownWords.current = null
	else if (answered && !stale) shownWords.current = fullTyped
	const { pending, staleResults } = searchPending({
		waitingForWords,
		searching,
		failed: Boolean(search.error),
		readingPending: reading.plan === null,
		catalogue,
		hasSearchAnswer: q === null || Boolean(search.current),
		stale,
		partial: search.partial,
		shownForWords: shownWords.current === fullTyped,
	})
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
				listQuery,
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

	// The cards on screen in their order, for the characters strip.
	const roleCards = first && first.total === 0 && !stale ? [] : cards
	const applied = Boolean(first?.forYou.applied) && forYou.on
	const movedUp = applied && !stale ? (first?.movedUp ?? 0) : 0
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

	// The open sub-tab's extra counts: the first page again with its `counts=` flag.
	const ranked = searching && !catalogue ? (search.current?.ranked ?? null) : null
	const searchSet = searching && !catalogue ? search.current?.searchSet : undefined
	const extra = useDiscoverResults({
		query: searchSet
			? `${listQuery}&searchSet=${searchSet}`
			: ranked
				? `${listQuery}&ranked=${ranked.join(",")}`
				: listQuery,
		forYou: forYou.on,
		guest: guest ?? null,
		counts: bar.counts,
		enabled:
			bar.counts.length > 0 &&
			guest !== undefined &&
			(!searching || !!ranked || catalogue),
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
					listState,
					scope,
					search.current?.filterHides,
				)
			: listCounts
	// The read parts' switches, on the strip and in Matches alike. Words set aside by the person's own choice aren't
	// switches. Matches keeps rows only for the person's own filters; the read parts are listed after them.
	const items = reading.items
	// The fingerprint the search ranks by: none while no words are searched (every part off, or no words left).
	const fingerprint = q !== null ? (search.reading ?? []) : []
	const readChipKeys = new Set(items.filter((item) => item.on).flatMap((item) => item.chipKeys))
	const keepChip = (chip: { key: string }) => !readChipKeys.has(chip.key)
	// What each read filter keeps out: the search's streamed count for one it applies itself (an estimate: switching
	// it changes what the search finds), else the results' own count (exact on the catalog when no words are left).
	const hides = new Map<string, HideCount & { inHidden?: boolean }>()
	for (const item of items) {
		if (!item.on || item.aside || item.soft || item.words) continue
		const name = countedName(item)
		const streamed = name ? search.counts?.find((c) => c.filter === name) : undefined
		const own = counts?.recoveries.find((r) => r.filter === item.group)
		const inSearch = (counts as FilterBarCounts | null)?.inSearch?.includes(item.group as never)
		if (streamed) hides.set(item.phrase.toLowerCase(), { n: streamed.hides, approx: true })
		// One the results apply: its share of their hidden titles (FilterMix shares them out, hidden-allocation.ts).
		else if (counts && item.group && !inSearch)
			hides.set(item.phrase.toLowerCase(), { n: own?.titles ?? 0, approx: !catalogue, inHidden: true })
	}
	const readRows: ReadRow[] = items.flatMap((item) => {
		const count = hides.get(item.phrase.toLowerCase())
		if (!count || (!count.inHidden && !count.n)) return []
		return [{ group: `read:${item.phrase.toLowerCase()}`, label: `${item.field} ${item.label}`.trim(), color: readColor(item), hides: count.n, approx: count.approx, inHidden: count.inHidden, nativeGroup: item.group ?? undefined }]
	})
	// The search's scope: titles that pass every filter but that the words don't bring in. One count, on one row.
	const outside = !stale && first?.scope ? first.scope.outside : null
	const owner = outside ? scopeOwner(items) : null
	if (outside && owner)
		readRows.push({
			group: "read:scope",
			label: items.find((item) => item.phrase === owner)?.label ?? owner,
			color: SCOPE_COLOR,
			hides: outside,
			approx: false,
		})
	const toggleRead = (item: ReadItem) => {
		if (item.aside) return
		setParams(
			withOff(
				params,
				item.on ? [...off, item.phrase] : off.filter((o) => o.toLowerCase() !== item.phrase.toLowerCase()),
			),
			{ replace: true, preventScrollReset: true },
		)
	}
	const allRead = (allOff: boolean) =>
		setParams(withOff(params, allOff ? items.filter((item) => !item.aside).map((item) => item.phrase) : []), {
			replace: true,
			preventScrollReset: true,
		})
	const page = useMemo<DiscoverPageContext>(
		() => ({
			scope,
			searchSet,
			originalSet: searching && !catalogue ? search.current?.originalSet : undefined,
			identitySet: searching && !catalogue ? search.current?.identitySet : undefined,
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
			catalogue,
			search.current?.originalSet,
			search.current?.identitySet,
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
		(searching && reading.plan === null) ||
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
						query={q}
						typedQuery={fullTyped}
						searchPending={pending}
						onUnsentWords={unsent.set}
						reading={search.reading ?? undefined}
						onSearch={onSearch}
						onClearSearch={clearSearch}
						page={page}
						forYou={forYouControl}
						renderSubTab={renderSubTab}
						renderFind={renderFind}
						readStrip={
							searching
								? ({ chips, onRemove, onOpen }) => !hydrated ? (
										<div className="h-9 flex-1" />
									) : (
										<Suspense fallback={<div className="h-9 flex-1" />}>
										<ReadStrip
											items={items}
											reading={fingerprint}
											chips={chips}
											pending={reading.pending || search.loading}
											onToggle={toggleRead}
											onAll={allRead}
											onRemoveChip={onRemove}
											onOpenChip={onOpen}
										/>
										</Suspense>
									)
								: undefined
						}
						matchesRead={
							searching && items.length
								? (shown, own) => (
										<Suspense fallback={null}>
											<MatchesRead
												own={own}
												items={items}
												reading={fingerprint}
												onToggle={toggleRead}
												hides={withShownCounts(hides, shown)}
												outside={outside}
											/>
										</Suspense>
									)
								: undefined
						}
						keepChip={searching ? keepChip : undefined}
						readRows={searching ? readRows : undefined}
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
					{pending && !waitingForWords && <span className="sr-only">Searching…</span>}
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
				<div className="relative mt-3 lg:mt-5" aria-busy={busy}>
					<GridDim on={desktop && bar.panel.open !== null} />
					{/* A cast filter's characters strip leads the results. */}
					<DiscoverRoles cards={roleCards}>
						{browse.isError && !first ? (
							<p className="py-16 text-center text-gray-400">
								Discover couldn't load right now. Try again in a moment.
							</p>
						) : !first ? (
							<div className="flex justify-center py-16">
								<Spinner size="large" />
							</div>
						) : (
								<DiscoverGrid
									cards={first.total === 0 && !stale ? [] : cards}
									marks={marks}
									flipping={Boolean(flip)}
									dimmed={staleResults}
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
								</DiscoverGrid>
						)}
					</DiscoverRoles>
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
		</MotionConfig>
	)
}
