// PROTOTYPE (throwaway, branch prototype/discover-og): draws the /discover card designs and a gallery into
// prototype-discover-og-out/. No .env, no server: posters come from TMDB, search answers are pasted from the live site.
//   npm run prototype:discover-og
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import { createElement } from "react"
import satori from "satori"
import { resolveTree } from "~/server/card-renderer/pool.server"
import { type DiscoverCardContent, PrototypeDiscoverCard, VARIANTS } from "~/ui/og-image/PrototypeDiscoverCards"

const OUT = join(process.cwd(), "prototype-discover-og-out")
const CACHE = join(OUT, "cache")
mkdirSync(CACHE, { recursive: true })
const fontDir = join(process.cwd(), "app/server/og-image/fonts")
const font = (file: string) => readFileSync(join(fontDir, file))
const FONTS = [
	{ name: "Gabarito", data: font("Gabarito-Regular.ttf"), weight: 400, style: "normal" },
	{ name: "Gabarito", data: font("Gabarito-Bold.ttf"), weight: 700, style: "normal" },
	{ name: "Gabarito", data: font("Gabarito-Black.ttf"), weight: 900, style: "normal" },
	{ name: "Anton", data: font("Anton-Regular.ttf"), weight: 400, style: "normal" },
]

async function poster(path: string) {
	const file = join(CACHE, path.slice(1))
	if (!existsSync(file)) {
		const response = await fetch(`https://image.tmdb.org/t/p/w342${path}`)
		if (!response.ok) throw new Error(`${response.status} ${path}`)
		writeFileSync(file, Buffer.from(await response.arrayBuffer()))
	}
	return `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`
}
const posters = (paths: string[]) => Promise.all(paths.map(poster))

const content: DiscoverCardContent = {
	main: {
		q: "vampires but funny",
		// What We Do in the Shadows (film, show), Dracula: Dead and Loving It, Renfield, Sundown, Vampires Suck
		posters: await posters(["/a2rD3i3DBMeYbA34rBv6z3B9S3a.jpg", "/wa3ZQE9kLnqwN3vQ0NNjg1NPsCa.jpg", "/5QmMhHdKpJ2eQp5i8NqopzGbw9r.jpg", "/p6yUjhvNGQpFZilKwOKbxQ1eHlo.jpg", "/azGQ5X7stOwG8mc9VhX4yRu56lY.jpg", "/ksPKfoXovAiFnBktkCBefsRQ8a1.jpg", "/e4RDjX46zJ0sfh5wZW1rrKkezXJ.jpg"]),
		// The search's own reading of the words, in its order, shortened.
		chips: [{ text: "Camp & Irony" }, { text: "Satire & Parody" }, { text: "Dark Humor" }, { text: "Fantasy" }, { text: "Low scare", avoid: true }, { text: "Low bleakness", avoid: true }],
	},
	others: [
		{ q: "Wednesday vibes, but darker", chips: [], posters: await posters(["/1EwNyiiNFd863H4e8nWEzutnZD7.jpg", "/n1ZRmjlk1BJTY7aASqACfPAaLn2.jpg", "/yAKNmpcUweGH6WMCEWenwU9PsbE.jpg"]) },
		{ q: "spy thrillers from the 70s", chips: [], posters: await posters(["/zinwtZqdb7gnc4zMu8dfkK1fMN3.jpg", "/uPNgubSiri2yvBQRPtP77ViYjN.jpg", "/vThgcb3JOj99yETg8WChuci4LV2.jpg"]) },
	],
}

for (const { key } of VARIANTS) {
	const element = createElement(PrototypeDiscoverCard, { variant: key, content })
	const svg = await satori(resolveTree(element) as never, { width: 1200, height: 630, fonts: FONTS as never })
	writeFileSync(join(OUT, `${key}.png`), new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng())
	console.log("drew", key)
}

// Round 2: B won; the same card with more popular searches (top results of each, odd ones left out).
const popular: { q: string; posters: string[] }[] = JSON.parse(readFileSync("scripts/prototype-discover-og/popular-searches.json", "utf8"))
const round2: { key: string; name: string }[] = []
for (const [i, search] of popular.entries()) {
	const key = `B${i + 1}`
	const main = { q: search.q, chips: [], posters: await posters(search.posters) }
	const element = createElement(PrototypeDiscoverCard, { variant: "B", content: { main, others: [] } })
	const svg = await satori(resolveTree(element) as never, { width: 1200, height: 630, fonts: FONTS as never })
	writeFileSync(join(OUT, `${key}.png`), new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng())
	round2.push({ key, name: search.q })
	console.log("drew", key)
}

writeFileSync(join(OUT, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PROTOTYPE /discover card</title><style>
body{margin:0;background:#111;color:#eee;font:15px/1.4 system-ui,sans-serif}main{max-width:1240px;margin:0 auto;padding:16px 16px 90px}
h1{font-size:18px;margin:8px 0 4px}p{color:#aaa;margin:0 0 16px}section{margin:0 0 34px}h2{font-size:16px;color:#fbbf24;margin:0 0 8px}
.big{width:100%;height:auto;border-radius:10px;display:block}.small{width:min(100%,400px);height:auto;border-radius:10px;display:block;margin-top:10px}
</style></head><body><main><h1>Link-preview card for /discover (prototype)</h1><p>Round 2: B with popular searches first (B1 to B3), round 1 below. Each design at full size, then at about feed size. Every search, poster and chip is a real answer from the live search.</p>
${[...round2, ...VARIANTS].map((v) => `<section id="${v.key}"><h2>${v.key} — ${v.name}</h2><img class="big" src="${v.key}.png?v=${Date.now()}" alt="Design ${v.key}"><img class="small" src="${v.key}.png?v=${Date.now()}" alt="Design ${v.key} at feed size"></section>`).join("")}
</main></body></html>`)
