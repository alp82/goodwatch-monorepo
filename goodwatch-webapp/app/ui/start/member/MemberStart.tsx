// A member's start (docs/implementation/start-page-redesign.md, "Member start"): the same lit room, search bar and
// mood picker as a guest's, with no boot and no opening steps. The card's box holds "this or that" from the member's own lists (First
// steps when there is nothing on any list yet), or the search's results while a search is on. Under the room, the
// "Go deeper" doors open each list inline.
//
// For you and Hot on socials can come later than the page (member.server.ts); they join the deck and the doors once
// they arrive, without moving anything: the doors' order and the open door are decided before (doors.ts).
//
// Nothing on this page writes: "this or that" only moves its round on, and the doors only switch sections.
import { useSearchParams } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import { assetUrl } from "~/utils/asset-url"
import { START_ROOM_ART } from "../room/room-pictures"
import { StartMoodPicker } from "../moods/StartMoodPicker"
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
import { GapSwitcher } from "./proto-gap/GapSwitcher"
import { PROTO_GAP_CSS } from "./proto-gap/proto-gap-css"
import { gapOf, memberShelf } from "./proto-gap/variants"
import { buildDeck } from "./deck"
import {
	type ArrivedLists,
	type MemberStartData,
	type MemberStartLater,
	withArrived,
} from "./member-data"

/** A member's room is lit and seen whole. */
const MEMBER_ROOM = { night: 0, camera: 1 }

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
	// PROTOTYPE: ?gap= variants and the member shelf rule (?shelf=old for everyone's start titles).
	const [params] = useSearchParams()
	const gap = gapOf(params.get("gap"))
	const own = useMemo(() => memberShelf(data, shelf), [data, shelf])
	const oldShelf = params.get("shelf") === "old"
	const doors = (
		<div className="proto-doors-wrap">
			<Doors data={data} />
		</div>
	)
	return (
		<div className="start-member" data-gap={gap}>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: prototype CSS */}
			<style dangerouslySetInnerHTML={{ __html: PROTO_GAP_CSS }} />
			<StartStage
				shelf={oldShelf ? shelf : own.titles}
				grade={
					<div
						aria-hidden
						className="proto-floor"
						style={{ backgroundImage: `url(${assetUrl(START_ROOM_ART.webp)})` }}
					/>
				}
				after={gap === "e" ? doors : null}
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
				moods={
					<StartMoodPicker
						query={start.query}
						results={results}
						scope={results.scope}
						setPicks={start.setPicks}
						clearPicks={start.clearPicks}
						member
					/>
				}
				card={
					hasQuery(start.query) ? (
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
						<FirstSteps ratings={data.ratings} />
					)
				}
			/>
			{gap === "e" ? null : doors}
			<GapSwitcher
				current={gap}
				shelfSource={oldShelf ? "everyone's start titles" : own.source}
			/>
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
