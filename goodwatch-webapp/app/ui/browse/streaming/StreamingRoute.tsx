// The streaming index as the Browse splat route renders it, and its meta: a country's index of services. The Browse
// row sits on top (Streaming lit). One service's page is a room page (ui/browse/room/RoomPage.tsx).
import { canonicalPath, kindLabel, kindNoun, kindSeg } from "~/domain/browse/address"
import type { StreamingRoute } from "~/server/browse/streaming-page.server"
import { buildMeta } from "~/utils/meta"
import { BrowseRow } from "../BrowseRow"
import { StreamingIndex } from "./StreamingIndex"

export function StreamingPage({ data }: { data: StreamingRoute }) {
	return (
		<div className="pb-16">
			<BrowseRow address={data.address} />
			<StreamingIndex data={data.index} kind={data.address.kind} />
		</div>
	)
}

const ORIGIN = "https://goodwatch.app"

export function streamingMeta(data: StreamingRoute) {
	const { address } = data
	const seg = kindSeg(address.kind)
	const noun = kindNoun(address.kind)
	const url = `${ORIGIN}${canonicalPath(address)}`
	const index = `/${seg}/streaming/${address.country}`
	const crumbs = [
		{ label: kindLabel(address.kind), path: `/${seg}` },
		{ label: "Streaming", path: index },
	]
	const image = `${ORIGIN}/images/heroes/hero-${address.kind === "show" ? "shows" : "movies"}.png`
	// Movies and shows together repeat two indexable pages.
	const robots = address.kind === "all" ? ("noindex, follow" as const) : undefined
	const { country, services } = data.index
	return buildMeta({
		pageMeta: {
			title: `Streaming services in ${country.name}: what each one has | GoodWatch`,
			description: `Every streaming service in ${country.name} with ${noun}: how big each library is, what came and went this month, and its best titles.`,
			url,
			image,
			alt: `Streaming in ${country.name}`,
		},
		breadcrumbs: crumbs,
		robots: services.length ? robots : "noindex, follow",
	})
}
