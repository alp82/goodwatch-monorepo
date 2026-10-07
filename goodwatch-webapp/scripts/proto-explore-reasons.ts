// PROTOTYPE: prints what the explore variants say about a title. Throwaway.
// usage: vite-node scripts/proto-explore-reasons.ts movie:603 show:1396 [variant,...]
import { exploreModel } from "~/server/prototype-carousels.server"
import { getRelatedPanel } from "~/server/related.server"
import { EXPLORE_VARIANTS } from "~/ui/prototype-carousels/explore-model"

const args = process.argv.slice(2)
const variants = args.find((arg) => arg.startsWith("explore"))?.split(",") ?? [
	...EXPLORE_VARIANTS,
]
for (const arg of args.filter((value) => /^(movie|show):\d+$/.test(value))) {
	const [type, id] = arg.split(":") as ["movie" | "show", string]
	const panel = await getRelatedPanel({
		tmdbId: Number(id),
		sourceMediaType: type,
	})
	console.log(
		`\n===== ${arg}: ${panel.movies.length} movies, ${panel.shows.length} shows`,
	)
	for (const variant of variants) {
		const model = await exploreModel({
			variant: variant as (typeof EXPLORE_VARIANTS)[number],
			type,
			tmdbId: Number(id),
			panel,
		})
		if (!model) continue
		console.log(`--- ${variant} (more: ${model.more.length})`)
		const line = (t: {
			title: string
			year: string
			type: string
			why: string
			tag: string
		}) =>
			`    ${t.title} (${t.year}${t.type === "show" ? ", show" : ""}): ${t.why}  [${t.tag}]`
		for (const spoke of model.spokes ?? []) {
			console.log(`  ${spoke.label}`)
			for (const t of spoke.titles) console.log(line(t))
		}
		for (const cluster of model.clusters ?? []) {
			console.log(`  ${cluster.heading}, ${cluster.shared}`)
			for (const t of cluster.titles) console.log(line(t))
		}
		for (const step of model.steps ?? [])
			console.log(`  ${step.toward} ->`, line(step))
		for (const chip of model.chips ?? []) {
			console.log(`  ${chip.label}`)
			for (const t of chip.titles) console.log(line(t))
		}
		if (model.map) {
			console.log(
				`  x ${model.map.x.low} .. ${model.map.x.high} | y ${model.map.y.low} .. ${model.map.y.high} | center at ${model.map.at.x},${model.map.at.y}`,
			)
			for (const t of model.map.points) console.log(`${line(t)} @${t.x},${t.y}`)
		}
	}
}
process.exit(0)
