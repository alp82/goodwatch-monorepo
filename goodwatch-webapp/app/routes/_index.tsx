// The start page (docs/implementation/start-page-redesign.md): a search-first page over a painted room. A guest
// lands on the centered search over the dark room; a member gets their own start over the lit room. The old TV
// living room's code stays in app/ui/living-room/ and app/server/living-room/ for a later easter egg; this page
// doesn't load it, and `?tv=` is ignored.
//
// The page is complete in the server's HTML (the H1, the room's painting) and its scripts start after it has painted
// (utils/start-after-paint.ts). Searches run in the browser only, never from the loader.
import type { LinksFunction, MetaFunction } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData } from "@remix-run/react"
import { type ComponentProps, useMemo, useState } from "react"
import type { startPageLoader } from "~/server/start-page/loader.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { StartBrowse } from "~/ui/start/browse/StartBrowse"
import { HowItWorksCorner } from "~/ui/start/how/HowItWorksCorner"
import { RoomGrade } from "~/ui/start/lighting/RoomGrade"
import { roomGrade } from "~/ui/start/lighting/grades"
import { MemberStart } from "~/ui/start/member/MemberStart"
import { StartMoodPicker } from "~/ui/start/moods/StartMoodPicker"
import { OpeningBoot, OpeningCover } from "~/ui/start/opening/OpeningBoot"
import type { ShelfTitle } from "~/ui/start/room/ShelfCovers"
import { StartSearchBar } from "~/ui/start/search/StartSearchBar"
import { useStartSearch } from "~/ui/start/search/useStartSearch"
import { SpotlightCard, surpriseMood } from "~/ui/start/spotlight/SpotlightCard"
import { useLovedThree } from "~/ui/start/spotlight/useLovedThree"
import { StartStage } from "~/ui/start/stage/StartStage"
import { roomLight, roomStep } from "~/ui/start/stage/room-steps"
import { hasQuery, startView } from "~/ui/start/stage/start-query"
import { QUERY_PARAMS } from "~/ui/start/stage/start-query-url"
import { useStartQuery } from "~/ui/start/stage/useStartQuery"
import { START_SHEETS } from "~/ui/start/start-sheets"
import { assetBase, assetUrl } from "~/utils/asset-url"
import { buildMeta, ogImageUrl } from "~/utils/meta"
import { START_AFTER_PAINT } from "~/utils/start-after-paint"
import { ProtoSwitcher, useFlow } from "~/ui/start/proto-streamline/ProtoSwitcher"
import {
	RevealCard,
	revealAttrs,
	useLamp,
	useReveal,
} from "~/ui/start/proto-streamline/RevealCard"
import { installFixture } from "~/ui/start/proto-streamline/fixture"
import { guestTeaser } from "~/ui/start/proto-streamline/teaser-models"
import streamlineCss from "~/ui/start/proto-streamline/streamline.css?url"

// PROTOTYPE (start-streamline): the offline harness answers searches from fixtures.
if (typeof window !== "undefined") installFixture()

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
	{ rel: "stylesheet", href: streamlineCss },
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

/** The query's parameters: only the page's own state reads them, so changing them doesn't read the page again. */
const STATE_PARAMS = new Set<string>(QUERY_PARAMS)

const withoutState = (url: URL) => {
	const params = new URLSearchParams(url.search)
	for (const name of STATE_PARAMS) params.delete(name)
	params.sort()
	return `${url.pathname}?${params}`
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	!formMethod &&
	currentUrl.search !== nextUrl.search &&
	withoutState(currentUrl) === withoutState(nextUrl)
		? false
		: defaultShouldRevalidate

export default function Index() {
	const flow = useFlow()
	return (
		<>
			<ProtoSwitcher />
			<IndexBody key={flow} />
		</>
	)
}

function IndexBody() {
	const data = useLoaderData<typeof startPageLoader>()
	const flow = useFlow()
	if (!data.member)
		return flow === "old" ? (
			<GuestStart titles={data.titles} browse={data.browse} />
		) : (
			<StreamGuest titles={data.titles} browse={data.browse} />
		)
	return (
		<MemberStart
			shelf={data.titles}
			data={data.start}
			later={{
				forYou: "forYouLater" in data ? data.forYouLater : undefined,
				hot: "hotLater" in data ? data.hotLater : undefined,
			}}
		/>
	)
}

/**
 * A guest's start: the search block waits in the middle of the dark room until the guest asks (Enter, Search, a
 * preset, a mood pick's Done, or leaving the field with a search on); then it lifts and the card comes in. The room
 * lights up step by step (stage/room-steps.ts): each loved title a little more, fully once their picks are on show.
 * While titles are on show, the shelf shows them.
 */
function GuestStart({
	titles,
	browse,
}: {
	titles: StartTitle[]
	browse: ComponentProps<typeof StartBrowse>["data"]
}) {
	const loved = useLovedThree()
	const start = useStartQuery({ onChoice: loved.onChoice })
	const results = useStartSearch(start.query)
	// A link with a query opens as asked.
	const [asked, setAsked] = useState(() => hasQuery(start.query))
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
		<>
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
				moods={
					<StartMoodPicker
						query={start.query}
						results={results}
						scope={results.scope}
						setPicks={start.setPicks}
						clearPicks={start.clearPicks}
						member={false}
						onDone={() => setAsked(true)}
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
				grade={<RoomGrade grade={roomGrade(start.query, results)} />}
				// A guest's opening plays once a session; a member's page has none of it.
				opening={<OpeningBoot />}
			/>
			<OpeningCover />
			<HowItWorksCorner />
			<StartBrowse data={browse} />
		</>
	)
}

/** PROTOTYPE (start-streamline, round 2): a guest's start with the teaser under the sofa. */
function StreamGuest({
	titles,
	browse,
}: {
	titles: StartTitle[]
	browse: ComponentProps<typeof StartBrowse>["data"]
}) {
	const flow = useFlow()
	const loved = useLovedThree()
	const start = useStartQuery({ onChoice: loved.onChoice })
	const results = useStartSearch(start.query)
	const reveal = useReveal(flow, hasQuery(start.query))
	const lamp = useLamp()
	const view = startView(
		start.query,
		results,
		loved.done ? loved.loved.length : Math.min(loved.loved.length, 2),
	)
	const picks = loved.picks?.status === "ready" ? loved.picks.pick : null
	const moods = start.query.picks.length > 0
	const n = loved.loved.length
	// Dim on load, a bit dimmed at rest, lit as the guest goes along; the camera never moves.
	const night = !lamp
		? 0.55
		: picks
			? 0
			: reveal.open
				? Math.max(0.04, (moods ? 0.16 : 0.22) - 0.06 * n)
				: 0.32
	const shown = view === "results" ? results.cards : null
	const shelf = useMemo<readonly ShelfTitle[]>(() => {
		if (picks?.top) return [picks.top, ...picks.more]
		return shown?.length ? shown : titles
	}, [picks, shown, titles])
	const teaser = guestTeaser({
		query: start.query,
		results,
		view,
		loved: loved.loved,
		pick: picks ? { top: picks.top, more: picks.more } : null,
		fan: titles,
	})
	if (flow === "old") return null
	return (
		<div {...revealAttrs(flow, reveal.open)}>
			<StartStage
				shelf={shelf}
				night={night}
				camera={1}
				search={
					<StartSearchBar
						query={start.query}
						results={results}
						setDraft={start.setDraft}
						search={start.search}
						clearSearch={start.clearSearch}
						onAsk={() => reveal.request(true)}
					/>
				}
				moods={
					<StartMoodPicker
						query={start.query}
						results={results}
						scope={results.scope}
						setPicks={start.setPicks}
						clearPicks={start.clearPicks}
						member={false}
						onDone={() => reveal.request(true)}
					/>
				}
				card={
					<RevealCard
						open={reveal.open}
						onOpen={() => reveal.request(true)}
						onClose={flow === "f" ? null : () => reveal.request(false)}
						onAction={(id) => {
							if (id === "surprise") {
								start.clearSearch()
								start.setPicks([surpriseMood(start.query.picks)])
							}
							reveal.request(true)
						}}
						teaser={flow === "f" ? null : teaser}
					>
						<SpotlightCard
							start={start}
							results={results}
							view={view}
							loved={loved}
							fan={titles}
						/>
					</RevealCard>
				}
				grade={<RoomGrade grade={roomGrade(start.query, results)} />}
				opening={<OpeningBoot />}
			/>
			<OpeningCover />
			<HowItWorksCorner />
			<StartBrowse data={browse} />
		</div>
	)
}
