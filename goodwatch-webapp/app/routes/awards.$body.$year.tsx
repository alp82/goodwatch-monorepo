// /awards/<body>/<year>: a published ceremony's results by category, the winner first, then the nominees
// (domain/award-pages.ts). A held ceremony, an unknown year, or an unknown body answers 404.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { awardServices, getAwardCeremony } from "~/server/award-pages.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { CeremonyResults } from "~/ui/award-pages/CeremonyResults"
import { AwardServices, AwardsHead, YearNav } from "~/ui/award-pages/parts"
import { notFound } from "~/ui/explore/address"
import { buildMeta } from "~/utils/meta"

export const loader = presentCatalogLoader(
	async ({ request, params }: LoaderFunctionArgs) => {
		const data = await getAwardCeremony(params.body ?? "", params.year ?? "")
		if (!data) throw notFound()
		return {
			...data,
			services: await awardServices(
				request,
				data.categories.flatMap((c) => [...c.winners, ...c.nominees]),
			),
		}
	},
	{ live: true },
)

const crumbs = (d: { body: { slug: string; name: string }; year: number }) => [
	{ label: "Awards", path: "/awards" },
	{ label: d.body.name, path: `/awards/${d.body.slug}` },
	{ label: String(d.year), path: `/awards/${d.body.slug}/${d.year}` },
]

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Page Not Found | GoodWatch" }]
	const names = [
		...new Set(data.categories.flatMap((c) => c.winners.map((w) => w.title))),
	].slice(0, 3)
	const list =
		names.length > 1
			? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
			: names[0]
	return buildMeta({
		pageMeta: {
			title: `${data.body.name} ${data.year} winners and nominees | GoodWatch`,
			description: `${data.body.name} ${data.year} winners and nominees by category${list ? `. Winners include ${list}` : ""}. See scores and where to stream them.`,
			url: `https://goodwatch.app/awards/${data.body.slug}/${data.year}`,
			image: "https://goodwatch.app/images/heroes/hero-movies.png",
			alt: `${data.body.name} ${data.year} winners`,
		},
		breadcrumbs: crumbs(data),
	})
}

export default function AwardCeremony() {
	const d = useLoaderData<typeof loader>()
	const base = `/awards/${d.body.slug}`
	return (
		<AwardServices.Provider value={d.services}>
			<div className="pb-24">
				<AwardsHead
					crumbs={crumbs(d)}
					heading={`${d.body.name} ${d.year} winners and nominees`}
					intro={`The ${d.year} ${d.body.official}, by category: the winner first, then the nominees.`}
				>
					<div className="mt-2">
						<YearNav base={base} prev={d.prev} next={d.next} />
					</div>
				</AwardsHead>
				<CeremonyResults base={base} categories={d.categories} />
			</div>
		</AwardServices.Provider>
	)
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/awards.$body.$year")
