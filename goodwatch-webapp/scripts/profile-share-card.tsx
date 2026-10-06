// Times share list card renders, to see what a card costs and where the time goes.
//
//   npx vite-node scripts/profile-share-card.tsx                    every design, through the renderer's child process
//   npx vite-node scripts/profile-share-card.tsx podium marquee     only the named designs
//   npx vite-node scripts/profile-share-card.tsx --stages podium    the stages of one render in this process: layout,
//                                                                   filter regions, rasterizer, encoders
//   RUNS=5                    renders per design and state (default 5)
//   OUT=/tmp/cards            also writes each design's card PNG and preview JPEG there
//   LIST_ID=<list id>         renders that list instead of the sample titles. Needs the webapp's environment:
//                             set -a; source .env; set +a. Reads Crate, writes nothing.
//   FIND_PUBLIC=1             prints the ids and designs of the newest public lists, then exits
//
// "cold" is a render in a renderer child that has just started, "warm" a render in a child that has rendered before.
// Posters and backdrops are downloaded once, before the first timed render, and that time is printed on its own.
// Wall times depend on what else the machine does. "cpu" in the stage output is this process's CPU time and moves less.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"
import jpeg from "jpeg-js"
import { createElement } from "react"
import satori from "satori"
import { resolveTree } from "~/server/card-renderer/pool.server"
import { tightenShadowFilters } from "~/server/card-renderer/svg-filters.js"
import { toDataUri } from "~/server/og-image/render.server"
import { PREVIEW_QUALITIES, renderShareCard, stopShareCardRenderers } from "~/server/share-card/render.server"
import { DESIGNS, designByKey } from "~/ui/share-card/designs"
import { CARD_FONTS } from "~/ui/share-card/fonts"
import { SHARE_CARD_PREVIEW } from "~/ui/share-card/links"
import { type CardDesign, type CardProps, type CardTitle, cardDate, listByline } from "~/ui/share-card/model"

const TMDB = "https://image.tmdb.org/t/p"
const sample = (key: string, title: string, year: number, poster: string, backdrop: string, genre: string, score: number): CardTitle => ({
	key,
	type: key.startsWith("movie") ? "movie" : "show",
	title,
	year,
	poster: `${TMDB}/w500${poster}`,
	backdrop: `${TMDB}/w1280${backdrop}`,
	genre,
	score,
})
const SAMPLE: Omit<CardProps, "editing"> = {
	title: "The best sci-fi of all time",
	name: "@cinephile",
	theme: "ember",
	date: "Sep 25, 2026",
	items: [
		sample("movie:278", "The Shawshank Redemption", 1994, "/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg", "/pNjh59JSxChQktamG3LMp9ZoQzp.jpg", "Drama", 94),
		sample("show:1399", "Game of Thrones", 2011, "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg", "/zZqpAXxVSBtxV9qPBcscfXBcL2w.jpg", "Sci-Fi & Fantasy", 85),
		sample("movie:27205", "Inception", 2010, "/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg", "/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg", "Action", 90),
		sample("show:66732", "Stranger Things", 2016, "/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg", "/9P4IIMYY3HifqeruZq0ZZ9g7YUi.jpg", "Drama", 85),
		sample("movie:157336", "Interstellar", 2014, "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg", "/8sNiAPPYU14PUepFNeSNGUTiHW.jpg", "Adventure", 86),
	],
}

const runs = Number(process.env.RUNS) || 5
const out = process.env.OUT
if (out) mkdirSync(out, { recursive: true })
const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const spread = (values: number[]) => `${Math.round(median(values))} ms (${Math.round(Math.min(...values))} to ${Math.round(Math.max(...values))})`

if (process.env.FIND_PUBLIC) {
	const { query } = await import("~/utils/crate")
	const rows = await query<{ id: string; design: string }>("SELECT id, design FROM doc.user_list WHERE visibility = 'public' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 20", [])
	for (const row of rows) console.log(row.id, row.design)
	process.exit(0)
}

// The list to render: a real one by id, or the sample titles in every named design.
async function cards(): Promise<{ design: CardDesign; props: Omit<CardProps, "editing"> }[]> {
	const named = process.argv.slice(2).filter((arg) => !arg.startsWith("--"))
	const listId = process.env.LIST_ID
	if (!listId) return (named.length ? DESIGNS.filter((d) => named.includes(d.key)) : DESIGNS).map((design) => ({ design, props: SAMPLE }))
	const { getList, getProfileByUserId } = await import("~/server/share-lists/view.server")
	const { resolveCardTitles } = await import("~/server/share-lists/titles.server")
	const list = await getList(listId)
	const owner = list && (await getProfileByUserId(list.userId))
	if (!list || !owner) throw new Error("List not found")
	const props = { title: list.title, name: listByline(owner.handle), theme: list.theme, items: await resolveCardTitles(list.items), date: cardDate(new Date(list.createdAt)) }
	return (named.length ? named.map(designByKey) : [designByKey(list.design)]).map((design) => ({ design, props }))
}

async function throughTheRenderer(design: CardDesign, props: Omit<CardProps, "editing">) {
	const cold: number[] = []
	const warm: number[] = []
	let images = await renderShareCard(design, props) // downloads the pictures
	for (let run = 0; run < runs; run++) {
		stopShareCardRenderers()
		let started = performance.now()
		images = await renderShareCard(design, props)
		cold.push(performance.now() - started)
		started = performance.now()
		images = await renderShareCard(design, props)
		warm.push(performance.now() - started)
	}
	if (out) {
		writeFileSync(join(out, `${design.key}.png`), images.card)
		writeFileSync(join(out, `${design.key}.jpg`), images.preview)
	}
	console.log(`${design.key.padEnd(12)} cold ${spread(cold).padEnd(26)} warm ${spread(warm).padEnd(26)} card ${kb(images.card.length)}, preview ${kb(images.preview.length)}`)
}

// The renderer child's steps (render.child.js), one at a time in this process.
async function stages(design: CardDesign, props: Omit<CardProps, "editing">) {
	const times = new Map<string, { wall: number[]; cpu: number[]; note: string }>()
	const timed = <T,>(stage: string, work: () => T, note: (result: Awaited<T>) => string = () => ""): T => {
		const wall = performance.now()
		const cpu = process.cpuUsage()
		const finish = (result: Awaited<T>) => {
			const used = process.cpuUsage(cpu)
			const entry = times.get(stage) ?? { wall: [], cpu: [], note: "" }
			entry.wall.push(performance.now() - wall)
			entry.cpu.push((used.user + used.system) / 1000)
			entry.note = note(result)
			times.set(stage, entry)
			return result
		}
		const result = work()
		return (result instanceof Promise ? result.then(finish) : finish(result as Awaited<T>)) as T
	}
	const fonts = CARD_FONTS.map((f) => ({ name: f.name, weight: f.weight, style: f.style, data: readFileSync(join("public/fonts/share-card", f.file)) }))
	const downloadStarted = performance.now()
	const items = await Promise.all(props.items.map(async (item) => ({ ...item, poster: await toDataUri(item.poster), backdrop: await toDataUri(item.backdrop) })))
	console.log(`${design.key}: ${design.w} by ${design.h}, ${runs} runs. Pictures downloaded in ${Math.round(performance.now() - downloadStarted)} ms`)
	const toElement = (node: any): any => {
		if (node === null || typeof node !== "object") return node
		if (Array.isArray(node)) return node.map(toElement)
		const { children, ...rest } = node.props
		return createElement(node.type, rest, ...(Array.isArray(children) ? children : [children]).map(toElement))
	}
	const tree = resolveTree(<design.Card {...props} items={items} editing={false} />)
	const rasterize = (label: string, svg: string, width: number) => {
		const parsed = timed(`${label}: resvg parse`, () => new Resvg(svg, { fitTo: { mode: "width", value: width } }))
		return timed(`${label}: resvg render`, () => parsed.render(), (r) => `${r.width} by ${r.height}`)
	}
	for (let run = 0; run < runs; run++) {
		const svg = await timed("satori layout", () => satori(toElement(tree), { width: design.w, height: design.h, fonts: fonts as any }), (s) => kb(s.length))
		const tight = timed("filter regions", () => tightenShadowFilters(svg), () => `${(svg.match(/<filter /g) ?? []).length} filters`)
		rasterize(`card as laid out, ${design.w} wide`, svg, design.w)
		rasterize(`preview as laid out, 720 wide`, svg, 720)
		const card = rasterize(`card, ${design.w} wide`, tight, design.w)
		timed("card: PNG encode", () => card.asPng(), (png) => kb(png.length))
		const preview = rasterize(`preview, ${SHARE_CARD_PREVIEW.width} wide`, tight, SHARE_CARD_PREVIEW.width)
		const pixels = preview.pixels
		for (const quality of PREVIEW_QUALITIES) timed(`preview: JPEG quality ${quality}`, () => jpeg.encode({ data: pixels, width: preview.width, height: preview.height }, quality).data, (data) => kb(data.length))
	}
	for (const [stage, { wall, cpu, note }] of times) console.log(`  ${stage.padEnd(42)} wall ${String(Math.round(median(wall))).padStart(5)} ms   cpu ${String(Math.round(median(cpu))).padStart(5)} ms   ${note}`)
}

for (const { design, props } of await cards()) {
	if (process.argv.includes("--stages")) await stages(design, props)
	else await throughTheRenderer(design, props)
}
stopShareCardRenderers()
process.exit(0)
