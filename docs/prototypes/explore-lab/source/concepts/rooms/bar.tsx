// PROTOTYPE - throwaway (prototype/explore-r4, concept rooms). The row under Explore's tabs: Movies | Shows, then the
// rooms (Overview · Moods · Genres · Eras · Places · Streaming · Best). It is the existing third-level row
// (ui/navigation/SubNav.tsx) with the kind switch at its start: the same bar color, item type and amber dot. From `lg`
// it sticks under the tab row; on a phone it is a quiet row in the page that scrolls away (two persistent bars at most).
import { Link, useNavigation } from "@remix-run/react"
import { LayoutGroup, motion } from "framer-motion"
import { type ReactNode, useId, useLayoutEffect, useRef } from "react"
import { STICKY_SUBBAR } from "~/ui/layers"
import { UNDER_TABS } from "~/ui/navigation/AreaTabs"
import { SUBNAV_BAR, SUBNAV_LIST, SUBNAV_MARK, subnavItem } from "~/ui/navigation/bar-layers"
import { Segmented } from "~/ui/selection/Segmented"
import {
	type Address,
	type Family,
	type Kind,
	best,
	familyPage,
	hub,
	withKind,
} from "../../kit/address"
import { WRAP } from "../../kit/ui"
import { QUICK_T } from "../../kit/ui/motion"

/** The amber dot travels between rooms (round 6: ease-in-out, a touch slower than a hover so the eye follows it). */
const DOT_MOVE = { duration: 0.32, ease: [0.65, 0, 0.35, 1] } as const

export type RoomKey =
	| "overview"
	| "mood"
	| "genre"
	| "decade"
	| "country"
	| "service"
	| "trope"
	| "best"

export const ROOMS: { key: RoomKey; label: string }[] = [
	{ key: "overview", label: "Overview" },
	{ key: "mood", label: "Moods" },
	{ key: "genre", label: "Genres" },
	{ key: "decade", label: "Eras" },
	{ key: "country", label: "Places" },
	{ key: "service", label: "Streaming" },
	{ key: "trope", label: "Tropes" },
	{ key: "best", label: "Best" },
]

/** Themes and styles live in the Genres room. */
const ROOM_OF: Record<Family, RoomKey> = {
	mood: "mood",
	genre: "genre",
	theme: "genre",
	style: "genre",
	trait: "genre",
	decade: "decade",
	country: "country",
	service: "service",
	trope: "trope",
}

export function roomOf(a: Address): RoomKey {
	if (a.view === "best") return "best"
	if (a.view === "family" && a.family) return ROOM_OF[a.family]
	if (a.view === "place" && a.parts[0]) return ROOM_OF[a.parts[0].family]
	return "overview"
}

/**
 * Round 8: how a blend lights the row. A blend belongs to every family it mixes, so lighting only its first part's
 * room ("Genres" on "Graphic movies from the 1990s", reached from an era) misleads. "all" lights each family in the
 * blend, "none" lights no room (the title names the parts), "first" is the old rule.
 */
export type BlendLight = "all" | "none" | "first"

export function roomsOf(a: Address, blend: BlendLight = "first"): RoomKey[] {
	if (a.view === "place" && a.parts.length > 1 && blend !== "first") {
		if (blend === "none") return []
		return [...new Set(a.parts.map((p) => ROOM_OF[p.family]))]
	}
	return [roomOf(a)]
}

export function roomAddress(kind: Kind, key: RoomKey): Address {
	if (key === "overview") return hub(kind)
	if (key === "best") return best(kind)
	return familyPage(kind, key)
}

export function RoomsBar({
	address,
	to,
	kindControl,
	rooms = ROOMS,
	blend = "first",
}: {
	address: Address
	to: (a: Address) => string
	/** Round 5: the lab's own Movies | Shows control (its `kind` slot) in place of the default one. */
	kindControl?: ReactNode
	/** Round 7: the rooms to show (the lab leaves Best out; it has its own Explore tab). */
	rooms?: typeof ROOMS
	/** Round 8: how a blend lights the row (see `BlendLight`). */
	blend?: BlendLight
}) {
	// The room a click is already loading lights at once; the page follows.
	const navigation = useNavigation()
	const going = navigation.state !== "idle" ? navigation.location?.pathname : undefined
	const pending = going
		? rooms.find((r) => to(roomAddress(address.kind, r.key)).split("?")[0] === going)?.key
		: undefined
	const lit = pending ? [pending] : roomsOf(address, blend)
	// The amber dot travels with the first lit room; a blend's other rooms get a still dot of their own.
	const here = lit[0]
	const thumb = useId()
	const phoneRow = useRef<HTMLDivElement>(null)
	// The current room stays in view in the phone's row, which scrolls sideways.
	useLayoutEffect(() => {
		const row = phoneRow.current
		const el = row?.querySelector<HTMLElement>("[aria-current='page']")
		if (!row || !el || row.scrollWidth <= row.clientWidth) return
		row.scrollLeft = Math.max(0, el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2)
	}, [here])
	const kinds = kindControl ?? (
		<Segmented<Kind>
			label="Movies or shows"
			size="sm"
			// Movies and shows together (`/all`) has no option of its own here; Movies stays lit.
			value={address.kind === "show" ? "show" : "movie"}
			options={(["movie", "show"] as Kind[]).map((k) => ({
				key: k,
				label: k === "movie" ? "Movies" : "Shows",
				href: to(withKind(address, k)),
			}))}
		/>
	)
	// The kind control's track runs on to the screen's left edge: a band in the track's color from the track's left
	// edge to the far left, so the control reads as a tab growing out of the edge (round 11, owner's ask). The track
	// drops its left rounding inside it (see slots/kind/track.tsx, `group-data-[kband]`).
	const band = (
		<span
			aria-hidden
			className="pointer-events-none absolute inset-y-0 right-full w-[100vw] border-y border-white/[0.14] bg-white/[0.08]"
		/>
	)
	return (
		<>
			<nav
				aria-label="Browse"
				className={`sticky ${UNDER_TABS.one} ${STICKY_SUBBAR} h-11 overflow-x-clip ${SUBNAV_BAR} max-lg:hidden`}
			>
				<LayoutGroup id={thumb}>
					<div className={`${WRAP} flex h-full items-center gap-4`}>
						<div data-kband="" className="group relative shrink-0 origin-left scale-[0.92]">
							{band}
							{kinds}
						</div>
						<span aria-hidden className="h-4 w-px shrink-0 bg-white/10" />
						<ul className={`${SUBNAV_LIST} min-w-0`}>
							{rooms.map((r) => {
								const on = lit.includes(r.key)
								return (
									<li key={r.key} className="flex h-full shrink-0 items-center">
										<Link
											to={to(roomAddress(address.kind, r.key))}
											prefetch="intent"
											aria-current={on ? (r.key === here ? "page" : "true") : undefined}
											className={`${subnavItem(on)} ${QUICK_T} shrink-0 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
										>
											{on &&
												(r.key === here ? (
													<motion.span
														layoutId={thumb}
														aria-hidden
														transition={DOT_MOVE}
														className={SUBNAV_MARK}
													/>
												) : (
													<span aria-hidden className={SUBNAV_MARK} />
												))}
											<span className="relative">{r.label}</span>
										</Link>
									</li>
								)
							})}
						</ul>
					</div>
				</LayoutGroup>
			</nav>
			<nav aria-label="Browse" className="space-y-1 overflow-x-clip px-4 pt-3 sm:px-6 lg:hidden">
				<div data-kband="" className="group relative w-fit">
					{band}
					{kinds}
				</div>
				<div
					ref={phoneRow}
					className="-mx-4 flex items-center gap-5 overflow-x-auto px-4 text-sm [scrollbar-width:none] sm:-mx-6 sm:px-6"
				>
					{rooms.map((r) => {
						const on = lit.includes(r.key)
						return (
							<Link
								key={r.key}
								to={to(roomAddress(address.kind, r.key))}
								prefetch="intent"
								aria-current={on ? (r.key === here ? "page" : "true") : undefined}
								className={`relative shrink-0 py-2.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${QUICK_T} ${
									on ? "font-bold text-white" : "text-gray-400 active:text-gray-200"
								}`}
							>
								{r.label}
								{on &&
									(r.key === here ? (
										<motion.span
											layoutId={`${thumb}-phone`}
											transition={DOT_MOVE}
											aria-hidden
											className="absolute inset-x-0 bottom-1 h-0.5 rounded-full bg-amber-400"
										/>
									) : (
										<span
											aria-hidden
											className="absolute inset-x-0 bottom-1 h-0.5 rounded-full bg-amber-400"
										/>
									))}
							</Link>
						)
					})}
				</div>
			</nav>
		</>
	)
}
