// Development only: the For you page on a synthetic sample (app/ui/for-you/sample-pool.ts), with gray posters and
// details answered from the same sample, so the page works without a member, Crate or Redis. ?as=guest|empty|
// unavailable shows the other states; ?recipe= preselects a recipe as on the real page. As a guest, ?ratings=N sets
// how many guest scores the preview reports (else the scores this browser holds). ?fail=details makes every details
// request fail (500), ?fail=details-401 as after a session ended, ?fail=details-once fails for 10 s from the first
// details request (long enough for the retries to give up), so Try again works after that. Returns 404 in production.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useLoaderData,
	useSearchParams,
} from "@remix-run/react"
import { useMemo } from "react"
import type { ForYouPage as ForYouPageData } from "~/domain/for-you-page/contract"
import { ForYouPage } from "~/ui/for-you/ForYouPage"
import type { GuestLoader } from "~/ui/for-you/GuestLock"
import { DetailsError, type DetailsLoader } from "~/ui/for-you/context"
import {
	sampleDetails,
	sampleGuest,
	samplePage,
} from "~/ui/for-you/sample-pool"

const STATES = ["ready", "guest", "empty", "unavailable"] as const
type State = (typeof STATES)[number]

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	const as = new URL(request.url).searchParams.get("as")
	const state: State = STATES.includes(as as State) ? (as as State) : "ready"
	return json(samplePage(state), {
		headers: { "Cache-Control": "private, no-store" },
	})
}

export const meta = () => [
	{ title: "For you sample - GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

/** Picking a recipe only rewrites ?recipe=; the data stays. */
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate,
}) => {
	const a = new URLSearchParams(currentUrl.search)
	const b = new URLSearchParams(nextUrl.search)
	const recipeOnly = a.get("recipe") !== b.get("recipe")
	a.delete("recipe")
	b.delete("recipe")
	if (
		recipeOnly &&
		currentUrl.pathname === nextUrl.pathname &&
		`${a}` === `${b}`
	)
		return false
	return defaultShouldRevalidate
}

let failingSince = 0
const failingDetails =
	(fail: string | null): DetailsLoader =>
	async (keys, signal) => {
		if (fail === "details" || fail === "details-401") {
			await new Promise((r) => setTimeout(r, 200))
			throw new DetailsError(fail === "details" ? 500 : 401)
		}
		if (fail === "details-once") {
			failingSince ||= Date.now()
			if (Date.now() - failingSince < 10_000) {
				await new Promise((r) => setTimeout(r, 200))
				throw new DetailsError(500)
			}
		}
		return sampleDetails(keys, signal)
	}

export default function DevForYouPage() {
	const data = useLoaderData<typeof loader>() as unknown as ForYouPageData
	const [params] = useSearchParams()
	const ratings = params.get("ratings")
	const fail = params.get("fail")
	const loadDetails = useMemo(
		() => (fail ? failingDetails(fail) : sampleDetails),
		[fail],
	)
	const loadGuest: GuestLoader = ({ interactions }) =>
		sampleGuest(
			ratings !== null
				? Math.max(0, Number(ratings) || 0)
				: interactions.filter((i) => i.type === "score").length,
		)
	return (
		<ForYouPage data={data} loadDetails={loadDetails} loadGuest={loadGuest} />
	)
}
