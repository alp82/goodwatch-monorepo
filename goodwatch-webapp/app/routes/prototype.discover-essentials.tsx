// PROTOTYPE (throwaway, branch prototype/discover-essentials): Discover with On my services and Not seen yet off by
// default and side by side. A copy of dev.discover-bar with the fixture member on (`?as=guest` for a guest), three
// seeded services (Netflix, Prime Video, Disney Plus in the US; `?services=none` for none), and `?variant=` from
// ~/ui/discover-bar/prototype-essentials. Start: PORT=3190 bash scripts/dev-discover-bar.sh, open
// /prototype/discover-essentials. Not seen yet counts are the fixture's (simulated); services filter for real.
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
import { GridDim } from "~/ui/discover-bar/DiscoverPanel"
import {
	FIXTURE_TASTE_GROUPS,
	withMemberCounts,
} from "~/ui/discover-bar/dev-member-fixture"
import { renderFind } from "~/ui/discover-bar/find/FindResults"
import { renderSubTab } from "~/ui/discover-bar/sub-tabs"
import { useDesktop, useDiscoverBar } from "~/ui/discover-bar/useDiscoverBar"
import { YouTab } from "~/ui/discover-bar/you/YouTab"
import {
	TASTE_GROUPS_FIXTURE_ID,
	tasteGroupsKey,
} from "~/ui/discover-bar/you/taste-groups-key"
import { useForYou } from "~/ui/discover/useDiscoverBrowse"
import { useDiscoverSearch } from "~/ui/discover/useDiscoverSearch"
import { useFilterState } from "~/ui/filter-bar"
import { discoverSorts, sortShown, tasteStateOf } from "~/ui/filter-bar/labels"
import type { ForYouControl } from "~/ui/filter-bar/types"
import { useMyServices } from "~/ui/filter-bar/useFilterData"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { useUser } from "~/utils/auth"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import useLocale from "~/utils/locale"
import { CountTip } from "~/ui/discover-bar/prototype-essentials/CountTip"
import {
	ForYouExplanation,
	ForYouSort,
} from "~/ui/discover-bar/prototype-essentials/ForYouSort"
import {
	PillPair,
	VariantSwitcher,
	useVariant,
} from "~/ui/discover-bar/prototype-essentials/Essentials"

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

const SEED = { services: "8,9,337", country: "US" }
let seeded = false
function seed(none: boolean) {
	if (seeded || typeof window === "undefined") return
	seeded = true
	if (none) localStorage.removeItem("withStreamingProviders")
	else localStorage.setItem("withStreamingProviders", SEED.services)
	localStorage.setItem("country", SEED.country)
}

export default function PrototypeDiscoverEssentials() {
	const variant = useVariant()
	const [seedParams] = useSearchParams()
	seed(seedParams.get("services") === "none")
	const { user, loading } = useUser()
	const [params, setParams] = useSearchParams()
	const fixture = params.get("as") !== "guest"
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
		if (loading || user) return
		const snap = snapshotGuestProgress()
		// The fixture member's services travel in the guest body, so On my services filters the real catalog.
		setGuest(fixture ? { ...snap, interactions: [] } : snap)
	}, [loading, user, fixture])
	// The viewer's defaults, as on Discover; a guest's services and progress live in the browser. The loader reads no
	// settings, so a member's On my services starts off here.
	const defaults = useMemo(
		() => ({
			onMyServices: false,
			notSeenYet: false,
		}),
		[],
	)
	const filters = useFilterState({ defaults, member, searching })
	const bar = useDiscoverBar(filters.state)
	const ready = !loading && guest !== null

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
		guest,
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
			guest: guest ?? null,
		}),
		[scope, ranked, data, results.isPlaceholderData, searching, member, guest],
	)
	// The fixture member has taste, so Best match is open (the grid still comes back in the guest's order).
	const taste = fixture ? "ready" : tasteStateOf(data)
	const forYou: ForYouControl = {
		on: forYouState.on,
		onChange: forYouState.set,
		movedUp: 0,
		explanation: (
			<ForYouExplanation
				on={forYouState.on}
				searching={searching}
				bestMatch={filters.sort === "match"}
				movedUp={null}
			/>
		),
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
	const order = (
					<div className="shrink-0 max-lg:[&_[data-sort-button]>span.text-gray-400]:hidden">
						<ForYouSort
							forYou={forYou}
							compact={!desktop}
							quiet={variant === "I"}
							slim={variant === "G" || variant === "J"}
							sort={{
								options: discoverSorts(searching, taste),
								value: sortShown(filters.sort, searching, taste),
								onChange: (key) => filters.setSort(key as typeof filters.sort),
								footnote: searching ? undefined : "Relevance joins once you search.",
								align: "right",
							}}
						/>
					</div>
	)
	return (
		<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8 lg:pt-6">
			<div className={`flex items-center justify-between gap-x-6 gap-y-3 ${variant >= "F" ? "" : "flex-wrap"}`}>
				<h1 className="brand-header text-[23px] leading-tight text-white lg:text-[34px]">
					Discover movies and shows
				</h1>
				{(variant === "F" || variant === "H" || variant === "I") && desktop && order}
				{variant === "J" && desktop && (
					<CountTip counts={data} searching={searching} state={filters.state} />
				)}
				{variant === "D" && (
					<div className="max-lg:w-full">
						<PillPair
							p={{
								state: filters.state,
								update: filters.update,
								mine: services.providers,
								counts: data,
								member,
								open: bar.open,
							}}
							size={desktop ? "md" : "sm"}
							stretch={!desktop}
						/>
					</div>
				)}
			</div>
			<DiscoverControls
				className="mt-3 lg:mt-5"
				essentials={variant}
				phoneOrder={order}
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
				renderFind={renderFind}
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
			<VariantSwitcher />
		</div>
	)
}
