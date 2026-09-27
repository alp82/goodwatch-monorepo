// Development only: title cards from getTitleCards with the taste-match pill and its reasons, and the sign-up prompt
// in its three sizes and two stages, so they can be checked before a surface uses them. Members' cards come from the
// loader; a guest's browser posts its guest progress and gets its cards back. ?keys= takes title keys (at most 60).
// Returns 404 in production.
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useFetcher, useLoaderData, useLocation } from "@remix-run/react"
import { useEffect } from "react"
import { isEnabled } from "~/server/features.server"
import { loadTaste } from "~/server/taste/index.server"
import { NO_TASTE } from "~/server/taste/taste.server"
import {
	MAX_KEYS,
	type TitleCard,
	getTitleCards,
} from "~/server/title-cards.server"
import {
	type GuestProgress,
	type ViewerContext,
	getViewerContext,
} from "~/server/viewer.server"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { SIGN_UP_MESSAGES } from "~/ui/sign-up-prompt/messages"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { useUser } from "~/utils/auth"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import { titleKey } from "~/utils/title-key"

const MOVIES = [
	278, 238, 155, 680, 550, 27205, 157336, 603, 13, 424, 120, 11, 105, 862, 129,
	496243, 244786, 299534, 19995, 872585,
]
const SHOWS = [1399, 1396, 66732, 100088, 60059, 1668, 456, 76479, 2316, 1100]
const DEFAULT_KEYS = [
	...MOVIES.map((id) => titleKey("movie", id)),
	...SHOWS.map((id) => titleKey("show", id)),
]

interface CardsData {
	viewer: "member" | "guest"
	signal: "none" | "some"
	ratings: number
	liked: number
	ms: number
	cards: TitleCard[]
}

function notInProduction() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
}

function keysOf(request: Request) {
	const raw = new URL(request.url).searchParams.get("keys")
	const keys = raw
		? raw
				.split(",")
				.map(Number)
				.filter((key) => Number.isSafeInteger(key) && key > 0)
		: DEFAULT_KEYS
	return keys.slice(0, MAX_KEYS)
}

async function cardsFor(
	request: Request,
	viewer: ViewerContext,
): Promise<CardsData> {
	const started = performance.now()
	const userId = viewer.viewer.kind === "member" ? viewer.viewer.userId : null
	const taste = isEnabled("tasteMatch", { userId })
		? await loadTaste(viewer.viewer)
		: NO_TASTE
	const cards = await getTitleCards(keysOf(request), viewer, taste)
	return {
		viewer: viewer.viewer.kind,
		signal: taste.signal,
		ratings: taste.ratings,
		liked: taste.liked,
		ms: Math.round(performance.now() - started),
		cards,
	}
}

export async function loader({ request }: LoaderFunctionArgs) {
	notInProduction()
	return json(await cardsFor(request, await getViewerContext(request)))
}

export async function action({ request }: ActionFunctionArgs) {
	notInProduction()
	const guest = (await request.json()) as GuestProgress
	return json(await cardsFor(request, await getViewerContext(request, guest)))
}

export default function DevTitleCards() {
	const fromLoader = useLoaderData<typeof loader>()
	const guest = useFetcher<typeof action>()
	const { user, loading } = useUser()
	const { pathname, search } = useLocation()

	// A guest's taste lives in their browser, so their cards come from a POST with the guest progress.
	useEffect(() => {
		if (loading || user) return
		guest.submit(JSON.stringify(snapshotGuestProgress()), {
			method: "POST",
			action: pathname + search,
			encType: "application/json",
		})
	}, [loading, user, guest.submit, pathname, search])

	const data = guest.data ?? fromLoader
	const stage = data.signal === "some" ? "keep" : "learn"

	return (
		<div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-bold">Title cards</h1>
				<p className="text-sm text-gray-400" data-testid="summary">
					{data.viewer} · taste {data.signal} · {data.ratings} ratings,{" "}
					{data.liked} liked · {data.cards.length} cards in {data.ms} ms
					{guest.state !== "idle" && " · loading guest cards"}
				</p>
			</header>

			<section className="flex flex-col gap-4">
				<h2 className="text-lg font-bold">Sign-up prompt ({stage})</h2>
				<div className="flex flex-wrap items-center gap-4">
					<SignUpPrompt feature="bestMatch" stage={stage} size="inline" />
					<SignUpPrompt feature="forYou" stage={stage} size="chip" />
				</div>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{(Object.keys(SIGN_UP_MESSAGES) as (keyof typeof SIGN_UP_MESSAGES)[])
						.slice(0, 3)
						.map((feature) => (
							<SignUpPrompt
								key={feature}
								feature={feature}
								stage={stage}
								size="card"
							/>
						))}
				</div>
			</section>

			<section
				data-testid="cards"
				className="grid grid-cols-2 gap-3 xs:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6"
			>
				{data.cards.map((card) => (
					<TitlePosterCard key={card.key} card={card} />
				))}
			</section>
		</div>
	)
}
