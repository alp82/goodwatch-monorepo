// PROTOTYPE - throwaway. PNG (and JSON) endpoint for /prototype/share-list.
// /prototype/share-list-png?design=podium&t=Title&l=movie:603,show:1399&n=name&theme=ember
// Production would serve this from a stable list URL that also carries the OG image.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { inlineImages, parseKeys, renderCardPng, resolveItems } from "~/server/prototype-share-list.server"
import { DESIGNS } from "~/ui/prototype-share-list/designs"
import { cardQuery, THEMES, type ThemeKey } from "~/ui/prototype-share-list/model"

const cache = new Map<string, Promise<Buffer>>()

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	// Title search for the editor: two pages of TMDB multi-search, movies and shows only.
	if (params.get("format") === "search") {
		const q = (params.get("q") ?? "").trim().slice(0, 100)
		if (q.length < 2) return json({ results: [] })
		const pages = await Promise.all(
			[1, 2, 3].map(async (page) => {
				const res = await fetch(`https://api.themoviedb.org/3/search/multi?${new URLSearchParams({ api_key: process.env.TMDB_API_KEY ?? "", query: q, language: "en-US", include_adult: "false", page: String(page) })}`)
				return res.ok ? ((await res.json()).results ?? []) : []
			}),
		)
		const results = pages
			.flat()
			.filter((r: { media_type: string }) => r.media_type === "movie" || r.media_type === "tv")
			.map((r: { media_type: string }) => ({ ...r, media_type: r.media_type === "tv" ? "show" : r.media_type }))
		return json({ results })
	}
	const variant = params.get("design")
	const card = DESIGNS.find((d) => d.key === variant)
	if (!card) throw new Response("Unknown design", { status: 400 })
	const items = await resolveItems(parseKeys(params.get("l")))
	if (params.get("format") === "json") return json({ items })
	if (!items.length) throw new Response("Add at least one title", { status: 400 })

	const theme = (params.get("theme") ?? "ember") as ThemeKey
	const props = {
		title: (params.get("t") ?? "").slice(0, 80),
		name: (params.get("n") ?? "").slice(0, 28),
		theme: theme in THEMES ? theme : ("ember" as ThemeKey),
	}
	// Same key however the query is ordered; concurrent requests share one render.
	const key = cardQuery({ design: card.key, title: props.title, keys: items.map((i) => i.key), name: props.name, theme: props.theme })
	let render = cache.get(key)
	if (!render) {
		const started = Date.now()
		render = (async () => {
			const full = { ...props, items: await inlineImages(items.slice(0, card.max)), date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }
			const png = Buffer.from(await renderCardPng(<card.Card {...full} />, card.w, card.h))
			console.log(`[prototype-share-list] ${card.key} rendered in ${Date.now() - started} ms`)
			return png
		})()
		cache.set(key, render)
		render.catch(() => cache.delete(key))
	}
	const png = await render
	return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } })
}
