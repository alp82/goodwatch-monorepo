// PROTOTYPE - throwaway. My library as a hub: the page leads to its subpages (Want to see, Seen, Scores, Shows in
// progress, Not rated, lists, imports, hidden titles) instead of holding one list itself. Three layouts of the same
// entries, switchable with `?variant=tiles|shelves|index`. Scores leads to the rescoring list,
// /prototype/my-library-rescore/scores. The member is PROTOTYPE_MEMBER_ID from the environment; nothing is written.
// A production build leaves the route out (PROTOTYPES in vite.config.js).
import { json } from "@remix-run/node"
import { useLoaderData, useOutlet, useSearchParams } from "@remix-run/react"
import { getHubPreviews } from "~/server/prototype-my-library-hub.server"
import { getRescoreData } from "~/server/prototype-my-library-rescore.server"
import { MY_MOVIES, MY_SHOWS, PageHead, WRAP } from "~/ui/my-pages/bits"
import { HubIndex } from "~/ui/prototype-my-library/rescore/hub/IndexList"
import { HubShelves } from "~/ui/prototype-my-library/rescore/hub/Shelves"
import { HubTiles } from "~/ui/prototype-my-library/rescore/hub/Tiles"
import type { HubData } from "~/ui/prototype-my-library/rescore/hub/sections"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

const VARIANTS = {
	tiles: "A - Tiles",
	shelves: "B - Shelves",
	index: "C - Index list",
}

export async function loader() {
	const [rescore, previews] = await Promise.all([
		getRescoreData(),
		getHubPreviews(),
	])
	return json<HubData | null>(
		rescore && previews ? { rescore, previews } : null,
		{ headers: { "Cache-Control": "private, no-store" } },
	)
}

export default function MyLibraryHubPrototype() {
	const data = useLoaderData<typeof loader>() as HubData | null
	const [params] = useSearchParams()
	const outlet = useOutlet()
	if (outlet) return outlet
	const variant = params.get("variant") ?? "tiles"
	return (
		<div className="overflow-x-clip pb-24" data-my-library-hub={variant}>
			<PageHead
				name="My library"
				line="Everything you have marked, saved, rated and brought in. Picking one for tonight happens in My shows and My movies."
				links={[
					{ label: "My shows", to: MY_SHOWS },
					{ label: "My movies", to: MY_MOVIES },
				]}
			/>
			<div className={WRAP}>
				{!data ? (
					<p className="text-sm text-gray-400">Set PROTOTYPE_MEMBER_ID.</p>
				) : variant === "shelves" ? (
					<HubShelves data={data} />
				) : variant === "index" ? (
					<HubIndex data={data} />
				) : (
					<HubTiles data={data} />
				)}
			</div>
			<PrototypeSwitcher variants={VARIANTS} position="top-[4.5rem] lg:top-auto lg:bottom-6 left-1/2 -translate-x-1/2" />
		</div>
	)
}
