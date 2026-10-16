// PROTOTYPE - throwaway (#659, map #652). How the groups of titles a member loves (production's Sides of you) appear
// on Watch next, inside its own controls: three variants on one member's real list, beside today's page.
// ?variant=today|moods|filter|because, ?as=owner|m1..m5 (members picked at runtime by rating count; "me" when signed
// in), ?list=all for the whole Wishlist (default: My movies), ?like=g1,g2 for the picked groups, plus Watch next's own
// moods, services, and time, and ?nt= for the titles passed with Not tonight. Read-only: nothing is written.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { MOOD_KEYS, type MoodKey } from "~/domain/moods"
import { swnView } from "~/server/prototype-sides-watch-next/index.server"
import { isVariant } from "~/ui/prototype-sides-watch-next/model"
import { SidesWatchNextPage } from "~/ui/prototype-sides-watch-next/page"
import { timeOf } from "~/ui/watch-next/labels"
import type { TitleKey } from "~/utils/title-key"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const p = new URL(request.url).searchParams
	const variant = p.get("variant")
	const list = p.get("list") === "all" ? "all" : "movies"
	const view = await swnView(request, {
		variant: isVariant(variant) ? variant : "today",
		slot: p.get("as"),
		list,
		moods: (p.get("moods") ?? "")
			.split(",")
			.filter((m): m is MoodKey => (MOOD_KEYS as readonly string[]).includes(m))
			.slice(0, 3),
		onMyServices: p.get("services") !== "all",
		time: list === "movies" ? timeOf(p.get("time")) : null,
		groups: (p.get("like") ?? "").split(",").filter(Boolean),
		passed: (p.get("nt") ?? "")
			.split(",")
			.map(Number)
			.filter((n) => Number.isFinite(n) && n > 0) as TitleKey[],
	})
	return json({ view }, { headers: { "Cache-Control": "private, no-store" } })
}

export const meta = () => [
	{ title: "What you love on Watch next, prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SidesWatchNextPrototype() {
	const { view } = useLoaderData<typeof loader>()
	return <SidesWatchNextPage view={view as never} />
}
