// Development only: the Discover bar, its panel, the status line and the panel footer on the real catalog, before
// Discover uses them. The state binds to this page's URL (`q` is the search), counts come from /api/discover/results
// with the open sub-tab's `counts=` flags, and the first page of titles shows as cards. Sub-tabs come from
// ~/ui/discover-bar/sub-tabs; the ones without content yet show their empty slots. Returns 404 in production.
//
// The loader reads nothing, so the page also opens on a local server without databases; scripts/dev-discover-bar.sh
// starts one that reads the live site's public endpoints as a guest. `?fixture=member` shows the member state of You
// with a fixture member's taste groups and taste counts (dev-member-fixture.ts) over the guest's results.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useSearchParams,
} from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { searchEligibility, searchText } from "~/domain/discover-search"
import { useDiscoverResults } from "~/routes/api.discover_.results"
import { DiscoverControls } from "~/ui/discover-bar/DiscoverControls"
import {
	FIXTURE_TASTE_GROUPS,
	withMemberCounts,
} from "~/ui/discover-bar/dev-member-fixture"
import { GridDim } from "~/ui/discover-bar/DiscoverPanel"
import { renderSubTab } from "~/ui/discover-bar/sub-tabs"
import { useDesktop, useDiscoverBar } from "~/ui/discover-bar/useDiscoverBar"
import {
	TASTE_GROUPS_FIXTURE_ID,
	tasteGroupsKey,
} from "~/ui/discover-bar/you/taste-groups-key"
import { YouTab } from "~/ui/discover-bar/you/YouTab"
import { useForYou } from "~/ui/discover/useDiscoverBrowse"
import { useDiscoverSearch } from "~/ui/discover/useDiscoverSearch"
import { useFilterState } from "~/ui/filter-bar"
import { discoverSorts, sortShown, tasteStateOf } from "~/ui/filter-bar/labels"
import { useMyServices } from "~/ui/filter-bar/useFilterData"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import type { ForYouControl } from "~/ui/filter-bar/types"
import { useUser } from "~/utils/auth"
import useLocale from "~/utils/locale"
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
	const [params, setParams] = useSearchParams()
	const fixture = params.get("fixture") === "member"
	const member = Boolean(user) || fixture
	const queryClient = useQueryClient()
	const { locale } = useLocale()
	useEffect(() => {
		if (fixture)
			queryClient.setQueryData(
				tasteGroupsKey(locale.language, TASTE_GROUPS_FIXTURE_ID),
				FIXTURE_TASTE_GROUPS,
			)
	}, [fixture, queryClient, locale.language])
	const q = searchText(params.get("q"))
	const searching = q !== null
	const [guest, setGuest] = useState<ReturnType<
		typeof snapshotGuestProgress
	> | null>(null)
	useEffect(() => {
		if (!loading && !user && !fixture) setGuest(snapshotGuestProgress())
	}, [loading, user, fixture])
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

	// Where a search's On my services looks: the viewer's country and saved services.
	const services = useMyServices()
	const scope = useMemo(
		() => ({
			country: guest?.country || services.country || "US",
			services: services.ids,
		}),
		[guest?.country, services.country, services.ids],
	)
	const eligibility = useMemo(
		() => searchEligibility(filters.state, scope),
		[filters.state, scope],
	)
	const search = useDiscoverSearch({
		q,
		filters: eligibility,
		allTitles: false,
		enabled: ready,
	})
	// The fixture member saves nothing.
	const forYouState = useForYou({ member: Boolean(user), saved: true })
	const results = useDiscoverResults({
		query:
			searching && search.current
				? `${filters.query}${filters.query ? "&" : ""}ranked=${search.current.ranked.join(",")}`
				: filters.query,
		guest: member ? null : guest,
		counts: bar.counts,
		forYou: forYouState.on,
		enabled: ready && (!searching || Boolean(search.current)),
	})
	const data =
		fixture && results.data
			? withMemberCounts(results.data, filters.state)
			: (results.data ?? null)
	// The ranked list once the search has ranked; a partial list sent ahead of the ranking doesn't count.
	const ranked =
		searching && search.current && !search.partial
			? search.current.ranked
			: null
	const page = useMemo(
		() => ({
			scope,
			ranked,
			cards: data?.cards ?? [],
			countsFresh:
				Boolean(data) &&
				!results.isPlaceholderData &&
				(!searching || ranked !== null),
			guest: member || !guest ? null : guest,
		}),
		[scope, ranked, data, results.isPlaceholderData, searching, member, guest],
	)
	const taste = tasteStateOf(data)
	const forYou: ForYouControl = {
		on: forYouState.on,
		onChange: forYouState.set,
		movedUp: 0,
		explanation: null,
	}

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
				page={page}
				forYou={forYou}
				renderSubTab={(id, view) =>
					fixture && id === "taste" ? (
						<YouTab view={view} fixture />
					) : (
						renderSubTab(id, view)
					)
				}
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
