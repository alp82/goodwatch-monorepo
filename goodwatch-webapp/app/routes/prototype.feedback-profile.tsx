// PROTOTYPE - throwaway. The real member profile Overview (/u/:handle: ProfileFrame + Overview, as in
// routes/u.$handle._index.tsx) on fixture data, so the Feedback tab's fix mode can be tried on a member profile in the
// sandbox, where the profile's stores are out of reach. A guest views @demo. Titles are real catalog entries; the
// viewer type and the taste line are built from fixture fingerprint edges with the real word tables and the same rules
// as server/taste-portrait/fingerprint.server.ts.
import { json } from "@remix-run/node"
import { type MetaFunction, useLoaderData } from "@remix-run/react"
import type { ProfileOverview, ProfileShell } from "~/domain/profile"
import {
	capitalize,
	isWorded,
	joinWords,
	label,
	noun,
	phrase,
	short,
} from "~/server/taste-portrait/words.server"
import fixture from "~/ui/prototype-feedback/fixture-profile.json"
import { Overview, type OverviewTaste } from "~/ui/profile/Overview"
import { ProfileFrame } from "~/ui/profile/ProfileFrame"
import type { FamilyId } from "~/ui/profile/taste/model"

type Edge = { key: string; family: FamilyId; edge: number }

/** The Overview's taste card data, as the profile loader builds it from a ready fingerprint. */
function tasteOf(edges: Edge[]): OverviewTaste {
	const byEdge = edges
		.filter((a) => isWorded(a.key))
		.sort((a, b) => b.edge - a.edge || a.key.localeCompare(b.key))
	const seek = byEdge.filter((a) => a.edge > 0).slice(0, 3)
	const avoid = byEdge
		.filter((a) => a.edge < 0)
		.reverse()
		.slice(0, 2)
	const first = `Show you ${joinWords(
		seek.map((a) => phrase(a.key)),
		"or",
	)}, and you're in.`
	const line = avoid.length
		? `${first} ${capitalize(joinWords(avoid.map((a) => noun(a.key))))} rarely get a look.`
		: first
	// viewerType(): the strongest leaning per family, three at most.
	const named: Edge[] = []
	for (const a of byEdge.filter((x) => x.edge > 0))
		if (named.length < 3 && !named.some((n) => n.family === a.family))
			named.push(a)
	return {
		identity: capitalize(named.map((a) => short(a.key)).join(", ")),
		line,
		avoid: avoid.map((a) => a.key),
		attributes: edges.map((a) => ({
			key: a.key,
			label: label(a.key),
			family: a.family,
			edge: a.edge,
		})),
	}
}

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json({
		shell: fixture.shell as ProfileShell,
		overview: fixture.overview as ProfileOverview,
		taste: tasteOf(fixture.fingerprint as Edge[]),
		compare: null,
	})
}

export const meta: MetaFunction = () => [
	{ title: "@demo | GoodWatch (feedback prototype)" },
	{ name: "robots", content: "noindex" },
]

export default function FeedbackProfilePrototype() {
	const { shell, overview, taste, compare } = useLoaderData<typeof loader>()
	return (
		<ProfileFrame
			shell={shell}
			tab="overview"
			posters={{
				wishlist: overview.newestWishlist.map((t) => t.poster),
				lists: overview.lists.map((l) => l.posters[0] ?? null),
			}}
		>
			<Overview
				shell={shell}
				overview={overview}
				taste={taste}
				compare={compare}
			/>
		</ProfileFrame>
	)
}
