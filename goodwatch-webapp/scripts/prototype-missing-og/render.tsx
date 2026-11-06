// PROTOTYPE (throwaway, branch prototype/missing-og): draws card variants for pages that share another page's card
// today (blog posts, By your tropes, Hot on socials) and shows what the redirecting ones (/taste/everyone,
// /taste/fingerprint, /explore/...) preview as. Writes a gallery to prototype-missing-og-out/. Page data comes from the
// public site (?_data=, public APIs and today's /og/ cards), read only; no .env.
//
//   npm run prototype:missing-og                                    render, then serve the gallery (see serve.sh)
//   node_modules/.bin/vite-node scripts/prototype-missing-og/render.tsx    render only
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import { createElement } from "react"
import satori from "satori"
import { resolveTree } from "~/server/card-renderer/pool.server"
import { STATIC_PAGE_COPY } from "~/ui/og-image/copy"
import {
	type MissingCardContent,
	type MissingPageType,
	type MissingPoster,
	PrototypeMissingCard,
	VARIANTS,
} from "~/ui/og-image/PrototypeMissingCards"

const OUT = join(process.cwd(), "prototype-missing-og-out")
const CACHE = join(OUT, "cache")
mkdirSync(CACHE, { recursive: true })

const SITE = "https://goodwatch.app"
const TMDB = "https://image.tmdb.org/t/p"
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

// Remix answers a ?_data request for an unslugged title address with a 204 and X-Remix-Redirect.
async function fetchData(path: string, route: string): Promise<Buffer> {
	const url = `${SITE}${path}?_data=${encodeURIComponent(route)}`
	const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000) })
	const moved = response.headers.get("x-remix-redirect")
	if (moved) return fetchData(moved, route)
	if (!response.ok) throw new Error(`${response.status} ${url}`)
	return Buffer.from(await response.arrayBuffer())
}

const pageData = async (path: string, route: string) =>
	JSON.parse((await cached(`data${path}`, () => fetchData(path, route))).toString())

async function image(url: string | null) {
	if (!url) return null
	try {
		const data = await cached(url, () => fetchBuffer(url))
		return `data:image/jpeg;base64,${data.toString("base64")}`
	} catch (error) {
		console.warn("image failed", url, String(error))
		return null
	}
}

const gaps: string[] = []

interface TitleArt {
	poster: MissingPoster
	backdrop: string | null
}

async function movie(id: number): Promise<TitleArt> {
	const d = (await pageData(`/movie/${id}`, "routes/movie.$movieKey")).media.details
	return {
		poster: { title: d.title, src: await image(d.poster_path ? `${TMDB}/w342${d.poster_path}` : null) },
		backdrop: await image(d.backdrop_path ? `${TMDB}/w1280${d.backdrop_path}` : null),
	}
}

// --- Blog posts -----------------------------------------------------------------------------------------------------

interface BlogSample {
	path: string
	kind: string
	title: string
	dek: string
	/** TMDB movie ids the post names, in order. */
	titles: number[]
	mock?: boolean
}

// The one post on main, plus two made-up headlines (short and long) to see how each layout holds other posts.
const posts = JSON.parse(readFileSync("app/content/blog/posts.json", "utf8")) as { slug: string; title: string; kind: string }[]
const BLOG: BlogSample[] = posts.map((p) => {
	const text = readFileSync(`app/content/blog/${p.slug}/post.mdx`, "utf8")
	const ids = [...new Set([...text.matchAll(/\]\(\/movie\/(\d+)/g)].map((m) => Number(m[1])))]
	return {
		path: `/blog/${p.slug}`,
		kind: STATIC_PAGE_COPY[`/blog/${p.slug}`]?.tag ?? p.kind,
		title: p.title,
		dek: STATIC_PAGE_COPY[`/blog/${p.slug}`]?.subtitle ?? "",
		titles: ids,
	}
})
BLOG.push(
	{
		path: "/blog/letterboxd-vs-imdb (mock)",
		kind: "Data study",
		title: "Letterboxd loves it. IMDb doesn't.",
		dek: "Where the two crowds split hardest.",
		titles: [550, 680, 27205, 603],
		mock: true,
	},
	{
		path: "/blog/how-the-score-works (mock)",
		kind: "How it's built",
		title: "How four rating sites become one GoodWatch score, and why Rotten Tomatoes counts least",
		dek: "Four sources, one number.",
		titles: [155, 120, 13, 105],
		mock: true,
	},
)

async function blogContent(b: BlogSample): Promise<MissingCardContent> {
	const art = await Promise.all(b.titles.slice(0, 4).map(movie))
	if (art.length < 4) gaps.push(`${b.path}: names ${art.length} titles, the grid wants 4`)
	return {
		type: "blog",
		tag: b.kind,
		headline: b.title,
		subtitle: b.dek,
		backdrop: art.find((a) => a.backdrop)?.backdrop ?? null,
		hero: art[0]?.poster ?? { title: "", src: null },
		wall: art.map((a) => a.poster),
		entries: [],
		groups: [],
	}
}

// --- By your tropes -------------------------------------------------------------------------------------------------

// A shared link has no viewer, so the card shows example tropes. Each title below has the trope on its TV Tropes page
// (checked against /api/title-tropes on 2026-11-06).
const TROPE_ROWS = [
	{ label: "Chekhov's Gun", ids: [27205, 680, 329, 85] },
	{ label: "Bittersweet Ending", ids: [120, 13, 278, 857] },
	{ label: "Deadpan Snarker", ids: [105, 137, 155, 161] },
]
const TROPE_SINGLES = [
	{ label: "Chekhov's Gun", id: 27205 },
	{ label: "Large Ham", id: 155 },
	{ label: "Arc Words", id: 550 },
	{ label: "Bookends", id: 680 },
	{ label: "Running Gag", id: 105 },
]

async function checkTropes() {
	for (const { label, ids } of [...TROPE_ROWS, ...TROPE_SINGLES.map((s) => ({ label: s.label, ids: [s.id] }))]) {
		for (const id of ids) {
			const raw = await cached(`tropes${id}`, () => fetchBuffer(`${SITE}/api/title-tropes?type=movie&id=${id}`))
			const names = (JSON.parse(raw.toString()).tropes as { name: string }[]).map((t) => t.name)
			if (!names.includes(label)) gaps.push(`tropes: movie ${id} lacks "${label}"`)
		}
	}
}

async function tropesContent(): Promise<MissingCardContent> {
	await checkTropes()
	const copy = STATIC_PAGE_COPY["/watch/for-you"]
	const groups = await Promise.all(
		TROPE_ROWS.map(async (r) => ({ label: r.label, posters: (await Promise.all(r.ids.map(movie))).map((a) => a.poster) })),
	)
	const entries = await Promise.all(TROPE_SINGLES.map(async (s) => ({ label: s.label, poster: (await movie(s.id)).poster })))
	return {
		type: "tropes",
		tag: copy.tag,
		headline: "By your tropes",
		subtitle: "",
		backdrop: (await movie(27205)).backdrop,
		hero: entries[0].poster,
		wall: groups.flatMap((g) => g.posters),
		entries,
		groups,
	}
}

// --- Hot on socials -------------------------------------------------------------------------------------------------

interface HotTitle {
	title: string
	poster: string | null
	backdrop: string | null
	rank: number
	curve: number[]
}

async function hotContent(): Promise<MissingCardContent> {
	const d = await pageData("/hot", "routes/hot")
	const all: HotTitle[] = d.row?.titles ?? []
	const shown = all.filter((t) => t.poster)
	const dropped = all.slice(0, 5).filter((t) => !t.poster)
	if (dropped.length)
		gaps.push(`/hot: top five has titles without a poster, left off and the rest renumbered: ${dropped.map((t) => `#${t.rank} ${t.title}`).join(", ")}`)
	const top = await Promise.all(
		shown.slice(0, 5).map(async (t, i) => ({
			label: `#${i + 1}`,
			poster: { title: t.title, src: await image(`${TMDB}/w342${t.poster}`) },
			curve: t.curve,
			backdrop: t.backdrop,
		})),
	)
	const lead = shown.find((t) => t.backdrop)
	return {
		type: "hot",
		tag: "Talked about now",
		headline: "Hot on socials",
		subtitle: "",
		backdrop: await image(lead?.backdrop ? `${TMDB}/w1280${lead.backdrop}` : null),
		hero: top[0].poster,
		wall: top.map((t) => t.poster),
		entries: top,
		groups: [],
	}
}

// --- Pages that redirect --------------------------------------------------------------------------------------------

interface Sample {
	path: string
	type: MissingPageType
	load?: () => Promise<MissingCardContent>
	/** For redirecting pages: where previews land, whose card they show. */
	target?: string
	note?: string
}

const SAMPLES: Sample[] = [
	...BLOG.map((b) => ({ path: b.path, type: "blog" as const, load: () => blogContent(b), note: b.mock ? "mock headline" : "" })),
	{ path: "/watch/for-you/tropes", type: "tropes", load: tropesContent, note: "/for-you/tropes 301s here" },
	{ path: "/hot", type: "hot", load: hotContent, note: "/hot-on-socials 301s here" },
	{ path: "/taste/everyone", type: "taste", target: "/taste", note: "302 to /taste#everyone (members: their profile's Stats)" },
	{ path: "/taste/fingerprint", type: "taste", target: "/taste", note: "302 to /taste#fingerprint" },
	{ path: "/explore/movies/moods/scary", type: "explore", target: "/movies/moods/scary", note: "301 to /movies/moods/scary" },
	{ path: "/explore/tv/genres/comedy", type: "explore", target: "/shows/genres/comedy", note: "301 to /shows/genres/comedy" },
	{ path: "/explore/movies/streaming/netflix", type: "explore", target: "/movies/streaming/netflix", note: "301 to /movies/streaming/netflix" },
]

// Today's card for a path, as production serves it.
async function liveCard(path: string, file: string) {
	const data = await cached(`og${path}`, () => fetchBuffer(`${SITE}/og${path === "/" ? "/index" : path}.jpg?brand=D2`))
	writeFileSync(join(OUT, file), data)
}

const cards: { page: string; type: MissingPageType; variant: string; file: string }[] = []
const notes: Record<string, string> = {}
for (const s of SAMPLES) {
	notes[s.path] = s.note ?? ""
	// What a preview of the page shows today, for reference.
	const today = `${safe(s.path.slice(1))}-today.jpg`
	try {
		await liveCard(s.target ?? s.path, today)
		cards.push({ page: s.path, type: s.type, variant: "today", file: today })
	} catch (error) {
		if (!s.path.includes("(mock)")) gaps.push(`${s.path}: today's card failed (${String(error)})`)
	}
	if (!s.load) {
		for (const v of VARIANTS[s.type]) {
			const file = `${safe(s.path.slice(1))}-${v.key}.jpg`
			await liveCard(v.live || (s.target ?? s.path), file)
			cards.push({ page: s.path, type: s.type, variant: v.key, file })
		}
		continue
	}
	let content: MissingCardContent
	try {
		content = await s.load()
	} catch (error) {
		console.warn("page failed", s.path, String(error))
		gaps.push(`${s.path}: page data failed (${String(error)})`)
		continue
	}
	for (const v of VARIANTS[s.type]) {
		if (v.live !== undefined) {
			const file = `${safe(s.path.slice(1))}-${v.key}.jpg`
			await liveCard(v.live || (s.target ?? s.path), file)
			cards.push({ page: s.path, type: s.type, variant: v.key, file })
			continue
		}
		const element = createElement(PrototypeMissingCard, { variant: v.key, content })
		const svg = await satori(resolveTree(element) as never, { width: 1200, height: 630, fonts: FONTS as never })
		const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng()
		const file = `${safe(s.path.slice(1))}-${v.key}.png`
		writeFileSync(join(OUT, file), png)
		cards.push({ page: s.path, type: s.type, variant: v.key, file })
		console.log("drew", s.path, v.key)
	}
}

const TYPE_NAMES: Record<MissingPageType, string> = {
	blog: "Blog post (/blog/<slug>)",
	tropes: "By your tropes (/watch/for-you/tropes)",
	hot: "Hot on socials (/hot)",
	taste: "Taste sections (/taste/everyone, /taste/fingerprint): redirects, no card to draw",
	explore: "Former explore pages (/explore/<type>/<category>/<text>): redirects, no card to draw",
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PROTOTYPE missing link-preview cards</title>
<style>
body{margin:0;background:#111;color:#eee;font:15px/1.4 system-ui,sans-serif}
main{max-width:1240px;margin:0 auto;padding:16px 16px 60px}
h1{font-size:20px;margin:8px 0 4px} h2{font-size:17px;margin:28px 0 4px;color:#fbbf24} p{margin:0 0 12px;color:#aaa}
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px} .tabs a{color:#ccc;border:1px solid #333;border-radius:999px;padding:4px 10px;text-decoration:none;cursor:pointer}
.tabs a.on{background:#fbbf24;color:#0a0a0a;border-color:#fbbf24}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:18px}
figure{margin:0} img{width:100%;height:auto;border-radius:10px;display:block;background:#222}
figcaption{margin-top:6px;color:#bbb} figcaption a{color:#fbbf24;text-decoration:none} .note{color:#888}
</style></head><body><main>
<h1>Link-preview cards for pages without their own (prototype)</h1>
<p>Each page type has its own variants, keyed A–D. "Today" is the card a preview of that page shows now. Pick "By variant" to compare one design across pages, or a page to see every design for it.</p>
<div class="tabs" id="mode"></div>
<div id="out"></div>
</main>
<script>
const CARDS=${JSON.stringify(cards)};const VARIANTS=${JSON.stringify(VARIANTS)};const TYPES=${JSON.stringify(TYPE_NAMES)};const NOTES=${JSON.stringify(notes)};
const V="${Date.now()}";
const q=()=>new URLSearchParams(location.search);
const fig=(c,cap)=>'<figure><img loading="lazy" src="'+c.file+'?v='+V+'" alt="'+c.variant+' card for '+c.page+'"><figcaption>'+cap+'</figcaption></figure>';
const link=p=>(p.includes("(mock)")?p:'<a href="https://goodwatch.app'+p+'" target="_blank" rel="noopener">'+p+'</a>')+(NOTES[p]?' <span class="note">· '+NOTES[p]+'</span>':'');
const vname=(t,k)=>k==="today"?"What a preview shows today":VARIANTS[t].find(v=>v.key===k).name;
function render(){const s=q();const page=s.get("page");
const pages=[...new Set(CARDS.map(c=>c.page))];
document.getElementById("mode").innerHTML='<a href="?" class="'+(page?"":"on")+'">By variant</a>'+pages.map(p=>'<a href="?page='+encodeURIComponent(p)+'" class="'+(p===page?"on":"")+'">'+p+'</a>').join("");
let h="";
if(page){h+='<h2>'+link(page)+'</h2><div class="grid">'+CARDS.filter(c=>c.page===page).map(c=>fig(c,'<b>'+c.variant+'</b> — '+vname(c.type,c.variant))).join("")+'</div>';}
else for(const t of Object.keys(TYPES)){h+='<h2>'+TYPES[t]+'</h2>';
for(const k of ["today",...VARIANTS[t].map(v=>v.key)]){const cs=CARDS.filter(c=>c.type===t&&c.variant===k);if(!cs.length||(k==="today"&&(t==="taste"||t==="explore")))continue;
h+='<p><b style="color:#fbbf24">'+k+'</b> — '+vname(t,k)+'</p><div class="grid">'+cs.map(c=>fig(c,link(c.page))).join("")+'</div><br>';}}
document.getElementById("out").innerHTML=h}
render();
</script></body></html>`
writeFileSync(join(OUT, "index.html"), html)
console.log(`wrote ${cards.length} cards to ${OUT}`)
if (gaps.length) console.log(`data gaps:\n${gaps.join("\n")}`)
