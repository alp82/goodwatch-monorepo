// Discover on the shared filter bar, browsing and searching on one page: the heading (tap it to search; the query
// becomes the heading) with the explanation at the top right, the bar with For you before the sort, and the grid of
// title cards, loaded 40 at a time as the person scrolls. The grid is never replaced between browsing and searching:
// titles in both lists glide to their new places.
//
// Browsing, the explanation shows the taste For you leans on. Searching, "Read as" shows how the search read the query,
// Relevance joins the sorts and is chosen, and the counts and recoveries cover the search's top 100. Clearing the
// search returns to the sort used before it.
//
// Best match (the sort by taste match) and the Taste match filter need taste; the bar hears from the results whether
// the viewer has it. Under Best match For you shows on and flipping it leads to another sort (see the filter bar's
// useForYouUnderBestMatch).
import { ArrowPathIcon } from "@heroicons/react/20/solid"
import { useLocation, useNavigation, useSearchParams } from "@remix-run/react"
import { MotionConfig } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { useInView } from "react-intersection-observer"
import {
	type SearchScope,
	searchEligibility,
	searchText,
} from "~/domain/discover-search"
import {
	type SortKey,
	secondaryFilterCount,
	stateAsApplied,
} from "~/domain/filter-state"
import type { DiscoverResults } from "~/server/discover-results.server"
import { NextPageLink } from "~/ui/explore/GridUtils"
import {
	FilterBar,
	type ForYouControl,
	ForYouExplanation,
	SLAB_CLEARANCE,
	tasteStateOf,
	useFilterState,
} from "~/ui/filter-bar"
import { sortShown } from "~/ui/filter-bar/labels"
import { SearchPeople } from "~/ui/search/SearchPeople"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { Spinner } from "~/ui/wait/Spinner"
import type { TitleKey } from "~/utils/title-key"
import { DiscoverGrid } from "./DiscoverGrid"
import { DiscoverHeading } from "./DiscoverHeading"
import { ForYouNeedsTaste, ForYouSignUp } from "./ForYouStates"
import { HiddenTitles } from "./HiddenTitles"
import { TasteExplanation } from "./TasteExplanation"
import {
	type InitialBrowse,
	browseKey,
	useDiscoverBrowse,
	useForYou,
	useGuestBody,
	writeForYou,
} from "./useDiscoverBrowse"
import { useDiscoverSearch } from "./useDiscoverSearch"

/** How long the per-card movement marks show after For you flips. */
const MARKS_MS = 2600

export interface DiscoverPageProps {
	initial: InitialBrowse | null
	member: boolean
	/** The member has saved services. */
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
	hasServices,
	savedForYou,
	searchScope,
}: DiscoverPageProps) {
	const [params, setParams] = useSearchParams()
	const q = searchText(params.get("q"))
	const searching = q !== null
	const allTitles = params.get("allTitles") === "1"

	const guest = useGuestBody(member)
	const guestServices = Boolean(guest?.services)
	const guestProgress = (guest?.interactions.length ?? 0) > 0
	const defaults = useMemo(
		() => ({
			onMyServices: member ? hasServices : guestServices,
			notSeenYet: member || guestProgress,
		}),
		[member, hasServices, guestServices, guestProgress],
	)
	const filters = useFilterState({ defaults, searching })
	const forYou = useForYou({ member, saved: savedForYou })

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
	const search = useDiscoverSearch({
		q,
		filters: eligibility,
		allTitles,
		enabled: guest !== undefined,
	})

	const browse = useDiscoverBrowse({
		query: filters.query,
		forYou: forYou.on,
		member,
		guest,
		initial,
		ranked: searching ? (search.current?.ranked ?? null) : undefined,
	})

	// Entering a search chooses Relevance; clearing it returns to the sort used before.
	const browseSort = useRef<string | null>(null)
	const navigation = useNavigation()
	const onSearch = (text: string) => {
		if (!text) return clearSearch()
		const entering = !searching
		if (entering) browseSort.current = params.get("sort")
		setParams(
			(previous) => {
				const out = new URLSearchParams(previous)
				out.set("q", text)
				if (entering) out.delete("sort")
				out.delete("allTitles")
				out.delete("page")
				return out
			},
			{ replace: !entering, preventScrollReset: true },
		)
	}
	const clearSearch = () => {
		const sort = browseSort.current
		browseSort.current = null
		setParams(
			(previous) => {
				const out = new URLSearchParams(previous)
				out.delete("q")
				out.delete("allTitles")
				out.delete("page")
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
	// Until a search's own results land, the grid keeps the last list, and the counts wait.
	const stale = searching ? !first?.searching || !answered : false

	// Movement marks: positions before the flip against the order that answers it.
	const [flip, setFlip] = useState<Flip | null>(null)
	const flipTo = (on: boolean) => {
		setFlip({
			on,
			from: browse.key,
			key: browseKey(
				filters.query,
				on,
				searching ? (search.current?.ranked ?? undefined) : undefined,
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
		if (inView && browse.hasNextPage && !browse.isFetchingNextPage && !flip)
			browse.fetchNextPage()
	}, [
		inView,
		browse.hasNextPage,
		browse.isFetchingNextPage,
		browse.fetchNextPage,
		flip,
	])

	const status = first?.forYou.status ?? (member ? "ready" : "signUp")
	const taste = tasteStateOf(first)
	// Best match is the sort in use: For you shows on, with nothing to move.
	const bestMatch = sortShown(filters.sort, searching, taste) === "match"
	const applied = Boolean(first?.forYou.applied) && forYou.on
	const movedUp = applied && !stale ? (first?.movedUp ?? 0) : 0
	const leanings = first?.explanation?.leanings ?? []
	const ratings = first?.explanation?.ratings ?? first?.forYou.ratings ?? 0
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
		replacement: status === "signUp" ? <ForYouSignUp /> : undefined,
		// One URL write for both: a second write in the same tick would drop the first.
		onOffWithSort: (sort) => {
			forYou.remember(false)
			filters.setSort(sort as SortKey, (out) => writeForYou(out, false))
		},
		explanation:
			status === "needsTaste" ? (
				<ForYouNeedsTaste />
			) : (
				<ForYouExplanation
					on={forYou.on || bestMatch}
					bestMatch={bestMatch}
					searching={searching}
					leanings={leanings}
					ratings={ratings}
					movedUp={movedUp}
				/>
			),
	}

	const counts = stale ? null : first
	const busy =
		search.loading ||
		(browse.isFetching && !browse.isFetchingNextPage) ||
		(navigation.state === "loading" &&
			navigation.location?.pathname === "/discover")
	// For crawlers: the next page as a plain link (the loader serves ?page=N with the pages before it). Browsing only.
	const { pathname, search: locationSearch } = useLocation()
	const nextPage = browse.hasNextPage && !searching ? pages.length + 1 : null
	const nextPageUrl = useMemo(() => {
		if (!nextPage) return null
		const next = new URLSearchParams(locationSearch)
		next.set("page", String(nextPage))
		return `${pathname}?${next}`
	}, [nextPage, pathname, locationSearch])

	const found = searching ? search.current : null
	const allTitlesHref = useMemo(() => {
		const next = new URLSearchParams(locationSearch)
		next.set("allTitles", "1")
		return `${pathname}?${next}`
	}, [pathname, locationSearch])

	return (
		<MotionConfig reducedMotion="user">
			<div className={`mx-auto max-w-7xl px-4 pt-5 lg:pt-8 ${SLAB_CLEARANCE}`}>
				<DiscoverHeading
					q={q}
					onSearch={onSearch}
					onClear={clearSearch}
					explanation={
						<TasteExplanation
							status={status}
							on={applied}
							leanings={leanings}
							ratings={ratings}
							guest={!member}
							search={
								q ? { q, reading: search.reading, forYou: applied } : null
							}
						/>
					}
				/>
				<div className="lg:mt-7">
					<FilterBar
						filters={filters}
						counts={counts}
						forYou={forYouControl}
						taste={taste}
						sortFooter={
							taste === "signUp" ? (
								<div className="px-2 pt-2 pb-1">
									<SignUpPrompt feature="bestMatch" stage="learn" size="chip" />
								</div>
							) : undefined
						}
						insightLead={
							busy && searching ? (
								<ArrowPathIcon
									className="h-4 w-4 animate-spin text-gray-400 motion-reduce:animate-none"
									aria-label="Searching"
								/>
							) : undefined
						}
					/>
				</div>
				{searching && search.error && (
					<p className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-400">
						{search.error}
						<button
							type="button"
							onClick={() => search.retry()}
							className="font-bold text-amber-400 underline-offset-2 hover:text-amber-300 hover:underline cursor-pointer"
						>
							Retry
						</button>
					</p>
				)}
				{found && found.people.length > 0 && (
					<div className="search-private ph-no-capture sentry-mask mt-5">
						<SearchPeople
							people={found.people}
							scope={found.creditScope}
							allTitlesHref={allTitlesHref}
						/>
					</div>
				)}
				<div className="mt-5 lg:mt-7" aria-busy={busy}>
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
						>
							{!browse.hasNextPage && !browse.isPlaceholderData && !stale && (
								<HiddenTitles
									counts={first}
									state={filters.state}
									onDrop={filters.drop}
									onClear={filters.clearSecondary}
									canClear={
										secondaryFilterCount(
											stateAsApplied(filters.state, first.ladder),
										) > 0
									}
									searching={searching}
								/>
							)}
						</DiscoverGrid>
					)}
					<div ref={moreRef} className="flex h-24 items-center justify-center">
						{browse.isFetchingNextPage && <Spinner size="large" />}
					</div>
					<NextPageLink url={nextPageUrl} />
				</div>
			</div>
		</MotionConfig>
	)
}
