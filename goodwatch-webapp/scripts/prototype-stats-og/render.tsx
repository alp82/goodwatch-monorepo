// PROTOTYPE (throwaway, branch prototype/stats-og): draws the /stats card variants from the live snapshot
// (https://goodwatch.app/stats?_data=routes/stats, read only; no .env) and writes a gallery to prototype-stats-og-out/.
//
//   npm run prototype:stats-og                                     render, then serve the gallery (see serve.sh)
//   node_modules/.bin/vite-node scripts/prototype-stats-og/render.tsx  render only
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import { createElement } from "react"
import satori from "satori"
import type { StatsSnapshot } from "~/domain/stats/snapshot"
import { resolveTree } from "~/server/card-renderer/pool.server"
import { PrototypeStatsCard, STATS_VARIANTS, type StatsCardContent } from "~/ui/og-image/PrototypeStatsCards"
import { MINUTES_PER_YEAR, count, hoursMinutes, short } from "~/ui/stats/format"

const OUT = join(process.cwd(), "prototype-stats-og-out")
const CACHE = join(OUT, "cache")
mkdirSync(CACHE, { recursive: true })

const fontDir = join(process.cwd(), "app/server/og-image/fonts")
const font = (file: string) => readFileSync(join(fontDir, file))
const FONTS = [
	{ name: "Gabarito", data: font("Gabarito-Regular.ttf"), weight: 400, style: "normal" },
	{ name: "Gabarito", data: font("Gabarito-Bold.ttf"), weight: 700, style: "normal" },
	{ name: "Gabarito", data: font("Gabarito-Black.ttf"), weight: 900, style: "normal" },
	{ name: "Anton", data: font("Anton-Regular.ttf"), weight: 400, style: "normal" },
] as const

const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "_")
async function cached(name: string, load: () => Promise<Buffer>) {
	const file = join(CACHE, safe(name))
	if (existsSync(file)) return readFileSync(file)
	const data = await load()
	writeFileSync(file, data)
	return data
}
async function fetchBuffer(url: string) {
	const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
	if (!response.ok) throw new Error(`${response.status} ${url}`)
	return Buffer.from(await response.arrayBuffer())
}
async function image(path: string | null) {
	if (!path) return null
	const url = `https://image.tmdb.org/t/p/w342${path}`
	try {
		return `data:image/jpeg;base64,${(await cached(url, () => fetchBuffer(url))).toString("base64")}`
	} catch (error) {
		console.warn("image failed", url, String(error))
		return null
	}
}

const raw = await cached("stats-snapshot.json", () => fetchBuffer("https://goodwatch.app/stats?_data=routes%2Fstats"))
const s: StatsSnapshot = JSON.parse(raw.toString()).snapshot
const c = s.catalog
const crowd =
	s.sources.imdbMovieVotes + s.sources.imdbShowVotes + s.sources.letterboxdRatings + s.sources.tmdbVotes + s.sources.metacriticUserRatings
const watchYears = Math.round((c.movieMinutes + c.episodeMinutes) / MINUTES_PER_YEAR)
const r = s.records
const posterTitles = [...r.topGoodwatchMovies, ...r.mostImdbVotesMovies, ...r.topGoodwatchShows, ...r.mostImdbVotesShows, ...r.highestLetterboxd, ...r.mostLetterboxdRatings]
const seen = new Set<string>()
const posters: string[] = []
for (const t of posterTitles) {
	if (!t.poster || seen.has(t.poster)) continue
	seen.add(t.poster)
	const img = await image(t.poster)
	if (img) posters.push(img)
}

const t = s.trivia
const made = new Date(s.generatedAt)
const exactYears = (c.movieMinutes + c.episodeMinutes) / MINUTES_PER_YEAR
const bieber = r.letterboxdOverImdb[0]
const quizTop = r.mostImdbVotesMovies.slice(0, 3)
const content: StatsCardContent = {
	fun: {
		bento: {
			big: { n: count(t.commonTitles[0].movies), text: `movies are called ${t.commonTitles[0].title}.` },
			small: [
				{ n: count(t.sharks), text: "shark movies" },
				{ n: hoursMinutes(r.longest[0].runtime), text: `${r.longest[0].title}, the longest movie` },
				{ n: count(s.people.mostCastCredits[0].credits), text: `roles for ${s.people.mostCastCredits[0].name}` },
				{ n: count(t.commonRoles[0].credits), text: `characters are just "${t.commonRoles[0].role}"` },
			],
		},
		vs: {
			title: bieber.title,
			year: bieber.year ?? 0,
			poster: await image(bieber.poster),
			left: { score: String(bieber.imdb), of: "/10", source: "IMDb" },
			right: { score: bieber.letterboxd.toFixed(2), of: "/5", source: "Letterboxd" },
		},
		quiz: {
			question: "Which movie has the most IMDb votes?",
			answers: await Promise.all([quizTop[1], quizTop[0], quizTop[2]].map(async (x) => ({ title: x.title, poster: await image(x.poster) }))),
		},
		counts: [
			{ n: count(t.christmas), text: "Christmas movies" },
			{ n: count(t.zombies), text: "zombie movies" },
			{ n: count(t.sharks), text: "shark movies" },
			{ n: count(t.friday13Horror), text: "Friday the 13th horrors" },
		],
		mix: [
			{ n: short(c.movies + c.shows), text: "movies and shows" },
			{ n: count(t.sharks), text: "shark movies" },
			{ n: String(watchYears), text: "years to watch them all" },
			{ n: `${Math.round(r.longest[0].runtime / 60)} h`, text: `${r.longest[0].title}, the longest movie` },
		],
		pressPlay: { year: Math.floor(made.getUTCFullYear() + made.getUTCMonth() / 12 - exactYears), years: watchYears },
	},
	hero: { n: `${watchYears} years`, line: "of watching: every movie and every episode on GoodWatch, back to back." },
	tiles: [
		{ n: short(c.movies), label: "movies" },
		{ n: short(c.episodes), label: "episodes" },
		{ n: short(crowd), label: "audience ratings" },
		{ n: short(s.streaming.offers), label: `streaming offers, ${s.streaming.countries} countries` },
		{ n: short(s.tropes.mentions), label: "trope mentions" },
		{ n: `${watchYears} yrs`, label: "to watch it all" },
	],
	records: [
		{ value: hoursMinutes(r.longest[0].runtime), label: "Longest movie", title: r.longest[0].title },
		{ value: count(r.mostEpisodes[0].episodes), label: "Most episodes", title: r.mostEpisodes[0].title },
		{ value: String(r.oldest[0].year), label: "Oldest film", title: r.oldest[0].title },
		{ value: short(r.mostImdbVotesMovies[0].votes), label: "Most IMDb votes", title: r.mostImdbVotesMovies[0].title },
		{ value: `$${short(r.highestGrossing[0].revenue)}`, label: "Highest grossing", title: r.highestGrossing[0].title },
	],
	posters,
	catalog: { movies: count(c.movies), shows: count(c.shows), episodes: count(c.episodes) },
	decades: s.charts.moviesByDecade,
	decadeTotal: count(s.charts.moviesByDecade.reduce((n, d) => n + d.titles, 0)),
	asOf: s.generatedAt.slice(0, 10),
}

const cards: { variant: string; name: string; file: string }[] = []
const ORDER = ["K", "F", "G", "H", "I", "J", "A", "B", "C", "D", "E"]
for (const { key, name } of [...STATS_VARIANTS].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))) {
	const svg = await satori(resolveTree(createElement(PrototypeStatsCard, { variant: key, content })) as never, {
		width: 1200,
		height: 630,
		fonts: FONTS as never,
	})
	const file = `stats-${key}.png`
	writeFileSync(join(OUT, file), new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng())
	cards.push({ variant: key, name, file })
	console.log("drew", key)
}

const v = Date.now()
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PROTOTYPE /stats link-preview cards</title>
<style>body{margin:0;background:#111;color:#eee;font:15px/1.4 system-ui,sans-serif}main{max-width:1240px;margin:0 auto;padding:16px 16px 60px}
h1{font-size:20px;margin:8px 0 4px}p{color:#aaa;margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:22px}
figure{margin:0}img{width:100%;height:auto;border-radius:10px;display:block}figcaption{margin-top:6px;color:#bbb}b{color:#fbbf24}</style></head>
<body><main><h1>Link-preview cards for /stats (prototype)</h1>
<p>Numbers from the live snapshot of ${content.asOf}. The I remix with mixed stats (K) comes first, then round 2 (F–J) uses the page's fun facts and says "stats"; round 1 (A–E) follows. "Today" is the card goodwatch.app/og/stats.png serves now.</p>
<div class="grid"><figure><img src="current.jpg?v=${v}" alt="current card"><figcaption><b>Today</b> — generic static card</figcaption></figure>
${cards.map((x) => `<figure><img src="${x.file}?v=${v}" alt="${x.variant}"><figcaption><b>${x.variant}</b> — ${x.name}</figcaption></figure>`).join("")}
</div></main></body></html>`
writeFileSync(join(OUT, "current.jpg"), await fetchBuffer("https://goodwatch.app/og/stats.png"))
writeFileSync(join(OUT, "index.html"), html)
console.log(`wrote ${cards.length} cards to ${OUT}`)
