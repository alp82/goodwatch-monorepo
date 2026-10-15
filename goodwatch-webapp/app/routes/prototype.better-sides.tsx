// PROTOTYPE - throwaway (#657, map #652). Better Sides of you: four variants of how titles are grouped into sides,
// how sides are named, the edges just past a side, and how the Taste page shows them, beside today's production view.
// ?variant=today|tighter|anchored|moods|map, ?as=owner|m1..m5 (members picked at runtime by rating count; "me" when
// signed in). Read-only: nothing is written.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { protoView } from "~/server/prototype-better-sides/index.server"
import { isVariant } from "~/ui/prototype-better-sides/model"
import { BetterSidesPage } from "~/ui/prototype-better-sides/page"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	const variant = params.get("variant")
	const view = await protoView(request, isVariant(variant) ? variant : "today", params.get("as"))
	return json({ view }, { headers: { "Cache-Control": "private, no-store" } })
}

export const meta = () => [
	{ title: "Better Sides of you, prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function BetterSidesPrototype() {
	const { view } = useLoaderData<typeof loader>()
	return <BetterSidesPage view={view as never} />
}
