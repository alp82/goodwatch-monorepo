// Development only: the shared filter bar on the real catalog, before Discover uses it. The bar binds to this page's
// URL, counts come from /api/discover/results (so REC_FILTER_BAR must be on for the viewer), and the first page of
// titles shows as cards. For you is a local switch here; Discover owns it for real. Returns 404 in production.
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useFetcher,
	useLoaderData,
} from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import { useDiscoverResults } from "~/routes/api.discover_.results"
import { isEnabled } from "~/server/features.server"
import { loadTaste } from "~/server/taste/index.server"
import { NO_TASTE } from "~/server/taste/taste.server"
import {
	MAX_KEYS,
	type TitleCard,
	getTitleCards,
} from "~/server/title-cards.server"
import { type GuestProgress, getViewerContext } from "~/server/viewer.server"
import {
	FilterBar,
	ForYouExplanation,
	SLAB_CLEARANCE,
	useFilterState,
} from "~/ui/filter-bar"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { useUser } from "~/utils/auth"
import { snapshotGuestProgress } from "~/utils/guest-progress"

function notInProduction() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
}

export async function loader({ request }: LoaderFunctionArgs) {
	notInProduction()
	const ctx = await getViewerContext(request)
	const userId = ctx.viewer.kind === "member" ? ctx.viewer.userId : null
	return json({
		enabled: isEnabled("filterBar", { userId }),
		member: ctx.viewer.kind === "member",
		hasServices: ctx.services.length > 0,
	})
}

// The cards for one page of keys, for the viewer (a guest posts their progress).
export async function action({ request }: ActionFunctionArgs) {
	notInProduction()
	const body = (await request.json()) as {
		keys: number[]
		guest: GuestProgress | null
	}
	const ctx = await getViewerContext(request, body.guest ?? undefined)
	const userId = ctx.viewer.kind === "member" ? ctx.viewer.userId : null
	const taste = isEnabled("tasteMatch", { userId })
		? await loadTaste(ctx.viewer)
		: NO_TASTE
	const cards = await getTitleCards(body.keys.slice(0, MAX_KEYS), ctx, taste)
	return json({ cards })
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

export default function DevFilterBar() {
	const { enabled, member, hasServices } = useLoaderData<typeof loader>()
	const { user, loading } = useUser()
	const [forYouOn, setForYouOn] = useState(true)
	const [guest, setGuest] = useState<ReturnType<
		typeof snapshotGuestProgress
	> | null>(null)
	useEffect(() => {
		if (!loading && !user) setGuest(snapshotGuestProgress())
	}, [loading, user])
	// The viewer's defaults (see Shared filter bar in the spec); a guest's services and progress live in the browser.
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

	const results = useDiscoverResults({
		query: filters.query,
		forYou: forYouOn,
		guest,
		enabled: enabled && !loading && (Boolean(user) || guest !== null),
	})
	const data = results.data ?? null

	const cards = useFetcher<typeof action>()
	const keys = data?.keys.slice(0, 24).join(",") ?? ""
	// Loads cards when the page's titles change.
	useEffect(() => {
		if (!keys) return
		cards.submit(JSON.stringify({ keys: keys.split(",").map(Number), guest }), {
			method: "POST",
			encType: "application/json",
		})
	}, [keys])

	return (
		<div className={`mx-auto max-w-7xl px-4 pt-5 lg:pt-8 ${SLAB_CLEARANCE}`}>
			<h1 className="brand-header text-4xl text-white">Discover</h1>
			<p className="mt-1 text-xs text-gray-500">
				Filter bar preview · {member ? "member" : "guest"} ·{" "}
				{enabled
					? results.isFetching
						? "counting"
						: "live counts"
					: "REC_FILTER_BAR is off for this viewer, so there are no counts"}
			</p>
			<div className="mt-7">
				<FilterBar
					filters={filters}
					counts={data}
					forYou={{
						on: forYouOn,
						onChange: setForYouOn,
						movedUp: data?.movedUp ?? 0,
						explanation: (
							<ForYouExplanation
								on={forYouOn}
								leanings={data?.explanation?.leanings ?? []}
								ratings={data?.explanation?.ratings}
								movedUp={data?.movedUp ?? 0}
							/>
						),
					}}
				/>
			</div>
			<section className="mt-6 grid grid-cols-2 gap-3 xs:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:mt-7 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6">
				{(keys ? (cards.data?.cards ?? []) : ([] as TitleCard[])).map(
					(card) => (
						<TitlePosterCard key={card.key} card={card} />
					),
				)}
			</section>
		</div>
	)
}
