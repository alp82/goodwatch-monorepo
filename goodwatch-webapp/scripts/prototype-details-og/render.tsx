// PROTOTYPE (throwaway, branch prototype/details-og): draws every card variant for the title sub-pages
// (fingerprint, tropes, at a glance) of a few real titles and writes a gallery to prototype-details-og-out/.
// Page data comes from the public site (?_data=), read only; no .env.
//
//   npm run prototype:details-og                                       render, then serve the gallery (see serve.sh)
//   node_modules/.bin/vite-node scripts/prototype-details-og/render.tsx    render only
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import { createElement } from "react"
import satori from "satori"
import { POPULATION_MEDIANS } from "~/domain/fingerprint-effects/population-medians"
import { resolveTree } from "~/server/card-renderer/pool.server"
import { printAttributes, readTitle } from "~/ui/details/fingerprint-section/reading"
import { PrototypeSubCard, type SubCardContent, type SubKind, VARIANTS } from "~/ui/og-image/PrototypeDetailsSubCards"

const OUT = join(process.cwd(), "prototype-details-og-out")
const CACHE = join(OUT, "cache")
mkdirSync(CACHE, { recursive: true })

const TITLES = [
	"/movie/438631-dune",
	"/movie/496243-parasite",
	"/movie/346648-paddington-2",
	"/show/95396-severance",
	"/show/456-the-simpsons",
]
const SUBS: { kind: SubKind; seg: string }[] = [
	{ kind: "fingerprint", seg: "fingerprint" },
	{ kind: "tropes", seg: "tropes" },
	{ kind: "glance", seg: "at-a-glance" },
]

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
const imgUrl = (p: string | null | undefined, size: string) =>
	!p ? null : p.startsWith("http") ? p : `${TMDB}/${size}${p}`
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

const money = (n: number) =>
	n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${Math.round(n / 1e6)}M` : `$${Math.round(n / 1e3)}K`
const regions = new Intl.DisplayNames(["en"], { type: "region" })
const languages = new Intl.DisplayNames(["en"], { type: "language" })
const runtime = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim() : `${m} min`)

type TropeRow = { id: string; name: string; titles: number; lead: boolean }

async function contentOf(titlePath: string, kind: SubKind, seg: string): Promise<SubCardContent> {
	const type = titlePath.startsWith("/movie") ? "movie" : "show"
	const routeBase = type === "movie" ? "routes/movie.$movieKey_." : "routes/show.$showKey_."
	const d = await pageData(`${titlePath}/${seg}`, `${routeBase}${seg}`)
	const m = d.media
	const det = m.details
	const fp = m.fingerprint
	const reading = readTitle({
		title: det.title,
		mediaType: type,
		year: String(det.release_year ?? ""),
		genres: det.genres ?? [],
		fingerprint: fp,
	} as never)
	const content: SubCardContent = {
		kind,
		title: det.title,
		meta: `${type === "movie" ? "MOVIE" : "SHOW"} · ${det.release_year ?? ""}`,
		poster: await image(imgUrl(det.poster_path, "w500")),
		backdrop: await image(imgUrl(det.backdrop_path, "w1280")),
		fp: {
			attributes: printAttributes(fp.scores, POPULATION_MEDIANS[type] as never),
			axes: reading.axes.map((a) => ({ label: a.axis.label, strength: a.strength, color: a.color, bold: reading.bold.has(a.axis.id) })),
			rows: reading.rows.map((r) => ({ text: r.r.effect.name, color: r.color, k: r.k })),
		},
		tropes: { total: det.tropes_count ?? 0, names: [] },
		glance: { facts: [], directors: [], directorPhoto: null, stars: [], rated: null, advisories: [] },
	}
	if (kind === "tropes") {
		const q = d.dehydratedState.queries.find((x: { queryKey: unknown[] }) => x.queryKey[0] === "title-tropes")
		const data: { signature: string[]; total: number; tropes: TropeRow[] } = q.state.data
		const byId = new Map(data.tropes.map((t) => [t.id, t]))
		const sig = data.signature.map((id) => byId.get(id)).filter((t): t is TropeRow => !!t)
		// After the signature ones: the rarer tropes this title is named for first (fewest other titles).
		const rest = data.tropes.filter((t) => !sig.includes(t) && t.name.length <= 26).sort((a, b) => a.titles - b.titles)
		content.tropes = { total: data.total, names: [...sig, ...rest].map((t) => t.name) }
	}
	if (kind === "glance") {
		const rated = (det.age_certifications ?? []).find((c: string) => c.startsWith("US_"))?.slice(3) ?? null
		const facts: { label: string; value: string }[] = []
		facts.push({ label: type === "movie" ? "Released" : "First aired", value: String(det.release_year) })
		if (type === "movie" && det.runtime) facts.push({ label: "Runtime", value: runtime(det.runtime) })
		if (type === "show" && det.number_of_seasons)
			facts.push({ label: "Seasons", value: `${det.number_of_seasons} seasons` })
		if (type === "show" && det.number_of_episodes) facts.push({ label: "Episodes", value: `${det.number_of_episodes} episodes` })
		if (rated) facts.push({ label: "Rated", value: rated })
		if (det.production_country_codes?.[0]) facts.push({ label: "Made in", value: regions.of(det.production_country_codes[0]) ?? "" })
		if (det.original_language_code) facts.push({ label: "Language", value: languages.of(det.original_language_code) ?? "" })
		if (det.revenue > 0) facts.push({ label: "Box office", value: money(det.revenue) })
		if (det.budget > 0) facts.push({ label: "Budget", value: money(det.budget) })
		facts.push({ label: "Genres", value: (det.genres ?? []).slice(0, 2).join(", ") })
		const people = d.dehydratedState.queries.find((x: { queryKey: unknown[] }) => x.queryKey[3] === "crew")?.state.data.pages[0].rows ?? []
		const makerRows = people.filter((p: { roles: string[] }) => p.roles.some((r) => r === "Director" || r === "Creator"))
		const makers = makerRows.map((p: { name: string }) => p.name)
		content.glance = {
			facts,
			directors: makers.length ? makers : (m.crew?.directors ?? []).map((p: { name: string }) => p.name),
			stars: await Promise.all(
				(m.cast ?? []).slice(0, 5).map(async (p: { name: string; profile_path: string | null }) => ({
					name: p.name,
					photo: await image(imgUrl(p.profile_path, "w185")),
				})),
			),
			directorPhoto: await image(imgUrl(makerRows[0]?.profilePath, "w185")),
			rated,
			advisories: det.content_advisories ?? [],
		}
	}
	return content
}

const cards: { page: string; kind: SubKind; variant: string; file: string }[] = []
for (const title of TITLES)
	for (const { kind, seg } of SUBS) {
		const page = `${title}/${seg}`
		let content: SubCardContent
		try {
			content = await contentOf(title, kind, seg)
		} catch (error) {
			console.warn("page failed", page, String(error))
			continue
		}
		for (const { key } of VARIANTS[kind]) {
			try {
				const element = createElement(PrototypeSubCard, { variant: key, content })
				const svg = await satori(resolveTree(element) as never, { width: 1200, height: 630, fonts: FONTS as never })
				const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng()
				const file = `${safe(page.slice(1))}-${key}.png`
				writeFileSync(join(OUT, file), png)
				cards.push({ page, kind, variant: key, file })
				console.log("drew", page, key)
			} catch (error) {
				console.warn("draw failed", page, key, String(error))
			}
		}
	}

const KIND_NAMES: Record<SubKind, string> = {
	fingerprint: "Fingerprint (/movie/…/fingerprint)",
	tropes: "Tropes (/movie/…/tropes)",
	glance: "At a glance (/movie/…/at-a-glance)",
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PROTOTYPE title sub-page link-preview cards</title>
<style>
body{margin:0;background:#111;color:#eee;font:15px/1.4 system-ui,sans-serif}
main{max-width:1240px;margin:0 auto;padding:16px 16px 60px}
h1{font-size:20px;margin:8px 0 4px} h2{font-size:17px;margin:28px 0 4px;color:#fbbf24} p{margin:0 0 12px;color:#aaa}
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px} .tabs a{color:#ccc;border:1px solid #333;border-radius:999px;padding:4px 10px;text-decoration:none;cursor:pointer}
.tabs a.on{background:#fbbf24;color:#0a0a0a;border-color:#fbbf24}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:18px}
figure{margin:0} img{width:100%;height:auto;border-radius:10px;display:block;background:#222}
figcaption{margin-top:6px;color:#bbb} figcaption a{color:#fbbf24;text-decoration:none}
</style></head><body><main>
<h1>Link-preview cards for title sub-pages (prototype)</h1>
<p>Today /fingerprint, /tropes and /at-a-glance share the title's card. Each sub-page has its own variants, keyed A–D. "By variant" compares one design across titles; pick a page to see every design for it.</p>
<div class="tabs" id="mode"></div>
<div id="out"></div>
</main>
<script>
const CARDS=${JSON.stringify(cards)};const VARIANTS=${JSON.stringify(VARIANTS)};const KINDS=${JSON.stringify(KIND_NAMES)};
const V="${Date.now()}";
const q=()=>new URLSearchParams(location.search);
const fig=(c,cap)=>'<figure><img loading="lazy" src="'+c.file+'?v='+V+'" alt="'+c.variant+' card for '+c.page+'"><figcaption>'+cap+'</figcaption></figure>';
const link=p=>'<a href="https://goodwatch.app'+p+'" target="_blank" rel="noopener">'+p+'</a>';
function render(){const s=q();const page=s.get("page");
const pages=[...new Set(CARDS.map(c=>c.page))];
document.getElementById("mode").innerHTML='<a href="?" class="'+(page?"":"on")+'">By variant</a>'+pages.map(p=>'<a href="?page='+encodeURIComponent(p)+'" class="'+(p===page?"on":"")+'">'+p+'</a>').join("");
let h="";
if(page){const c0=CARDS.find(c=>c.page===page);const vs=VARIANTS[c0.kind];
h+='<h2>'+link(page)+'</h2><div class="grid">'+CARDS.filter(c=>c.page===page).map(c=>fig(c,'<b>'+c.variant+'</b> — '+vs.find(v=>v.key===c.variant).name)).join("")+'</div>';}
else for(const k of Object.keys(KINDS)){h+='<h2>'+KINDS[k]+'</h2>';
for(const v of VARIANTS[k]){h+='<p><b style="color:#fbbf24">'+v.key+'</b> — '+v.name+'</p><div class="grid">'+CARDS.filter(c=>c.kind===k&&c.variant===v.key).map(c=>fig(c,link(c.page))).join("")+'</div><br>';}}
document.getElementById("out").innerHTML=h}
render();
</script></body></html>`
writeFileSync(join(OUT, "index.html"), html)
console.log(`wrote ${cards.length} cards to ${OUT}`)
