// The start page (docs/implementation/start-page-redesign.md): a search-first page over a painted room. A guest
// lands on the centered search over the dark room; a member gets their own start over the lit room. The old TV
// living room's code stays in app/ui/living-room/ and app/server/living-room/ for a later easter egg; this page
// doesn't load it, and `?tv=` is ignored.
//
// The page is complete in the server's HTML (the H1, the room's painting) and its scripts start after it has painted
// (utils/start-after-paint.ts). Searches run in the browser only, never from the loader.
import type { LinksFunction, MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { useState } from "react"
import type { startPageLoader } from "~/server/start-page/loader.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { OpeningBoot, OpeningCover } from "~/ui/start/opening/OpeningBoot"
import { StartSearchBar } from "~/ui/start/search/StartSearchBar"
import { useStartSearch } from "~/ui/start/search/useStartSearch"
import { StartStage } from "~/ui/start/stage/StartStage"
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

/** Before a guest asks: the room nearly dark, seen close up. A member's room is lit. */
const GUEST_ROOM = { night: 0.9, camera: 1.12 }
const MEMBER_ROOM = { night: 0, camera: 1 }

export default function Index() {
	const data = useLoaderData<typeof startPageLoader>()
	if (!data.member) return <GuestStart titles={data.titles} />
	return (
		<StartStage
			shelf={data.titles}
			night={MEMBER_ROOM.night}
			camera={MEMBER_ROOM.camera}
		/>
	)
}

/**
 * A guest's start: the search block waits in the middle of the dark room until the guest asks (Enter, Search, a
 * preset, or leaving the field with a search on); then it lifts and the card comes in.
 */
function GuestStart({ titles }: { titles: StartTitle[] }) {
	const start = useStartQuery()
	const results = useStartSearch(start.query)
	const [asked, setAsked] = useState(false)
	return (
		<>
			<StartStage
				shelf={titles}
				night={GUEST_ROOM.night}
				camera={GUEST_ROOM.camera}
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
				// A guest's opening plays once a session; a member's page has none of it.
				opening={<OpeningBoot />}
			/>
			<OpeningCover />
		</>
	)
}
