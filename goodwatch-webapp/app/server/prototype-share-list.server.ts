// PROTOTYPE - throwaway. Data and PNG rendering for /prototype/share-list.
// Resolves "movie:603,show:1399" keys to catalog rows, serves prompt suggestions,
// and renders a list card to PNG with satori + resvg at the card's native size.
import { Resvg } from "@resvg/resvg-js"
import type { ReactElement } from "react"
import satori from "satori"
import { PROMPTS, type ListItem } from "~/ui/prototype-share-list/model"
import { query } from "~/utils/crate"

const TMDB = "https://image.tmdb.org/t/p"
const KEY = /^(movie|show):[1-9]\d{0,8}$/

type Row = {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	backdrop_path: string | null
	genres: string[] | null
	score: number | null
}
const COLS = `tmdb_id, title, release_year, poster_path, backdrop_path, genres,
	goodwatch_overall_score_normalized_percent AS score`

const toItem = (type: "movie" | "show", r: Row): ListItem => ({
	key: `${type}:${r.tmdb_id}`,
	type,
	title: r.title,
	year: r.release_year,
	poster: r.poster_path ? `${TMDB}/w500${r.poster_path}` : null,
	backdrop: r.backdrop_path ? `${TMDB}/w1280${r.backdrop_path}` : null,
	genre: r.genres?.[0] ?? null,
	score: r.score == null ? null : Math.round(r.score),
})

export const parseKeys = (raw: string | null) =>
	(raw ?? "")
		.split(",")
		.filter((k) => KEY.test(k))
		.slice(0, 10)

export async function resolveItems(keys: string[]): Promise<ListItem[]> {
	if (!keys.length) return []
	const byKey = new Map<string, ListItem>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const ids = keys.filter((k) => k.startsWith(`${type}:`)).map((k) => Number(k.split(":")[1]))
			if (!ids.length) return
			const rows = await query<Row>(`SELECT ${COLS} FROM ${type} WHERE tmdb_id IN (${ids.map(() => "?").join(",")})`, ids)
			for (const r of rows) byKey.set(`${type}:${r.tmdb_id}`, toItem(type, r))
		}),
	)
	return keys.map((k) => byKey.get(k)).filter((i): i is ListItem => !!i)
}

// Popular, well-rated titles per prompt so nobody starts from an empty search box.
let suggestionsPromise: Promise<Record<string, ListItem[]>> | null = null
export const getSuggestions = () => {
	suggestionsPromise ??= Promise.all(
		PROMPTS.map(async (p) => {
			const types = p.type === "all" ? (["movie", "show"] as const) : ([p.type] as const)
			const lists = await Promise.all(
				types.map(async (type) => {
					const genre = type === "movie" ? p.movieGenre : p.showGenre
					const rows = await query<Row>(
						`SELECT ${COLS} FROM ${type}
						 WHERE poster_path IS NOT NULL AND goodwatch_overall_score_voting_count >= 20000
						 ${genre ? "AND ? = ANY(genres)" : ""}
						 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT 48`,
						genre ? [genre] : [],
					)
					return rows.map((r) => toItem(type, r))
				}),
			)
			// Interleave movies and shows for mixed prompts.
			const merged = lists.length === 1 ? lists[0] : lists[0].flatMap((m, i) => [m, lists[1][i]]).filter(Boolean)
			return [p.id, merged.slice(0, 48)] as const
		}),
	)
		.then(Object.fromEntries)
		.catch((e) => {
			suggestionsPromise = null
			throw e
		})
	return suggestionsPromise
}

// --- Rendering ---

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700 | 800 | 900; style: "normal" | "italic" }

// Google Fonts serves WOFF (which satori reads) to old user agents. Take the latin subset.
const FAMILIES = [
	"Gabarito:wght@400;700;900",
	"Anton",
	"Space+Mono:wght@400;700",
	"Bricolage+Grotesque:opsz,wght@12..96,400;12..96,800",
	"Instrument+Serif:ital@0;1",
	"Playfair+Display:ital,wght@0,900;1,400;1,900",
	"VT323",
	"Permanent+Marker",
	"Rubik+Mono+One",
]
let fontsPromise: Promise<Font[]> | null = null
export const loadFonts = () => {
	fontsPromise ??= (async () => {
		const css = await (
			await fetch(`https://fonts.googleapis.com/css2?${FAMILIES.map((f) => `family=${f}`).join("&")}`, {
				headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Safari/534.30" },
			})
		).text()
		const blocks = css.split("/*").filter((b) => b.startsWith(" latin */"))
		return Promise.all(
			blocks.map(async (b) => ({
				name: /font-family: '([^']+)'/.exec(b)?.[1] ?? "",
				weight: Number(/font-weight: (\d+)/.exec(b)?.[1] ?? 400) as Font["weight"],
				style: (/font-style: (\w+)/.exec(b)?.[1] ?? "normal") as Font["style"],
				data: await (await fetch(/url\(([^)]+)\)/.exec(b)?.[1] ?? "")).arrayBuffer(),
			})),
		)
	})().catch((e) => {
		fontsPromise = null
		throw e
	})
	return fontsPromise
}

// Satori needs images inline. Swap every remote URL for a data URI, fetched in parallel.
const imageCache = new Map<string, Promise<string | null>>()
const toDataUri = (url: string) => {
	if (!imageCache.has(url))
		imageCache.set(
			url,
			fetch(url)
				.then(async (r) => (r.ok ? `data:${r.headers.get("content-type") ?? "image/jpeg"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}` : null))
				.catch(() => null),
		)
	return imageCache.get(url) as Promise<string | null>
}
export const inlineImages = (items: ListItem[]) =>
	Promise.all(
		items.map(async (i) => ({
			...i,
			poster: i.poster && (await toDataUri(i.poster)),
			backdrop: i.backdrop && (await toDataUri(i.backdrop)),
		})),
	)

export async function renderCardPng(element: ReactElement, width: number, height: number) {
	const svg = await satori(element, { width, height, fonts: await loadFonts() })
	return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng()
}
