// /people: the sitemap's people, in its order, with their best-known titles (see domain/best-lists.ts).
import type { MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { peopleCopy } from "~/domain/best-lists"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { getListPeople } from "~/server/best-lists.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { ListHead } from "~/ui/best-lists/ListHead"
import { PeopleCards } from "~/ui/best-lists/PeopleCards"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
import { buildMeta } from "~/utils/meta"

const CRUMBS: Crumb[] = [{ label: "People", path: "/people" }]

export const loader = presentCatalogLoader(
	async () => ({ people: await getListPeople() }),
	{ live: true },
)

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Page Not Found | GoodWatch" }]
	const copy = peopleCopy(data.people.map((p) => p.department))
	return buildMeta({
		pageMeta: {
			title: copy.title,
			description: copy.description,
			url: "https://goodwatch.app/people",
			image: "https://goodwatch.app/images/heroes/hero-movies.png",
			alt: copy.heading,
		},
		itemList: { paths: data.people.map((p) => p.path), first: 1 },
	})
}

export default function People() {
	const { people } = useLoaderData<typeof loader>()
	const copy = peopleCopy(people.map((p) => p.department))
	return (
		<div className="pb-16">
			<ListHead crumbs={CRUMBS} heading={copy.heading} intro={copy.intro} />
			<PeopleCards people={people} />
		</div>
	)
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/people")
