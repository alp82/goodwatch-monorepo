// /awards/<body>: the latest ceremony's winners, the ceremonies by year, the categories (domain/award-pages.ts).
// A body without a published ceremony answers 404.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { awardServices, getAwardBody } from "~/server/award-pages.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { AwardServices, AwardsHead } from "~/ui/award-pages/parts"
import {
	CategoryList,
	LatestResults,
	YearsByDecade,
} from "~/ui/award-pages/sections"
import { notFound } from "~/ui/explore/address"
import { buildMeta } from "~/utils/meta"

export const loader = presentCatalogLoader(
	async ({ request, params }: LoaderFunctionArgs) => {
		const data = await getAwardBody(params.body ?? "")
		if (!data) throw notFound()
		return {
			...data,
			services: await awardServices(
				request,
				data.latest.results.map((r) => r.winner),
			),
		}
	},
	{ live: true },
)

const crumbs = (b: { slug: string; name: string }) => [
	{ label: "Awards", path: "/awards" },
	{ label: b.name, path: `/awards/${b.slug}` },
]

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Page Not Found | GoodWatch" }]
	const { body, latest } = data
	return buildMeta({
		pageMeta: {
			title: `${body.name} winners and nominees by year | GoodWatch`,
			description: `${body.name} (${body.official}) winners and nominees by year and category, up to ${latest.year}. With GoodWatch scores and where to stream each title.`,
			url: `https://goodwatch.app/awards/${body.slug}`,
			image: "https://goodwatch.app/images/heroes/hero-movies.png",
			alt: `${body.name} winners`,
		},
		breadcrumbs: crumbs(body),
	})
}

export default function AwardBodyPage() {
	const { body, years, latest, categories, services } =
		useLoaderData<typeof loader>()
	return (
		<AwardServices.Provider value={services}>
			<div className="pb-16">
				<AwardsHead
					crumbs={crumbs(body)}
					heading={`${body.name} winners and nominees`}
					intro={`${body.official !== body.name ? `${body.official}: ` : ""}${body.kind.toLowerCase()} winners and nominees by year and category, with scores and where to stream them.`}
				/>
				<LatestResults slug={body.slug} name={body.name} latest={latest} />
				<YearsByDecade slug={body.slug} years={years} />
				<CategoryList slug={body.slug} categories={categories} />
			</div>
		</AwardServices.Provider>
	)
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/awards.$body._index")
