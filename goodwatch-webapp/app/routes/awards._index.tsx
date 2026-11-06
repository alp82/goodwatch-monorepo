// /awards: the latest ceremonies and the award bodies (domain/award-pages.ts).
import type { MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { awardServices, getAwardsHub } from "~/server/award-pages.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { AwardServices, AwardsHead } from "~/ui/award-pages/parts"
import { BodyList, RecentCeremonies } from "~/ui/award-pages/sections"
import { buildMeta } from "~/utils/meta"

export const loader = presentCatalogLoader(
	async ({ request }: { request: Request }) => {
		const hub = await getAwardsHub()
		return {
			...hub,
			services: await awardServices(
				request,
				hub.recent.flatMap((c) => c.winners),
			),
		}
	},
	{ live: true },
)

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Page Not Found | GoodWatch" }]
	return buildMeta({
		pageMeta: {
			title:
				"Award winners and nominees: Oscars, Emmys, Golden Globes | GoodWatch",
			description:
				"Oscar, Emmy, Golden Globe, BAFTA and César winners and nominees by year and category, with GoodWatch scores and where to stream each title.",
			url: "https://goodwatch.app/awards",
			image: "https://goodwatch.app/images/heroes/hero-movies.png",
			alt: "Award winners and nominees",
		},
	})
}

export default function AwardsHub() {
	const { recent, bodies, services } = useLoaderData<typeof loader>()
	return (
		<AwardServices.Provider value={services}>
			<div className="pb-16">
				<AwardsHead
					crumbs={[]}
					heading="Award winners and nominees"
					intro="The Oscars, Emmys, Golden Globes and more, by year and category, with scores and where to stream each title."
				/>
				<RecentCeremonies recent={recent} />
				<BodyList bodies={bodies} />
			</div>
		</AwardServices.Provider>
	)
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/awards._index")
