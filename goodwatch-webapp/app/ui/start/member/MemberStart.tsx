// A member's start (docs/implementation/start-page-redesign.md, "Member start"): the same lit room and search bar as
// a guest's, with no boot and no opening steps. The card's box holds "this or that" from the member's own lists (First
// steps when there is nothing on any list yet), or the search's results while a search is on. Under the room, the
// "Go deeper" doors open each list inline.
//
// Nothing on this page writes: "this or that" only moves its round on, and the doors only switch sections.
import { useMemo } from "react"
import type { ShelfTitle } from "../room/ShelfCovers"
import { StartSearchBar } from "../search/StartSearchBar"
import { useStartSearch } from "../search/useStartSearch"
import { StartStage } from "../stage/StartStage"
import { hasQuery } from "../stage/start-query"
import { useStartQuery } from "../stage/useStartQuery"
import { Doors } from "./Doors"
import { FirstSteps } from "./FirstSteps"
import { MemberResults } from "./MemberResults"
import { ThisOrThat } from "./ThisOrThat"
import { buildDeck } from "./deck"
import type { MemberStartData } from "./member-data"

/** A member's room is lit and seen whole. */
const MEMBER_ROOM = { night: 0, camera: 1 }

export function MemberStart({
	shelf,
	data,
}: {
	shelf: readonly ShelfTitle[]
	data: MemberStartData
}) {
	const start = useStartQuery()
	const member = useMemo(() => ({ services: data.services }), [data.services])
	const results = useStartSearch(start.query, { member })
	const deck = useMemo(() => buildDeck(data), [data])
	const unread = !data.continue && !data.wishlist && !data.forYou
	return (
		<div className="start-member">
			<StartStage
				shelf={shelf}
				night={MEMBER_ROOM.night}
				camera={MEMBER_ROOM.camera}
				search={
					<StartSearchBar
						query={start.query}
						results={results}
						setDraft={start.setDraft}
						search={start.search}
						clearSearch={start.clearSearch}
					/>
				}
				card={
					hasQuery(start.query) ? (
						<MemberResults
							query={start.query}
							results={results}
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
						<FirstSteps ratings={data.ratings} />
					)
				}
			/>
			<Doors data={data} />
		</div>
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
