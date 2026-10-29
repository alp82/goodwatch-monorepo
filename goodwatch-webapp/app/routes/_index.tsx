// The start page (docs/implementation/start-page-redesign.md): a search-first page over a painted room. A guest
// lands on the centered search over the dark room; a member gets their own start over the lit room. The old TV
// living room's code stays in app/ui/living-room/ and app/server/living-room/ for a later easter egg; this page
// doesn't load it, and `?tv=` is ignored.
//
// The page is complete in the server's HTML (the H1, the room's painting) and its scripts start after it has painted
// (utils/start-after-paint.ts). Searches run in the browser only, never from the loader.
import type { LinksFunction, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { useMemo, useState } from "react"
import type { startPageLoader } from "~/server/start-page/loader.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import type { ShelfTitle } from "~/ui/start/room/ShelfCovers"
import { StartSearchBar } from "~/ui/start/search/StartSearchBar"
import { useStartSearch } from "~/ui/start/search/useStartSearch"
import { SpotlightCard } from "~/ui/start/spotlight/SpotlightCard"
import { useLovedThree } from "~/ui/start/spotlight/useLovedThree"
import { StartStage } from "~/ui/start/stage/StartStage"
import { LIT_ROOM, roomLight, roomStep } from "~/ui/start/stage/room-steps"
import { startView } from "~/ui/start/stage/start-query"
import { useStartQuery } from "~/ui/start/stage/useStartQuery"
import { START_SHEETS } from "~/ui/start/start-sheets"
import { assetBase, assetUrl } from "~/utils/asset-url"
import { buildMeta, ogImageUrl } from "~/utils/meta"
import { START_AFTER_PAINT } from "~/utils/start-after-paint"

export { startPageLoader as loader } from "~/server/start-page/loader.server"
export { pageHeaders as headers } from "~/utils/headers"
// The page paints from the server's HTML alone; its scripts start after that (utils/start-after-paint.ts).
export const handle = START_AFTER_PAINT

export const links: LinksFunction = () => [
	// Without credentials on the static hostname, like the site's style sheet in root.tsx: the 103 Early Hints response
	// preloads them in that mode (server/early-hints.ts), and Chrome preloads a file of another host in no other.
	...START_SHEETS.map((sheet) => ({
		rel: "stylesheet",
		href: assetUrl(sheet),
		...(assetBase() ? { crossOrigin: "anonymous" as const } : {}),
	})),
	{ rel: "preconnect", href: "https://image.tmdb.org" },
]

const HOME_URL = "https://goodwatch.app/"
const HOME_TITLE = "GoodWatch - Find movies and TV shows to watch"
const HOME_DESCRIPTION =
	"Find your next movie or TV show by mood and taste. Compare IMDb, Rotten Tomatoes and Metacritic scores, explore titles, and check where they stream."

// Campaign parameters (and the old TV's `?tv=`) are views of the same page, not separate search results.
// This metadata is shared by guests and members, on every device.
export const meta: MetaFunction = () => [
	...buildMeta({
		pageMeta: {
			title: HOME_TITLE,
			description: HOME_DESCRIPTION,
			url: HOME_URL,
			image: ogImageUrl(HOME_URL),
			alt: "GoodWatch - find your next movie or TV show",
		},
	}).filter((tag) => !("script:ld+json" in tag)),
	{
		"script:ld+json": {
			"@context": "https://schema.org",
			"@graph": [
				{
					"@type": "Organization",
					"@id": `${HOME_URL}#organization`,
					name: "GoodWatch",
					url: HOME_URL,
					logo: `${HOME_URL}android-chrome-512x512.png`,
				},
				{
					"@type": "WebSite",
					"@id": `${HOME_URL}#website`,
					name: "GoodWatch",
					url: HOME_URL,
					description: HOME_DESCRIPTION,
					inLanguage: "en",
					publisher: { "@id": `${HOME_URL}#organization` },
				},
				{
					"@type": "WebPage",
					"@id": `${HOME_URL}#webpage`,
					name: HOME_TITLE,
					url: HOME_URL,
					description: HOME_DESCRIPTION,
					inLanguage: "en",
					isPartOf: { "@id": `${HOME_URL}#website` },
					about: { "@id": `${HOME_URL}#organization` },
				},
			],
		},
	},
]

export default function Index() {
	const data = useLoaderData<typeof startPageLoader>()
	if (!data.member) return <GuestStart titles={data.titles} />
	return (
		<StartStage
			shelf={data.titles}
			night={LIT_ROOM.night}
			camera={LIT_ROOM.camera}
		/>
	)
}

/**
 * A guest's start: the search block waits in the middle of the dark room until the guest asks (Enter, Search, a
 * preset, or leaving the field with a search on); then it lifts and the card comes in. The room lights up step by step
 * (stage/room-steps.ts): each loved title a little more, fully once their picks are on show. While titles are on show,
 * the shelf shows them.
 */
function GuestStart({ titles }: { titles: StartTitle[] }) {
	const loved = useLovedThree()
	const start = useStartQuery({ onChoice: loved.onChoice })
	const results = useStartSearch(start.query)
	const [asked, setAsked] = useState(false)
	const view = startView(
		start.query,
		results,
		loved.done ? loved.loved.length : Math.min(loved.loved.length, 2),
	)
	const picks = loved.picks?.status === "ready" ? loved.picks.pick : null
	const room = roomLight(roomStep({ asked, picksShown: !!picks }), {
		loved: loved.loved.length,
		moods: start.query.picks.length > 0,
	})
	const shown = view === "results" ? results.cards : null
	const shelf = useMemo<readonly ShelfTitle[]>(() => {
		if (picks?.top) return [picks.top, ...picks.more]
		return shown?.length ? shown : titles
	}, [picks, shown, titles])
	return (
		<StartStage
			shelf={shelf}
			night={room.night}
			camera={room.camera}
			centered={!asked}
			cardHidden={!asked}
			search={
				<StartSearchBar
					query={start.query}
					results={results}
					setDraft={start.setDraft}
					search={start.search}
					clearSearch={start.clearSearch}
					onAsk={() => setAsked(true)}
				/>
			}
			card={
				<SpotlightCard
					start={start}
					results={results}
					view={view}
					loved={loved}
					fan={titles}
				/>
			}
		/>
	)
}
