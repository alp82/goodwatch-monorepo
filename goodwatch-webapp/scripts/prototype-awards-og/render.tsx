// PROTOTYPE (throwaway, branch prototype/awards-og): draws every /awards card variant for a few real pages and
// writes a gallery to prototype-awards-og-out/. Page data comes from the public site (?_data=), read only; no .env.
//
//   npm run prototype:awards-og                              render, then serve the gallery (see serve.sh)
//   node_modules/.bin/vite-node scripts/prototype-awards-og/render.tsx    render only
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import { createElement } from "react"
import satori from "satori"
import { resolveTree } from "~/server/card-renderer/pool.server"
import {
	type AwardCardContent,
	type AwardPageType,
	type AwardPoster,
	PrototypeAwardCard,
	VARIANTS,
} from "~/ui/og-image/PrototypeAwardCards"

const OUT = join(process.cwd(), "prototype-awards-og-out")
const CACHE = join(OUT, "cache")
mkdirSync(CACHE, { recursive: true })

const PAGES: { path: string; type: AwardPageType }[] = [
	{ path: "/awards", type: "hub" },
	{ path: "/awards/oscars", type: "body" },
	{ path: "/awards/emmys", type: "body" },
	{ path: "/awards/baeksang", type: "body" },
	{ path: "/awards/oscars/2026", type: "year" },
	{ path: "/awards/oscars/1973", type: "year" },
	{ path: "/awards/golden-globes/2025", type: "year" },
	{ path: "/awards/emmys/2025", type: "year" },
	{ path: "/awards/cesars/2026", type: "year" },
	{ path: "/awards/oscars/category/best-picture", type: "category" },
	{ path: "/awards/emmys/category/outstanding-drama-series", type: "category" },
	{ path: "/awards/bafta/category/best-film", type: "category" },
]

const ROUTES: Record<AwardPageType, string> = {
	hub: "routes/awards._index",
	body: "routes/awards.$body._index",
	year: "routes/awards.$body.$year",
	category: "routes/awards.$body.category.$category",
}

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

async function pageData(path: string, route: string) {
	const raw = await cached(`data${path}`, () =>
		fetchBuffer(`https://goodwatch.app${path}?_data=${encodeURIComponent(route)}`),
	)
	return JSON.parse(raw.toString())
}

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

interface Title {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	poster_path: string | null
	path: string
}

const poster = async (t: Title): Promise<AwardPoster> => ({
	title: t.title,
	src: await image(t.poster_path ? `${TMDB}/w342${t.poster_path}` : null),
})

// The title page's backdrop: the award data carries posters only.
async function backdrop(t: Title) {
	const route = t.media_type === "movie" ? "routes/movie.$movieKey" : "routes/show.$showKey"
	try {
		const d = await pageData(t.path, route)
		const path: string | null = d.media?.details?.backdrop_path ?? null
		return image(path ? `${TMDB}/w1280${path}` : null)
	} catch (error) {
		console.warn("backdrop failed", t.path, String(error))
		return null
	}
}

const unique = (titles: Title[]) => {
	const seen = new Set<string>()
	return titles.filter((t) => {
		const key = `${t.media_type}${t.tmdb_id}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

const posters = (titles: Title[]) => Promise.all(unique(titles).slice(0, 12).map(poster))

const gaps: string[] = []

async function hero(t: Title | undefined, label: string, page: string) {
	if (!t) {
		gaps.push(`${page}: no headline winner`)
		return { title: "", src: null, backdrop: null, label }
	}
	const p = await poster(t)
	const b = await backdrop(t)
	if (!p.src) gaps.push(`${page}: ${t.title} has no poster`)
	if (!b) gaps.push(`${page}: ${t.title} has no backdrop`)
	return { ...p, backdrop: b, label }
}

// The ledger's five rows: categories whose names fit one line, each with a different winner where it can.
function ledgerCategories<C extends { name: string; winners: Title[] }>(categories: C[]) {
	const short = categories.filter((c) => c.name.length <= 32)
	const pool = short.length >= 5 ? short : categories
	const seen = new Set<string>()
	const distinct = pool.filter((c) => {
		const key = c.winners[0].title
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
	return [...distinct, ...pool.filter((c) => !distinct.includes(c))].slice(0, 5)
}

type Body = { slug: string; name: string; official: string; kind: string }

const HUB_ORDER = ["oscars", "emmys", "golden-globes", "bafta", "cesars"]

async function contentOf(path: string, type: AwardPageType): Promise<AwardCardContent> {
	const d = await pageData(path, ROUTES[type])
	if (type === "hub") {
		const recent: { body: Body; year: number; winners: Title[] }[] = [...d.recent].sort(
			(a, b) => HUB_ORDER.indexOf(a.body.slug) - HUB_ORDER.indexOf(b.body.slug),
		)
		const shown = recent.filter((r) => HUB_ORDER.includes(r.body.slug))
		return {
			type,
			tag: "Film and TV awards",
			headline: "Award winners",
			bodyName: "",
			year: null,
			hero: await hero(shown[0]?.winners[0], "", path),
			wall: await posters(recent.flatMap((r) => r.winners)),
			entries: await Promise.all(
				shown.map(async (r) => ({ label: r.body.name, ledger: `${r.body.name} ${r.year}`, poster: await poster(r.winners[0]) })),
			),
		}
	}
	const body: Body = d.body
	if (type === "body") {
		const results: { category: string; slug: string; winner: Title }[] = d.latest.results
		const headline = results[0]
		const category = await pageData(`/awards/${body.slug}/category/${headline.slug}`, ROUTES.category)
		const years: { year: number; winners: Title[] }[] = category.years
		return {
			type,
			tag: body.official !== body.name ? body.official : body.kind,
			headline: `${body.name} winners`,
			bodyName: body.name,
			year: d.latest.year,
			hero: await hero(headline.winner, headline.category, path),
			wall: await posters([...results.map((r) => r.winner), ...years.flatMap((y) => y.winners)]),
			entries: await Promise.all(
				years.filter((y) => y.winners[0]).slice(0, 6).map(async (y) => ({ label: String(y.year), poster: await poster(y.winners[0]) })),
			),
		}
	}
	if (type === "year") {
		const categories: { name: string; winners: Title[] }[] = d.categories.filter(
			(c: { winners: Title[] }) => c.winners.length,
		)
		return {
			type,
			tag: body.official,
			headline: `${body.name} ${d.year}`,
			bodyName: body.name,
			year: d.year,
			hero: await hero(categories[0]?.winners[0], categories[0]?.name ?? "", path),
			wall: await posters(categories.flatMap((c) => c.winners)),
			entries: await Promise.all(ledgerCategories(categories).map(async (c) => ({ label: c.name, poster: await poster(c.winners[0]) }))),
		}
	}
	const years: { year: number; winners: Title[] }[] = d.years.filter((y: { winners: Title[] }) => y.winners.length)
	return {
		type,
		tag: body.name,
		headline: d.name,
		bodyName: body.name,
		year: years[0]?.year ?? null,
		hero: await hero(years[0]?.winners[0], String(years[0]?.year ?? ""), path),
		wall: await posters(years.flatMap((y) => y.winners)),
		entries: await Promise.all(
			years.slice(0, 6).map(async (y) => ({ label: String(y.year), poster: await poster(y.winners[0]) })),
		),
	}
}

const cards: { page: string; type: AwardPageType; variant: string; file: string }[] = []
for (const { path, type } of PAGES) {
	let content: AwardCardContent
	try {
		content = await contentOf(path, type)
	} catch (error) {
		console.warn("page failed", path, String(error))
		gaps.push(`${path}: page data failed (${String(error)})`)
		continue
	}
	for (const { key } of VARIANTS[type]) {
		const element = createElement(PrototypeAwardCard, { variant: key, content })
		const svg = await satori(resolveTree(element) as never, { width: 1200, height: 630, fonts: FONTS as never })
		const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng()
		const file = `${safe(path.slice(1))}-${key}.png`
		writeFileSync(join(OUT, file), png)
		cards.push({ page: path, type, variant: key, file })
		console.log("drew", path, key)
	}
}

const TYPE_NAMES: Record<AwardPageType, string> = {
	hub: "Hub (/awards)",
	body: "Award body (/awards/oscars)",
	year: "Ceremony year (/awards/oscars/2026)",
	category: "Category across years (/awards/oscars/category/best-picture)",
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PROTOTYPE /awards link-preview cards</title>
<style>
body{margin:0;background:#111;color:#eee;font:15px/1.4 system-ui,sans-serif}
main{max-width:1240px;margin:0 auto;padding:16px 16px 60px}
h1{font-size:20px;margin:8px 0 4px} h2{font-size:17px;margin:28px 0 4px;color:#fbbf24} p{margin:0 0 12px;color:#aaa}
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px} .tabs a{color:#ccc;border:1px solid #333;border-radius:999px;padding:4px 10px;text-decoration:none;cursor:pointer}
.tabs a.on{background:#fbbf24;color:#0a0a0a;border-color:#fbbf24}
ul.keys{margin:0 0 14px;padding-left:18px;color:#bbb} ul.keys b{color:#fbbf24}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:18px}
figure{margin:0} img{width:100%;height:auto;border-radius:10px;display:block;background:#222}
figcaption{margin-top:6px;color:#bbb} figcaption a{color:#fbbf24;text-decoration:none}
</style></head><body><main>
<h1>Link-preview cards for /awards pages (prototype)</h1>
<p>Each page type has its own variants, keyed A–D. Pick "By variant" to compare one design across pages, or "By page" to see every design for one page.</p>
<div class="tabs" id="mode"></div>
<div id="out"></div>
</main>
<script>
const CARDS=${JSON.stringify(cards)};const VARIANTS=${JSON.stringify(VARIANTS)};const TYPES=${JSON.stringify(TYPE_NAMES)};
const V="${Date.now()}";
const q=()=>new URLSearchParams(location.search);
const fig=(c,cap)=>'<figure><img loading="lazy" src="'+c.file+'?v='+V+'" alt="'+c.variant+' card for '+c.page+'"><figcaption>'+cap+'</figcaption></figure>';
const link=p=>'<a href="https://goodwatch.app'+p+'" target="_blank" rel="noopener">'+p+'</a>';
function render(){const s=q();const page=s.get("page");
const pages=[...new Set(CARDS.map(c=>c.page))];
document.getElementById("mode").innerHTML='<a href="?" class="'+(page?"":"on")+'">By variant</a>'+pages.map(p=>'<a href="?page='+encodeURIComponent(p)+'" class="'+(p===page?"on":"")+'">'+p+'</a>').join("");
let h="";
if(page){const c0=CARDS.find(c=>c.page===page);const vs=VARIANTS[c0.type];
h+='<h2>'+link(page)+'</h2><div class="grid">'+CARDS.filter(c=>c.page===page).map(c=>fig(c,'<b>'+c.variant+'</b> — '+vs.find(v=>v.key===c.variant).name)).join("")+'</div>';}
else for(const t of Object.keys(TYPES)){h+='<h2>'+TYPES[t]+'</h2>';
for(const v of VARIANTS[t]){h+='<p><b style="color:#fbbf24">'+v.key+'</b> — '+v.name+'</p><div class="grid">'+CARDS.filter(c=>c.type===t&&c.variant===v.key).map(c=>fig(c,link(c.page))).join("")+'</div><br>';}}
document.getElementById("out").innerHTML=h}
render();
</script></body></html>`
writeFileSync(join(OUT, "index.html"), html)
console.log(`wrote ${cards.length} cards to ${OUT}`)
if (gaps.length) console.log(`data gaps:\n${gaps.join("\n")}`)
