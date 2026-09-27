import { useLocation } from "@remix-run/react"
// Discover's browse mode on the shared filter bar: the heading with the taste explanation at the top right, the bar
// with For you next to the sort, and the grid of title cards, loaded 40 at a time as the person scrolls.
import { MotionConfig } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import { useInView } from "react-intersection-observer"
import type { DiscoverResults } from "~/server/discover-results.server"
import { NextPageLink } from "~/ui/explore/GridUtils"
import {
	FilterBar,
	type ForYouControl,
	ForYouExplanation,
	SLAB_CLEARANCE,
	useFilterState,
} from "~/ui/filter-bar"
import { Spinner } from "~/ui/wait/Spinner"
import type { TitleKey } from "~/utils/title-key"
import { DiscoverGrid } from "./DiscoverGrid"
import { ForYouNeedsTaste, ForYouSignUp } from "./ForYouStates"
import { HiddenTitles } from "./HiddenTitles"
import { TasteExplanation } from "./TasteExplanation"
import {
	type InitialBrowse,
	browseKey,
	useDiscoverBrowse,
	useForYou,
	useGuestBody,
} from "./useDiscoverBrowse"

/** How long the per-card movement marks show after For you flips. */
const MARKS_MS = 2600

export interface DiscoverBrowseProps {
	initial: InitialBrowse | null
	member: boolean
	/** The member has saved services. */
	hasServices: boolean
	/** The member's saved For you setting; true for guests. */
	savedForYou: boolean
}

// A For you flip in progress: where each title was before, and when the new order landed.
interface Flip {
	/** The query before the flip, and the one that answers it. */
	from: string
	key: string
	before: Map<TitleKey, number>
	pages: number
	at: number | null
}

export function DiscoverBrowse({
	initial,
	member,
	hasServices,
	savedForYou,
}: DiscoverBrowseProps) {
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
	const filters = useFilterState({ defaults })
	const forYou = useForYou({ member, saved: savedForYou })
	const browse = useDiscoverBrowse({
		query: filters.query,
		forYou: forYou.on,
		member,
		guest,
		initial,
	})

	const pages = browse.data?.pages ?? []
	const first: DiscoverResults | null = pages[0] ?? null
	const cards = useMemo(() => pages.flatMap((page) => page.cards), [pages])
	const answered = !browse.isPlaceholderData && Boolean(first)

	// Movement marks: positions before the flip against the order that answers it.
	const [flip, setFlip] = useState<Flip | null>(null)
	const flipTo = (on: boolean) => {
		setFlip({
			from: browse.key,
			key: browseKey(filters.query, on),
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
		cards.forEach((card, i) => {
			const was = flip.before.get(card.key)
			if (was !== undefined && was !== i) moved.set(card.key, was - i)
		})
		return moved
	}, [flip, cards])

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
	const applied = Boolean(first?.forYou.applied) && forYou.on
	const movedUp = applied ? (first?.movedUp ?? 0) : 0
	const leanings = first?.explanation?.leanings ?? []
	const ratings = first?.explanation?.ratings ?? first?.forYou.ratings ?? 0
	const forYouControl: ForYouControl = {
		on: forYou.on,
		onChange: flipTo,
		movedUp,
		disabled: status === "needsTaste",
		hint:
			status === "needsTaste" ? "Rate a few more titles you love" : undefined,
		replacement: status === "signUp" ? <ForYouSignUp /> : undefined,
		explanation:
			status === "needsTaste" ? (
				<ForYouNeedsTaste />
			) : (
				<ForYouExplanation
					on={forYou.on}
					leanings={leanings}
					ratings={ratings}
					movedUp={movedUp}
				/>
			),
	}

	const counts = first
	// For crawlers: the next page as a plain link (the loader serves ?page=N with the pages before it).
	const { pathname, search } = useLocation()
	const nextPage = browse.hasNextPage ? pages.length + 1 : null
	const nextPageUrl = useMemo(() => {
		if (!nextPage) return null
		const params = new URLSearchParams(search)
		params.set("page", String(nextPage))
		return `${pathname}?${params}`
	}, [nextPage, pathname, search])

	return (
		<MotionConfig reducedMotion="user">
			<div className={`mx-auto max-w-7xl px-4 pt-5 lg:pt-8 ${SLAB_CLEARANCE}`}>
				<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 lg:min-h-16">
					<h1 className="brand-header text-3xl text-white lg:text-4xl">
						Discover
					</h1>
					<TasteExplanation
						status={status}
						on={applied}
						leanings={leanings}
						ratings={ratings}
						guest={!member}
						className="w-full lg:w-auto lg:max-w-[34rem]"
					/>
				</div>
				<div className="lg:mt-7">
					<FilterBar filters={filters} counts={counts} forYou={forYouControl} />
				</div>
				<div
					className="mt-5 lg:mt-7"
					aria-busy={browse.isFetching && !browse.isFetchingNextPage}
				>
					{browse.isError && !counts ? (
						<p className="py-16 text-center text-gray-400">
							Discover couldn't load right now. Try again in a moment.
						</p>
					) : !counts ? (
						<div className="flex justify-center py-16">
							<Spinner size="large" />
						</div>
					) : (
						<DiscoverGrid
							cards={counts.total === 0 ? [] : cards}
							marks={marks}
							flipping={Boolean(flip)}
						>
							{!browse.hasNextPage && !browse.isPlaceholderData && (
								<HiddenTitles
									counts={counts}
									state={filters.state}
									onDrop={filters.drop}
									onClear={filters.clearSecondary}
									canClear={filters.secondaryCount > 0}
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
