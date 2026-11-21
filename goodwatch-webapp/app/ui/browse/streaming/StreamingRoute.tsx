// The two streaming pages as the Browse splat route renders them, and their meta: a country's index of services, and
// one service's page. The Browse row sits on top of both (Streaming lit).
import { canonicalPath, kindLabel, kindNoun, kindSeg } from "~/domain/browse/address"
import type { StreamingRoute } from "~/server/browse/streaming-page.server"
import { buildMeta } from "~/utils/meta"
import { BrowseRow } from "../BrowseRow"
import { ServicePage } from "../service/ServicePage"
import { StreamingIndex } from "./StreamingIndex"

export function StreamingPage({ data }: { data: StreamingRoute }) {
	return (
		<div className="pb-16">
			<BrowseRow address={data.address} />
			{data.page === "streaming" ? (
				<StreamingIndex data={data.index} kind={data.address.kind} />
			) : (
				<ServicePage
					data={data.service}
					address={data.address}
					viewer={data.viewer}
					kindId={data.kindId}
				/>
			)}
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
	if (data.page === "streaming") {
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
	const { service, copy, title, countryName } = data.service
	return buildMeta({
		pageMeta: {
			title: `${title} | GoodWatch`,
			description:
				copy?.lede ??
				`The best ${noun} on ${service.label} in ${countryName}, what it's strong on, and what just arrived.`,
			url,
			image,
			alt: title,
		},
		breadcrumbs: [...crumbs, { label: service.label, path: canonicalPath(address) }],
		robots,
	})
}
