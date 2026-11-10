// PROTOTYPE (throwaway, branch prototype/yepwatch-og), round 2: start page C+D hybrids with the vote looks,
// static room invite cards. Poster treatments (wash, filter, bleed) are made with ImageMagick.
//
//   node_modules/.bin/vite-node --config scripts/prototype-yepwatch-og/vite.config.ts scripts/prototype-yepwatch-og/render2.tsx
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import { createElement } from "react"
import satori from "satori"
import { resolveTree } from "~/server/card-renderer/pool.server"
import { H, type PosterSet, PrototypeYepWatchCard2, VARIANTS2, W } from "~/ui/og-image/PrototypeYepWatchCards2"

const OUT = join(process.cwd(), "prototype-yepwatch-og-out")
const CACHE = join(OUT, "cache")
mkdirSync(CACHE, { recursive: true })

const fontDir = join(process.cwd(), "app/server/og-image/fonts")
const FONTS = [
	{ name: "Gabarito", data: readFileSync(join(fontDir, "Gabarito-Regular.ttf")), weight: 400, style: "normal" },
	{ name: "Gabarito", data: readFileSync(join(fontDir, "Gabarito-Bold.ttf")), weight: 700, style: "normal" },
] as const

const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "_")
async function fetchCached(name: string, url: string) {
	const file = join(CACHE, safe(name))
	if (!existsSync(file)) {
		const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
		if (!response.ok) throw new Error(`${response.status} ${url}`)
		writeFileSync(file, Buffer.from(await response.arrayBuffer()))
	}
	return file
}

const best = JSON.parse(readFileSync(await fetchCached("best-movies", "https://goodwatch.app/movies/best?_data=routes%2F%24type.best")).toString())
// Spirited Away, La La Land, Parasite, Pulp Fiction (colorful posters).
const PICK = [12, 37, 9, 16]

const TREAT: Record<Exclude<keyof PosterSet, "plain">, string[]> = {
	wash: ["-colorspace", "gray", "-sigmoidal-contrast", "3x50%", "-colorspace", "sRGB", "-type", "TrueColor", "(", "+clone", "-fill", "#fbbf24", "-draw", "color 0,0 reset", ")", "-compose", "multiply", "-composite"],
	washNope: ["-colorspace", "gray", "-sigmoidal-contrast", "3x50%", "-modulate", "90", "-colorspace", "sRGB", "-type", "TrueColor", "(", "+clone", "-fill", "#ef4444", "-draw", "color 0,0 reset", ")", "-compose", "multiply", "-composite"],
	warm: ["-modulate", "112,175", "(", "+clone", "-fill", "#ff9f1a", "-colorize", "100", ")", "-compose", "blend", "-define", "compose:args=18", "-composite"],
	cold: ["-colorspace", "gray", "-blur", "0x4", "-modulate", "50"],
	bleed: ["-resize", "60x90!", "-colorspace", "gray", "-blur", "0x5", "-resize", "400x600!", "-modulate", "150", "-colorspace", "sRGB", "-type", "TrueColor", "(", "+clone", "-fill", "#fbbf24", "-draw", "color 0,0 reset", ")", "-compose", "multiply", "-composite", "-modulate", "105,120"],
	bleedNope: ["-resize", "60x90!", "-colorspace", "gray", "-blur", "0x5", "-resize", "400x600!", "-colorspace", "sRGB", "-type", "TrueColor", "(", "+clone", "-fill", "#ef4444", "-draw", "color 0,0 reset", ")", "-compose", "multiply", "-composite"],
	gray: ["-colorspace", "gray", "-modulate", "65"],
}

const b64 = (file: string) => `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`
const posters: PosterSet[] = []
for (const i of PICK) {
	const t = best.titles[i]
	const plain = await fetchCached(`poster${t.poster_path}`, `https://image.tmdb.org/t/p/w500${t.poster_path}`)
	const set = { plain: b64(plain) } as PosterSet
	for (const [name, args] of Object.entries(TREAT)) {
		const out = join(CACHE, `${safe(t.poster_path)}-${name}.jpg`)
		if (!existsSync(out)) execFileSync("magick", [plain, ...args, "-type", "TrueColor", "-quality", "88", out])
		set[name as keyof PosterSet] = b64(out)
	}
	posters.push(set)
}

const HOSTS = [
	{ label: "Host Alp", host: "Alp" },
	{ label: "No host name", host: null },
	{ label: "Long host name", host: "Christopher Alexander" },
]

type Card = { page: "start" | "room"; sample: string; variant: string; file: string }
const cards: Card[] = []
async function draw(page: "start" | "room", sample: string, variant: string, host: string | null) {
	const element = createElement(PrototypeYepWatchCard2, { page, variant, content: { posters, host } })
	const svg = await satori(resolveTree(element) as never, { width: W, height: H, fonts: FONTS as never })
	const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng()
	const file = `r2-${page}-${safe(sample)}-${variant}.png`
	writeFileSync(join(OUT, file), png)
	cards.push({ page, sample, variant, file })
	console.log("drew", page, sample, variant)
}
const only = process.argv[2] // optional "start" or "room"
if (only !== "room") for (const [key] of VARIANTS2.start) await draw("start", "yepwatch.com", key, null)
if (only !== "start") for (const { label, host } of HOSTS) for (const [key] of VARIANTS2.room) await draw("room", label, key, host)

if (!only) {
	const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PROTOTYPE YepWatch link-preview cards, round 2</title>
<style>
body{margin:0;background:#111;color:#eee;font:15px/1.4 system-ui,sans-serif}
main{max-width:1240px;margin:0 auto;padding:16px 16px 60px}
h1{font-size:20px;margin:8px 0 4px} h2{font-size:17px;margin:28px 0 4px;color:#fbbf24} p{margin:0 0 12px;color:#aaa} a{color:#fbbf24}
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px} .tabs a{color:#ccc;border:1px solid #333;border-radius:999px;padding:4px 10px;text-decoration:none}
.tabs a.on{background:#fbbf24;color:#0a0a0a;border-color:#fbbf24}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:18px}
.grid3{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),1fr));gap:12px}
figure{margin:0} img{width:100%;height:auto;border-radius:10px;display:block;background:#222}
figcaption{margin-top:6px;color:#bbb}
.chat{display:flex;gap:14px;flex-wrap:wrap} .bubble{width:290px;background:#1f2c34;border-radius:12px;padding:6px;color:#e9edef}
.bubble img{border-radius:8px} .bubble small{display:block;padding:6px 4px 2px;color:#8696a0}
</style></head><body><main>
<h1>Link-preview cards for yepwatch.com, round 2 (prototype)</h1>
<p>Start page: C's vote demo in D's layout, one card per vote look. Room invites: no live status (people, phase, ideas), since apps cache previews; only the host name, plus how a room works. <a href="round1.html">Round 1</a></p>
<div class="tabs" id="mode"></div>
<div id="out"></div>
</main>
<script>
const CARDS=${JSON.stringify(cards)};const VARIANTS=${JSON.stringify(VARIANTS2)};const V="${Date.now()}";
const img=c=>'<img loading="lazy" src="'+c.file+'?v='+V+'" alt="'+c.page+' card '+c.variant+' ('+c.sample+')">';
const fig=(c,cap)=>'<figure>'+img(c)+'<figcaption>'+cap+'</figcaption></figure>';
function render(){const s=new URLSearchParams(location.search);const mode=s.get("mode")||"start";
document.getElementById("mode").innerHTML=[["start","Start page"],["room","Room invite"],["chat","Chat size"]].map(([k,l])=>'<a href="?mode='+k+'" class="'+(k===mode?"on":"")+'">'+l+'</a>').join("");
let h="";
if(mode==="start"){h+='<div class="grid">'+VARIANTS.start.map(([k,n])=>fig(CARDS.find(c=>c.page==="start"&&c.variant===k),'<b style="color:#fbbf24">'+k+'</b> - '+n)).join("")+'</div>';}
else if(mode==="room"){for(const [k,n] of VARIANTS.room){h+='<h2>'+k+' - '+n+'</h2><div class="grid3">'+CARDS.filter(c=>c.page==="room"&&c.variant===k).map(c=>fig(c,c.sample)).join("")+'</div>';}}
else{for(const p of ["start","room"]){h+='<h2>'+(p==="start"?"Start page":"Room invite (host Alp)")+'</h2><div class="chat">';
for(const c of CARDS.filter(c=>c.page===p&&(p==="start"||c.sample==="Host Alp")))h+='<div class="bubble">'+img(c)+'<small>'+c.variant+' - '+(p==="start"?"yepwatch.com":"Join my YepWatch room")+'</small></div>';
h+='</div>';}}
document.getElementById("out").innerHTML=h}
render();
</script></body></html>`
	writeFileSync(join(OUT, "index.html"), html)
}
console.log(`wrote ${cards.length} cards to ${OUT}`)
