// Renders every card design through satori and resvg and reports failures, including renderer aborts and link
// previews over PREVIEW_MAX_BYTES.
//
//   npm run check:share-cards              every design: 5 titles in all 7 themes, plus 1 and 2 titles, a long
//                                          title and a 30-character handle, a title without artwork, and editing placeholders
//   npm run check:share-cards -- podium    only the named designs
//   SHARE_CARD_OUT=/tmp/cards npm run check:share-cards    also writes each card PNG and preview JPEG there
//
// Each render runs in a renderer child process, so an abort fails that render instead of this script.
// The titles are fixed samples; the script reads nothing from the database.
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { renderShareCard, stopShareCardRenderers } from "~/server/share-card/render.server"
import { DESIGNS } from "~/ui/share-card/designs"
import { type CardTitle, type ThemeKey, THEMES } from "~/ui/share-card/model"

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
const TITLES: CardTitle[] = [
	sample("movie:278", "The Shawshank Redemption", 1994, "/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg", "/pNjh59JSxChQktamG3LMp9ZoQzp.jpg", "Drama", 94),
	sample("show:1399", "Game of Thrones", 2011, "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg", "/zZqpAXxVSBtxV9qPBcscfXBcL2w.jpg", "Sci-Fi & Fantasy", 85),
	sample("movie:27205", "Inception", 2010, "/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg", "/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg", "Action", 90),
	sample("show:66732", "Stranger Things", 2016, "/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg", "/9P4IIMYY3HifqeruZq0ZZ9g7YUi.jpg", "Drama", 85),
	sample("movie:157336", "Interstellar", 2014, "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg", "/8sNiAPPYU14PUepFNeSNGUTiHW.jpg", "Adventure", 86),
]
const noArt = TITLES.map((t, i) => (i === 4 ? { ...t, poster: null, backdrop: null } : t))

type Case = { name: string; theme: ThemeKey; title: string; byline: string; items: CardTitle[]; editing?: boolean }
const CASES: Case[] = [
	...(Object.keys(THEMES) as ThemeKey[]).map((theme) => ({ name: `five-${theme}`, theme, title: "The best sci-fi of all time", byline: "@cinephile", items: TITLES })),
	{ name: "one", theme: "ice", title: "x", byline: "@you", items: TITLES.slice(0, 1) },
	{ name: "two", theme: "neon", title: "Comfort rewatches", byline: "@abc", items: TITLES.slice(0, 2) },
	{ name: "long", theme: "acid", title: "Movies I will defend with my life at every single dinner party, no matter what", byline: "@a_very_long_handle_for_testing", items: TITLES },
	{ name: "no-artwork", theme: "rose", title: "My top 5 movies of all time", byline: "@cinephile", items: noArt },
	{ name: "editing", theme: "royal", title: "My top 5 movies of all time", byline: "@cinephile", items: TITLES.slice(0, 2), editing: true },
]

const only = process.argv.slice(2)
const designs = only.length ? DESIGNS.filter((d) => only.includes(d.key)) : DESIGNS
const out = process.env.SHARE_CARD_OUT
if (out) mkdirSync(out, { recursive: true })

const started = Date.now()
const failures: string[] = []
// WhatsApp skips og:image files over 600 KB; stay well under.
const PREVIEW_MAX_BYTES = 300 * 1024
let largestPreview = { bytes: 0, label: "" }
await Promise.all(
	designs.flatMap((design) =>
		CASES.map(async (c) => {
			const label = `${design.key}/${c.name}`
			const t0 = Date.now()
			try {
				const { card, preview } = await renderShareCard(design, { title: c.title, name: c.byline, theme: c.theme, items: c.items, date: "Sep 25, 2026" }, c.editing)
				if (out) {
					writeFileSync(join(out, `${design.key}-${c.name}.png`), card)
					writeFileSync(join(out, `${design.key}-${c.name}.jpg`), preview)
				}
				if (preview.length > largestPreview.bytes) largestPreview = { bytes: preview.length, label }
				if (preview.length > PREVIEW_MAX_BYTES) throw new Error(`preview is ${Math.round(preview.length / 1024)} KB`)
				console.log(`ok    ${label} ${Date.now() - t0} ms, card ${Math.round(card.length / 1024)} KB, preview ${Math.round(preview.length / 1024)} KB`)
			} catch (error) {
				failures.push(`${label}: ${error instanceof Error ? error.message : error}`)
				console.log(`FAIL  ${label}: ${error instanceof Error ? error.message : error}`)
			}
		}),
	),
)
stopShareCardRenderers()
console.log(`\nLargest preview: ${largestPreview.label}, ${Math.round(largestPreview.bytes / 1024)} KB`)
console.log(`${designs.length * CASES.length - failures.length} passed, ${failures.length} failed in ${Math.round((Date.now() - started) / 1000)} s`)
if (failures.length) {
	console.log(failures.join("\n"))
	process.exit(1)
}
process.exit(0)
