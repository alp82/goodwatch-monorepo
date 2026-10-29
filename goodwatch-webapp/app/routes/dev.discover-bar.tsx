// Development only: the Discover bar, its panel, the status line and the panel footer on the real catalog, before
// Discover uses them. The state binds to this page's URL (`q` is the search), counts come from /api/discover/results
// with the open sub-tab's `counts=` flags, and the first page of titles shows as cards. Sub-tabs show their empty
// slots until their steps fill them. Returns 404 in production.
//
// The loader reads nothing, so the page also opens on a local server without databases; scripts/dev-discover-bar.sh
// starts one that reads the live site's public endpoints as a guest.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useSearchParams,
} from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import { searchEligibility, searchText } from "~/domain/discover-search"
import { useDiscoverResults } from "~/routes/api.discover_.results"
import { DiscoverControls } from "~/ui/discover-bar/DiscoverControls"
import { GridDim } from "~/ui/discover-bar/DiscoverPanel"
import { useDesktop, useDiscoverBar } from "~/ui/discover-bar/useDiscoverBar"
import { useDiscoverSearch } from "~/ui/discover/useDiscoverSearch"
import { useFilterState } from "~/ui/filter-bar"
import { discoverSorts, sortShown, tasteStateOf } from "~/ui/filter-bar/labels"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { useUser } from "~/utils/auth"
import { snapshotGuestProgress } from "~/utils/guest-progress"

export function loader(_: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json({})
}

// Filter changes only touch the URL's parameters; the counts come from the results endpoint, not this loader.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	formMethod || currentUrl.pathname !== nextUrl.pathname
		? defaultShouldRevalidate
		: false

export default function DevDiscoverBar() {
	const { user, loading } = useUser()
	const member = Boolean(user)
	const [params, setParams] = useSearchParams()
	const q = searchText(params.get("q"))
	const searching = q !== null
	const [guest, setGuest] = useState<ReturnType<
		typeof snapshotGuestProgress
	> | null>(null)
	useEffect(() => {
		if (!loading && !user) setGuest(snapshotGuestProgress())
	}, [loading, user])
	// The viewer's defaults, as on Discover; a guest's services and progress live in the browser. The loader reads no
	// settings, so a member's On my services starts off here.
	const guestServices = Boolean(guest?.services)
	const guestProgress = (guest?.interactions.length ?? 0) > 0
	const defaults = useMemo(
		() => ({
			onMyServices: guestServices,
			notSeenYet: member || guestProgress,
		}),
		[member, guestServices, guestProgress],
	)
	const filters = useFilterState({ defaults, member, searching })
	const bar = useDiscoverBar(filters.state)
	const ready = !loading && (member || guest !== null)

	const eligibility = useMemo(
		() =>
			searchEligibility(filters.state, {
				country: guest?.country || "US",
				services: [],
			}),
		[filters.state, guest?.country],
	)
	const search = useDiscoverSearch({
		q,
		filters: eligibility,
		allTitles: false,
		enabled: ready,
	})
	const ranked = search.current?.ranked
	const results = useDiscoverResults({
		query:
			searching && ranked
				? `${filters.query}${filters.query ? "&" : ""}ranked=${ranked.join(",")}`
				: filters.query,
		guest: member ? null : guest,
		counts: bar.counts,
		enabled: ready && (!searching || Boolean(ranked)),
	})
	const data = results.data ?? null
	const taste = tasteStateOf(data)

	const setQuery = (text: string | null) =>
		setParams(
			(previous) => {
				const out = new URLSearchParams(previous)
				if (text) out.set("q", text)
				else out.delete("q")
				out.delete("sort")
				out.delete("page")
				return out
			},
			{ replace: true, preventScrollReset: true },
		)

	const desktop = useDesktop()
	return (
		<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8 lg:pt-6">
			<h1 className="brand-header text-[23px] leading-tight text-white lg:text-[34px]">
				Discover movies and shows
			</h1>
			<DiscoverControls
				className="mt-3 lg:mt-5"
				bar={bar}
				filters={filters}
				counts={data}
				member={member}
				query={q}
				reading={search.reading ?? undefined}
				onSearch={setQuery}
				onClearSearch={() => setQuery(null)}
				sort={{
					options: discoverSorts(searching, taste),
					value: sortShown(filters.sort, searching, taste),
					onChange: (key) => filters.setSort(key as typeof filters.sort),
					footnote: searching ? undefined : "Relevance joins once you search.",
				}}
			/>
			<div className="relative mt-2 lg:mt-4">
				<section className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6">
					{(data?.cards ?? []).map((card) => (
						<TitlePosterCard key={card.key} card={card} />
					))}
				</section>
				<GridDim on={desktop && bar.panel.open !== null} />
			</div>
		</div>
	)
}
