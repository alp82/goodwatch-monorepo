// PROTOTYPE - throwaway. Issue #489, part B: picks. The app knows when a Want to See title first appeared on one of
// a member's services (#456) and uses it only for a signal that clears when the member opens the page. Here Tonight's
// pick and home's doors prefer such a title and say why. Four variations of a member's home, switchable with the
// pill at the bottom (or the left and right arrow keys):
//   /prototype/arrival-picks?variant=A|B|C|D
//     A  The door names it     the landed title leads its own door for 7 days; tonight's pick keeps its order
//     B  It takes tonight      a landed title is Tonight's pick for 3 days, over everything, on one wide door
//     C  A bonus that fades    points: a landing adds a bonus for 14 days; the pill is the reason
//     D  A row of its own      nothing is preferred; the TV lists what landed under the doors
//     &case=none|one|several|both|fresh|old      the prepared member (see CASES in the model)
//     &watching=yesterday|earlier|none           how lately the member watched the show they are in
//     &visited=yes                               the member opened My movies and My shows since: the signal cleared
//     &panel=off                                 hides the debug panel
// The member, the titles and the times are made up and live in the browser: no loader reads a service, nothing is
// written. The doors, the header and the dock are copies of the built ones; the room and the remote are the real
// ones. Notes and screenshots: docs/prototypes/arrival-picks/README.md.
import type { LinksFunction } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { useMemo, useState } from "react"
import { openerWords } from "~/domain/newly-available-signal"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import {
	DebugPanel,
	SiteChrome,
	pickReason,
} from "~/ui/prototype-arrival-picks/chrome"
import { SCREENS } from "~/ui/prototype-arrival-picks/doors"
import {
	CASES,
	type CaseKey,
	type DoorKey,
	VARIANTS,
	type VariantKey,
	WATCHING,
	type WatchingKey,
	decide,
} from "~/ui/prototype-arrival-picks/model"
import { Room } from "~/ui/prototype-watching-2/room"
import { assetUrl } from "~/utils/asset-url"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return null
}

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: assetUrl(livingRoomCss) },
]
export const meta = () => [
	{ title: "Arrival picks prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

const choice = <K extends string>(
	choices: Record<K, unknown>,
	value: string | null,
	fallback: K,
): K => (value !== null && value in choices ? (value as K) : fallback)

const DOOR_LCD: Record<DoorKey, string> = {
	continue: "CONTINUE",
	start: "START A SHOW",
	movie: "A MOVIE",
}

export default function ArrivalPicksPrototype() {
	const [params] = useSearchParams()
	const variant = choice<VariantKey>(VARIANTS, params.get("variant"), "A")
	const setup = useMemo(
		() => ({
			case: choice<CaseKey>(CASES, params.get("case"), "one"),
			watching: choice<WatchingKey>(
				WATCHING,
				params.get("watching"),
				"yesterday",
			),
			visited: params.get("visited") === "yes",
		}),
		[params],
	)
	const { arrivals, signal, decision } = useMemo(
		() => decide(variant, setup),
		[variant, setup],
	)

	// The doors in their order on the TV; B draws the wide one first.
	const order = useMemo(() => {
		const doors = (["continue", "start", "movie"] as const).filter(
			(door) => decision.doors[door],
		)
		return decision.hero
			? [decision.hero, ...doors.filter((door) => door !== decision.hero)]
			: doors
	}, [decision])
	const [focus, setFocus] = useState<string>("")
	const focused = (order as string[]).includes(focus) ? focus : order[0]
	const lead = decision.doors[focused as DoorKey]
	const lcd: [string, string] = [
		DOOR_LCD[focused as DoorKey],
		[
			lead?.title.title,
			lead?.episode?.code,
			focused === decision.pick.door ? pickReason(decision) : null,
		]
			.filter(Boolean)
			.join(" · "),
	]

	const Screen = SCREENS[variant]
	const home = { decision, focus: focused, setFocus, open: setFocus }
	return (
		<>
			<SiteChrome
				decision={decision}
				opener={openerWords(signal.episodes, signal.landed)}
			/>
			<Room
				desktop={<Screen {...home} />}
				phone={<Screen {...home} phone />}
				lcd={lcd}
				onStep={(by) =>
					setFocus(
						order[
							(order.indexOf(focused as DoorKey) + by + order.length) %
								order.length
						],
					)
				}
				onOk={() => {}}
			/>
			{params.get("panel") !== "off" && (
				<DebugPanel setup={setup} decision={decision} arrivals={arrivals} />
			)}
			<PrototypeSwitcher
				variants={VARIANTS}
				position="bottom-[104px] left-1/2 -translate-x-1/2 lg:bottom-6"
			/>
		</>
	)
}
