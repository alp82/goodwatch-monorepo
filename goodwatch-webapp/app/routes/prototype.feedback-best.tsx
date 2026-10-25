// PROTOTYPE - throwaway. The real /movies/best page (ListHead, RankedTitles, ListPageLinks, as in routes/$type.best.tsx)
// on fixture data, so the global Feedback tab's fix mode can be shown on a best-of list in the sandbox, where the
// catalog isn't reachable. Data: app/ui/prototype-feedback/fixture-best.json (the top 20 movies by GoodWatch score from
// the GoodWatch MCP, 2026-10-25); the page shows them as ranks 1 to 20 of a 3-page list, so the page links show too.
// The component is reproduced, not imported: importing the real route module would pull its server code into the browser.
import { json } from "@remix-run/node"
import type { MetaFunction } from "@remix-run/react"
import { useLoaderData } from "@remix-run/react"
import { type ListKind, listCopy, listName } from "~/domain/best-lists"
import type { ListTitle } from "~/server/best-lists.server"
import { ListHead } from "~/ui/best-lists/ListHead"
import { ListPageLinks, RankedTitles } from "~/ui/best-lists/RankedTitles"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
import fixture from "~/ui/prototype-feedback/fixture-best.json"

const crumbsOf = (kind: ListKind): Crumb[] => [
	{ label: kind === "movies" ? "Movies" : "Shows", path: `/${kind}` },
	{ label: listName(kind), path: `/${kind}/best` },
]

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json({
		kind: "movies" as ListKind,
		page: 1,
		pages: 3,
		total: 612,
		popular: 12,
		first: 1,
		titles: fixture.titles as ListTitle[],
	})
}

export const meta: MetaFunction = () => [
	{ title: "The Best Movies of All Time, Ranked | GoodWatch (prototype)" },
	{ name: "robots", content: "noindex" },
]

export default function BestListPrototype() {
	const { kind, page, pages, total, popular, first, titles } =
		useLoaderData<typeof loader>()
	const copy = listCopy(kind, { total, popular, page })
	const links = (
		<ListPageLinks kind={kind} page={page} pages={pages} total={total} />
	)
	return (
		<div className="pb-16">
			<ListHead
				crumbs={crumbsOf(kind)}
				heading={copy.heading}
				intro={copy.intro}
			>
				<div className="mt-3">{links}</div>
			</ListHead>
			<RankedTitles titles={titles} first={first} />
			<div className="mx-auto mt-6 max-w-7xl px-4">{links}</div>
		</div>
	)
}
