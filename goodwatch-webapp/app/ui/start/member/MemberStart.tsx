// A member's start (docs/implementation/start-page-redesign.md, "Member start"): the same room, search bar and mood
// picker as a guest's, with no boot and no opening steps. Until the card opens, the ledge on the room's floor shows one
// big button, "Choose what to watch next" ("Get your first picks" with nothing on any list yet), with My movies and My
// shows under it, or the search's titles while a search is on (ledge/ledge-models.ts). The button, Enter in the
// search, a preset or the mood picker's Done opens the card: "this or that" from the member's own lists, the first
// steps, or the search's results, with My movies and My shows as tabs on its top edge. Under the room, the "Go deeper"
// doors open each list inline. The room's shelf shows the member's Watch next movies, else their shows to continue,
// else For you (`memberShelf`).
//
// For you and Hot on socials can come later than the page (member.server.ts); they join the deck and the doors once
// they arrive, without moving anything: the doors' order and the open door are decided before (doors.ts).
//
// Nothing on this page writes: "this or that" only moves its round on, and the doors only switch sections.
import { useEffect, useMemo, useState } from "react"
import {
	ListLinks,
	StartLedge,
	useCardOpen,
	useLamp,
} from "../ledge/StartLedge"
import { listLinks, memberLedge } from "../ledge/ledge-models"
import { StartMoodPicker } from "../moods/StartMoodPicker"
import type { ShelfTitle } from "../room/ShelfCovers"
import { StartSearchBar } from "../search/StartSearchBar"
import { useStartSearch } from "../search/useStartSearch"
import { StartStage } from "../stage/StartStage"
import { memberNight } from "../stage/room-steps"
import { hasQuery } from "../stage/start-query"
import { useStartQuery } from "../stage/useStartQuery"
import { Doors } from "./Doors"
import { FirstSteps } from "./FirstSteps"
import { MemberResults } from "./MemberResults"
import { ThisOrThat } from "./ThisOrThat"
import { buildDeck } from "./deck"
import {
	type ArrivedLists,
	type MemberStartData,
	type MemberStartLater,
	memberShelf,
	withArrived,
} from "./member-data"

export function MemberStart({
	shelf,
	data: first,
	later,
}: {
	shelf: readonly ShelfTitle[]
	data: MemberStartData
	later?: MemberStartLater
}) {
	const data = useArrived(first, later)
	const start = useStartQuery()
	const member = useMemo(() => ({ services: data.services }), [data.services])
	const results = useStartSearch(start.query, { member })
	const deck = useMemo(() => buildDeck(data), [data])
	const unread = !data.continue && !data.wishlist && !data.forYou
	const ownShelf = useMemo(() => memberShelf(data, shelf), [data, shelf])
	// A link with a query opens as asked.
	const card = useCardOpen(hasQuery(start.query))
	const lamp = useLamp()
	const lists = {
		movies: data.wishlist?.total ?? null,
		shows: data.continue?.total ?? null,
	}
	const searching = hasQuery(start.query)
	const fresh = !searching && !deck.length && !unread
	return (
		<div className="start-member" {...(fresh ? { "data-first": "" } : {})}>
			<StartStage
				shelf={ownShelf}
				night={memberNight({ lamp, open: card.open })}
				open={card.open}
				search={
					<StartSearchBar
						query={start.query}
						results={results}
						setDraft={start.setDraft}
						search={start.search}
						clearSearch={start.clearSearch}
						onAsk={card.show}
					/>
				}
				moods={
					<StartMoodPicker
						query={start.query}
						results={results}
						scope={results.scope}
						setPicks={start.setPicks}
						clearPicks={start.clearPicks}
						member
						onDone={card.show}
					/>
				}
				card={
					<StartLedge
						open={card.open}
						ledge={memberLedge({
							query: start.query,
							results,
							hasDeck: deck.length > 0,
							unread,
							lists,
						})}
						onOpen={card.show}
						tabs={<ListLinks links={listLinks(lists)} />}
					>
						{searching ? (
							<MemberResults
								query={start.query}
								results={results}
								scope={results.scope}
								onBack={() => {
									start.clearSearch()
									start.clearPicks()
								}}
								onRetry={results.retry}
							/>
						) : deck.length ? (
							<ThisOrThat deck={deck} />
						) : unread ? (
							<Unread />
						) : (
							<FirstSteps ratings={data.ratings} posters={ownShelf} />
						)}
					</StartLedge>
				}
			/>
			<Doors data={data} />
		</div>
	)
}

/**
 * The start with the lists that came later. The first render is the server's (they're still on their way there), so
 * the page hydrates as it was sent; each list joins when its promise settles, and only while that promise is the
 * loader's current one (`withArrived`).
 */
function useArrived(
	data: MemberStartData,
	later: MemberStartLater | undefined,
): MemberStartData {
	const [arrived, setArrived] = useState<ArrivedLists>({})
	const forYou = later?.forYou
	const hot = later?.hot
	useEffect(() => {
		let live = true
		const join = <K extends keyof ArrivedLists>(
			key: K,
			list: Promise<MemberStartData[K]> | undefined,
		) =>
			list?.then(
				(value) => {
					if (live)
						setArrived((now) => ({ ...now, [key]: { from: list, value } }))
				},
				() => {
					if (live)
						setArrived((now) => ({
							...now,
							[key]: { from: list, value: null },
						}))
				},
			)
		join("forYou", forYou)
		join("hot", hot)
		return () => {
			live = false
		}
	}, [forYou, hot])
	return useMemo(
		() => withArrived(data, { forYou, hot }, arrived),
		[data, forYou, hot, arrived],
	)
}

/** None of the member's lists could be read. */
function Unread() {
	return (
		<div className="start-member-box flex h-full flex-col justify-center pt-3 text-center">
			<h2 className="text-base font-bold text-white lg:text-lg">
				Couldn't load your lists
			</h2>
			<p className="mt-1 text-sm text-gray-400">
				Reload the page to try again, or search above.
			</p>
		</div>
	)
}
