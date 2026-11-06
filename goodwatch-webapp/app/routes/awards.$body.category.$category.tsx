// /awards/<body>/category/<slug>: one category's winners and nominees by year, newest first (domain/award-pages.ts).
// A category without a published year answers 404.
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { awardServices, getAwardCategory } from "~/server/award-pages.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import {
	AwardCard,
	AwardServices,
	AwardsHead,
	TitleLinks,
	WonMark,
	yearText,
} from "~/ui/award-pages/parts"
import { notFound } from "~/ui/explore/address"
import { buildMeta } from "~/utils/meta"

export const loader = presentCatalogLoader(
	async ({ request, params }: LoaderFunctionArgs) => {
		const data = await getAwardCategory(
			params.body ?? "",
			params.category ?? "",
		)
		if (!data) throw notFound()
		return {
			...data,
			services: await awardServices(
				request,
				data.years.flatMap((y) => y.winners.slice(0, 1)),
			),
		}
	},
	{ live: true },
)

const crumbs = (d: {
	body: { slug: string; name: string }
	slug: string
	name: string
}) => [
	{ label: "Awards", path: "/awards" },
	{ label: d.body.name, path: `/awards/${d.body.slug}` },
	{ label: d.name, path: `/awards/${d.body.slug}/category/${d.slug}` },
]

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Page Not Found | GoodWatch" }]
	const recent = data.years
		.slice(0, 3)
		.flatMap((y) => y.winners.slice(0, 1).map((w) => `${w.title} (${y.year})`))
	return buildMeta({
		pageMeta: {
			title: `${data.body.name} ${data.name} winners by year | GoodWatch`,
			description: `${data.body.name} ${data.name} winners and nominees by year${recent.length ? `, including ${recent.join(", ")}` : ""}. With scores and where to stream them.`,
			url: `https://goodwatch.app/awards/${data.body.slug}/category/${data.slug}`,
			image: "https://goodwatch.app/images/heroes/hero-movies.png",
			alt: `${data.body.name} ${data.name}`,
		},
		breadcrumbs: crumbs(data),
	})
}

export default function AwardCategory() {
	const d = useLoaderData<typeof loader>()
	const base = `/awards/${d.body.slug}`
	return (
		<AwardServices.Provider value={d.services}>
			<div className="pb-16">
				<AwardsHead
					crumbs={crumbs(d)}
					heading={`${d.body.name}: ${d.name}`}
					intro="Winners and nominees by ceremony year, newest first."
				/>
				<ol className="mx-auto mt-6 max-w-7xl px-4">
					{d.years.map((y, i) => (
						<li
							key={y.year}
							className="grid grid-cols-[3.5rem_6rem_minmax(0,1fr)] items-start gap-4 border-b border-white/5 py-4 sm:grid-cols-[5rem_8rem_minmax(0,1fr)]"
						>
							<Link
								to={`${base}/${y.year}`}
								prefetch="intent"
								className="pt-1 text-xl font-bold tabular-nums text-gray-500 hover:text-amber-300 sm:text-2xl"
							>
								{y.year}
							</Link>
							<div>
								<AwardCard title={y.winners[0]} size="year" priority={i < 4} />
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								{y.winners.map((w) => (
									<div
										key={`${w.media_type}${w.tmdb_id}`}
										className="flex flex-col gap-0.5"
									>
										<WonMark />
										<Link
											to={w.path}
											prefetch="intent"
											className="text-lg font-semibold text-white hover:text-amber-300"
										>
											{w.title}
										</Link>
										<span className="text-sm text-gray-500">{yearText(w)}</span>
									</div>
								))}
								{y.nominees.length > 0 && (
									<p className="mt-2 text-sm leading-relaxed text-gray-500">
										Nominated: <TitleLinks titles={y.nominees} />
									</p>
								)}
							</div>
						</li>
					))}
				</ol>
			</div>
		</AwardServices.Provider>
	)
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
// biome-ignore format: cached-routes.test.ts reads this export as one line
export const clientLoader = cachedClientLoader("routes/awards.$body.category.$category")
