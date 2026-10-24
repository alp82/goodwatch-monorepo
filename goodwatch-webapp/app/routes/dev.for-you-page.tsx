// Development only: the For you page on a synthetic sample (app/ui/for-you/sample-pool.ts), with gray posters and
// details answered from the same sample, so the page works without a member, Crate or Redis. ?as=guest|empty|
// unavailable shows the other states; ?recipe= preselects a recipe as on the real page. Returns 404 in production.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import type { ForYouPage as ForYouPageData } from "~/domain/for-you-page/contract"
import { ForYouPage } from "~/ui/for-you/ForYouPage"
import { sampleDetails, samplePage } from "~/ui/for-you/sample-pool"

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

export default function DevForYouPage() {
	const data = useLoaderData<typeof loader>() as unknown as ForYouPageData
	return <ForYouPage data={data} loadDetails={sampleDetails} />
}
