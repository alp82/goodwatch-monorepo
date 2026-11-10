// PROTOTYPE (throwaway, branch prototype/yepwatch-og): draws every yepwatch.com link-preview card variant
// and writes a gallery to prototype-yepwatch-og-out/. Posters come from goodwatch.app (read only); rooms are
// sample invite previews (the same fields the public /invites/preview endpoint returns). No .env.
//
//   npm run prototype:yepwatch-og                                       render, then serve the gallery
//   node_modules/.bin/vite-node --config scripts/prototype-yepwatch-og/vite.config.ts scripts/prototype-yepwatch-og/render.tsx    render only
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import { createElement } from "react"
import satori from "satori"
import { resolveTree } from "~/server/card-renderer/pool.server"
import { H, PrototypeYepWatchCard, type RoomPreview, VARIANTS, W } from "~/ui/og-image/PrototypeYepWatchCards"

const OUT = join(process.cwd(), "prototype-yepwatch-og-out")
const CACHE = join(OUT, "cache")
mkdirSync(CACHE, { recursive: true })

const fontDir = join(process.cwd(), "app/server/og-image/fonts")
const font = (file: string) => readFileSync(join(fontDir, file))
const FONTS = [
	{ name: "Gabarito", data: font("Gabarito-Regular.ttf"), weight: 400, style: "normal" },
	{ name: "Gabarito", data: font("Gabarito-Bold.ttf"), weight: 700, style: "normal" },
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

const best = JSON.parse(
	(await cached("best-movies", () => fetchBuffer("https://goodwatch.app/movies/best?_data=routes%2F%24type.best"))).toString(),
)
const posters: string[] = []
for (const t of best.titles.slice(0, 12)) {
	const data = await cached(`poster${t.poster_path}`, () => fetchBuffer(`https://image.tmdb.org/t/p/w342${t.poster_path}`))
	posters.push(`data:image/jpeg;base64,${data.toString("base64")}`)
}

const ROOMS: { label: string; room: RoomPreview }[] = [
	{ label: "New room, one idea set", room: { hostName: "Alp", ideas: [{ text: "Cozy mystery" }, { text: "Under 2 hours" }], kinds: ["movie"], phase: "setup", people: 1 } },
	{
		label: "Busy room, choosing",
		room: { hostName: "Maya", ideas: [{ text: "Something funny" }, { text: "80s classics" }, { text: "No horror" }], kinds: ["movie", "show_start"], phase: "choosing", people: 4 },
	},
	{ label: "No host name, no ideas", room: { hostName: null, ideas: [], kinds: ["movie", "show_start", "show_continue"], phase: "setup", people: 2 } },
	{
		label: "Decided, long name and idea",
		room: { hostName: "Christopher Alexander", ideas: [{ text: "A slow-burn thriller with a twist we won't guess" }], kinds: ["show_start"], phase: "decided", people: 3 },
	},
]

type Card = { page: "start" | "room"; sample: string; variant: string; file: string }
const cards: Card[] = []
async function draw(page: "start" | "room", sample: string, variant: "A" | "B" | "C" | "D", room?: RoomPreview) {
	const element = createElement(PrototypeYepWatchCard, { page, variant, content: { posters, room } })
	const svg = await satori(resolveTree(element) as never, { width: W, height: H, fonts: FONTS as never })
	const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng()
	const file = `${page}-${safe(sample)}-${variant}.png`
	writeFileSync(join(OUT, file), png)
	cards.push({ page, sample, variant, file })
	console.log("drew", page, sample, variant)
}
for (const { key } of VARIANTS.start) await draw("start", "yepwatch.com", key)
for (const { label, room } of ROOMS) for (const { key } of VARIANTS.room) await draw("room", label, key, room)

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PROTOTYPE YepWatch link-preview cards</title>
<style>
body{margin:0;background:#111;color:#eee;font:15px/1.4 system-ui,sans-serif}
main{max-width:1240px;margin:0 auto;padding:16px 16px 60px}
h1{font-size:20px;margin:8px 0 4px} h2{font-size:17px;margin:28px 0 4px;color:#fbbf24} p{margin:0 0 12px;color:#aaa}
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px} .tabs a{color:#ccc;border:1px solid #333;border-radius:999px;padding:4px 10px;text-decoration:none}
.tabs a.on{background:#fbbf24;color:#0a0a0a;border-color:#fbbf24}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:18px}
figure{margin:0} img{width:100%;height:auto;border-radius:10px;display:block;background:#222}
figcaption{margin-top:6px;color:#bbb}
.chat{display:flex;gap:18px;flex-wrap:wrap} .bubble{width:300px;background:#1f2c34;border-radius:12px;padding:6px;color:#e9edef}
.bubble img{border-radius:8px} .bubble small{display:block;padding:6px 4px 2px;color:#8696a0}
</style></head><body><main>
<h1>Link-preview cards for yepwatch.com (prototype)</h1>
<p>Start page (yepwatch.com) and room invites (yepwatch.com/r/&lt;code&gt;). Room cards use the public invite preview: host name, ideas, kinds, phase, people. "By variant" compares one design across sample rooms; "Chat size" shows the cards as small as a messenger shows them.</p>
<div class="tabs" id="mode"></div>
<div id="out"></div>
</main>
<script>
const CARDS=${JSON.stringify(cards)};const VARIANTS=${JSON.stringify(VARIANTS)};const V="${Date.now()}";
const fig=(c,cap)=>'<figure><img loading="lazy" src="'+c.file+'?v='+V+'" alt="'+c.page+' card '+c.variant+' for '+c.sample+'"><figcaption>'+cap+'</figcaption></figure>';
const name=(p,k)=>VARIANTS[p].find(v=>v.key===k).name;
function render(){const s=new URLSearchParams(location.search);const mode=s.get("mode")||"variant";
document.getElementById("mode").innerHTML=[["variant","By variant"],["sample","By sample room"],["chat","Chat size"]].map(([k,l])=>'<a href="?mode='+k+'" class="'+(k===mode?"on":"")+'">'+l+'</a>').join("");
let h="";
if(mode==="variant"){for(const p of ["start","room"]){h+='<h2>'+(p==="start"?"Start page":"Room invite")+'</h2>';
for(const v of VARIANTS[p]){h+='<p><b style="color:#fbbf24">'+v.key+'</b> - '+v.name+'</p><div class="grid">'+CARDS.filter(c=>c.page===p&&c.variant===v.key).map(c=>fig(c,c.sample)).join("")+'</div><br>';}}}
else if(mode==="sample"){for(const sm of [...new Set(CARDS.map(c=>c.sample))]){const cs=CARDS.filter(c=>c.sample===sm);
h+='<h2>'+sm+'</h2><div class="grid">'+cs.map(c=>fig(c,'<b>'+c.variant+'</b> - '+name(c.page,c.variant))).join("")+'</div>';}}
else{for(const p of ["start","room"]){h+='<h2>'+(p==="start"?"Start page":"Room invite (first sample room)")+'</h2><div class="chat">';
const first=CARDS.find(c=>c.page===p).sample;
for(const c of CARDS.filter(c=>c.page===p&&c.sample===first))h+='<div class="bubble"><img src="'+c.file+'?v='+V+'" alt="'+c.variant+'"><small>'+c.variant+' - '+(p==="start"?"yepwatch.com":"Join my YepWatch room")+'</small></div>';
h+='</div>';}}
document.getElementById("out").innerHTML=h}
render();
</script></body></html>`
writeFileSync(join(OUT, "round1.html"), html)
console.log(`wrote ${cards.length} cards to ${OUT}`)
