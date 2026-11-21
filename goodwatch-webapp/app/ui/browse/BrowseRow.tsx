// The Browse row under Explore's tabs: Movies & Shows, then the rooms (Overview · Moods · Genres · Eras · Places ·
// Streaming · Tropes). It is the site's third-level row (ui/navigation/SubNav.tsx) with the kind control at its start:
// the same bar color, item type and amber dot. From `lg` it sticks under the tab row; on a phone it is a quiet row in
// the page that scrolls away (two persistent bars at most). Top has its own Explore tab and no Browse row.
import { Link, useNavigation } from "@remix-run/react"
import { LayoutGroup, motion } from "framer-motion"
import { useId, useLayoutEffect, useRef } from "react"
import {
	type Address,
	type Family,
	KINDS,
	type Kind,
	browsePath,
	familyPage,
	hub,
	kindLabel,
	withKind,
} from "~/domain/browse/address"
import { STICKY_SUBBAR } from "~/ui/layers"
import { UNDER_TABS } from "~/ui/navigation/AreaTabs"
import { SUBNAV_BAR, SUBNAV_LIST, SUBNAV_MARK, subnavItem } from "~/ui/navigation/bar-layers"
import { WRAP } from "./base"
import { KindControl } from "./KindControl"
import { QUICK_T } from "./motion"

/** The amber dot travels between rooms: ease-in-out, a touch slower than a hover so the eye follows it. */
const DOT_MOVE = { duration: 0.32, ease: [0.65, 0, 0.35, 1] } as const

export type RoomKey = "overview" | "mood" | "genre" | "decade" | "country" | "service" | "trope"

export const ROOMS: readonly { key: RoomKey; label: string }[] = [
	{ key: "overview", label: "Overview" },
	{ key: "mood", label: "Moods" },
	{ key: "genre", label: "Genres" },
	{ key: "decade", label: "Eras" },
	{ key: "country", label: "Places" },
	{ key: "service", label: "Streaming" },
	{ key: "trope", label: "Tropes" },
]

/** Themes and styles (blend parts without an index) live in the Genres room. */
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

/** The rooms a page lights: a blend belongs to every family it mixes, so it lights each of their rooms. */
export function roomsOf(a: Address): RoomKey[] {
	if (a.view === "family" && a.family) return [ROOM_OF[a.family]]
	if (a.view === "place" && a.parts.length)
		return [...new Set(a.parts.map((p) => ROOM_OF[p.family]))]
	return ["overview"]
}

export function roomAddress(kind: Kind, key: RoomKey, country = "us"): Address {
	if (key === "overview") return hub(kind)
	return familyPage(kind, key, country)
}

/** Movies, shows, both: the same page for each, and which one the address is on. */
export const kindChoices = (address: Address) =>
	KINDS.map((k) => ({
		kind: k,
		label: kindLabel(k),
		href: browsePath(withKind(address, k)),
		on: address.kind === k,
	}))

export function BrowseRow({
	address,
	streamingCountry = address.country,
}: {
	address: Address
	/** The country the Streaming room opens on: the viewer's, where known. */
	streamingCountry?: string
}) {
	const hrefOf = (key: RoomKey) => browsePath(roomAddress(address.kind, key, streamingCountry))
	// The room a click is already loading lights at once; the page follows.
	const navigation = useNavigation()
	const going = navigation.state !== "idle" ? navigation.location?.pathname : undefined
	const pending = going ? ROOMS.find((r) => hrefOf(r.key) === going)?.key : undefined
	const lit = pending ? [pending] : roomsOf(address)
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
	const kinds = <KindControl kinds={kindChoices(address)} />
	// The kind control's track runs on to the screen's left edge: a band in the track's color from the track's left
	// edge to the far left, so the control reads as a tab growing out of the edge. The track drops its left rounding
	// inside it (`group-data-[kband]` in KindControl).
	const band = (
		<span
			aria-hidden
			className="pointer-events-none absolute inset-y-0 right-full w-[100vw] border-y border-white/[0.14] bg-white/[0.08]"
		/>
	)
	const current = (key: RoomKey) =>
		lit.includes(key) ? (key === here ? ("page" as const) : ("true" as const)) : undefined
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
							{ROOMS.map((r) => {
								const on = lit.includes(r.key)
								return (
									<li key={r.key} className="flex h-full shrink-0 items-center">
										<Link
											to={hrefOf(r.key)}
											prefetch="intent"
											aria-current={current(r.key)}
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
					{ROOMS.map((r) => {
						const on = lit.includes(r.key)
						return (
							<Link
								key={r.key}
								to={hrefOf(r.key)}
								prefetch="intent"
								aria-current={current(r.key)}
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
