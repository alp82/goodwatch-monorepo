// The head of a "New on your services" page (#489 Part C): title, description, canonical address, robots, the
// breadcrumb and the ranked list as structured data. An empty page and the member's page answer noindex.
import type { NewPageData } from "~/server/new-on-services-page.server"
import { buildMeta } from "~/utils/meta"
import { crumbsOf } from "./NewOnServicesPage"

export function newOnServicesMeta(data: NewPageData | undefined) {
	if (!data) return [{ title: "Page Not Found | GoodWatch" }]
	return buildMeta({
		pageMeta: {
			title: data.copy.title,
			description: data.copy.description,
			url: `https://goodwatch.app${data.path}`,
			image: "https://goodwatch.app/images/heroes/hero-movies.png",
			alt: data.copy.heading,
		},
		breadcrumbs: crumbsOf(data),
		robots: data.robots,
		itemList:
			data.kind === "member"
				? undefined
				: { paths: data.ranked.map((title) => title.path), first: 1 },
	})
}
