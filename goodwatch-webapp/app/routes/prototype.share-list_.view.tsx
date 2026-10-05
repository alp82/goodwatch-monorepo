// PROTOTYPE - throwaway. The page a shared list link opens: the card, big, plus a way to make your own.
// Its og:image is the card PNG, which the editor has usually rendered already.
import { json, type LinksFunction, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import { parseKeys, resolveItems } from "~/server/prototype-share-list.server"
import { designByKey } from "~/ui/prototype-share-list/designs"
import { Scaled } from "~/ui/prototype-share-list/editor-kit"
import { CARD_FONTS, cardQuery, THEMES, type ThemeKey } from "~/ui/prototype-share-list/model"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const url = new URL(request.url)
	const params = url.searchParams
	const design = designByKey(params.get("design"))
	const items = await resolveItems(parseKeys(params.get("l")))
	const theme = params.get("theme") as ThemeKey
	const list = {
		title: (params.get("t") ?? "").slice(0, 80),
		name: (params.get("n") ?? "").slice(0, 28),
		theme: theme in THEMES ? theme : ("ember" as ThemeKey),
		items,
		promptId: "",
	}
	const query = cardQuery({ design: design.key, title: list.title, keys: items.map((i) => i.key), name: list.name, theme: list.theme })
	const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
	return json({ designKey: design.key, list, date, image: `${url.origin}/prototype/share-list-png?${query}`, page: url.href })
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: CARD_FONTS }]

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return []
	const title = `${data.list.title || "A top list"}${data.list.name ? ` by ${data.list.name}` : ""} · GoodWatch`
	const description = data.list.items.slice(0, 5).map((i, n) => `${n + 1}. ${i.title}`).join("  ")
	const design = designByKey(data.designKey)
	return [
		{ title },
		{ name: "robots", content: "noindex, nofollow" },
		{ name: "description", content: description },
		{ property: "og:type", content: "website" },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: data.page },
		{ property: "og:image", content: data.image },
		{ property: "og:image:width", content: String(design.w) },
		{ property: "og:image:height", content: String(design.h) },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:image", content: data.image },
	]
}

export default function SharedList() {
	const { designKey, list, date } = useLoaderData<typeof loader>()
	const design = designByKey(designKey)
	const t = THEMES[list.theme]
	return (
		<div className="relative flex h-[calc(100dvh-4rem)] flex-col items-center gap-5 overflow-hidden bg-neutral-950 px-4 pt-6 pb-6 text-white max-lg:h-[calc(100dvh-8rem)]">
			<div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: `radial-gradient(ellipse at 50% 35%, ${t.accent}33 0%, transparent 60%)` }} />
			<div className="relative min-h-0 w-full flex-1">
				<Scaled design={design} list={list} date={date} fill className="rounded-[18px] shadow-2xl shadow-black/60" />
			</div>
			<div className="relative flex flex-col items-center gap-2 text-center">
				<Link
					to="/prototype/share-list?variant=flip"
					className="rounded-full px-6 py-3 text-lg font-black text-black transition hover:brightness-110"
					style={{ backgroundImage: `linear-gradient(90deg, ${t.accent}, ${t.accent2})` }}
				>
					Make your own list
				</Link>
				<p className="text-sm text-neutral-500">Rank your favorite movies and shows. It takes a minute.</p>
			</div>
		</div>
	)
}
