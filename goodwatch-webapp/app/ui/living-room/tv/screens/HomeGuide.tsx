// Home as a guide (#673), for a member with Sides of you, on the desktop edition. On the left, the apps and then
// the member's sides stand in a list, like a TV's channels; Up and Down move along it (tv-machine.ts, "Home's
// sides"). On the right, whatever has the focus: an app as home's row shows it, or a side's loved posters, its
// picks in personal order and Watch next. The first side is tonight's: the one holding the best pick.
//
// A side is shown by its loved posters alone. Every word a member sees or hears here comes from
// home-sides-copy.ts; a side's name and moods show only when the server sends them (`words`, behind the words
// gate). Motion is transform and opacity only: the list slides, the right side fades.
import { useRef } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import {
	FEW_ON_SERVICES,
	LOVED_LABEL,
	NO_PICKS,
	SIDES_HEADING,
	WATCH_NEXT_LABEL,
	sideEntryLabel,
	watchNextKey,
} from "../home-sides-copy"
import { CornerBar, Cross, Img, Item, backdropSize, useTvView } from "../kit"
import { TV_ROW_ATTR } from "../tv-dom"
import type { TvAppTile, TvHomeSide } from "../tv-home"
import { AppArt, artFiles } from "./app-art"

const LIST_TOP = 120
const LIST_BOTTOM = 620
const APP_H = 56
const SIDE_H = 92
const GAP = 10
const HEADING = 44
const POSTER_W = 110
const POSTER_H = 165

type Entry =
	| { id: string; app: TvAppTile; side?: undefined }
	| { id: string; side: TvHomeSide; at: number; app?: undefined }

export function HomeGuide({
	headline,
	apps,
	sides,
	items,
}: {
	/** The start page's H1, for a screen reader here. */
	headline: string
	apps: readonly TvAppTile[]
	sides: readonly TvHomeSide[]
	items: readonly string[]
}) {
	const { canvas, focused } = useTvView()
	const entries: Entry[] = [
		...apps.map((app) => ({ id: `app:${app.app}`, app })),
		...sides.map((side, at) => ({ id: `home-side:${side.id}`, side, at })),
	]

	// Where each entry stands in the list, with the heading over the sides.
	let y = 0
	const place = new Map<string, { top: number; h: number }>()
	entries.forEach((entry, at) => {
		if (at === apps.length) y += HEADING
		const h = entry.side ? SIDE_H : APP_H
		place.set(entry.id, { top: y, h })
		y += h + GAP
	})
	const total = y

	// The entry that is on: the focused one, or the side whose pick or key has the focus; while the focus is on the
	// bar, the one that was on last.
	const last = useRef(entries[0].id)
	const owner = ownerOf(focused, sides)
	if (owner && entries.some((entry) => entry.id === owner)) last.current = owner
	const on = entries.find((entry) => entry.id === last.current) ?? entries[0]
	const side = on.side

	// The list slides so the entry that is on stays in view.
	const room = LIST_BOTTOM - LIST_TOP
	const at = place.get(on.id) ?? { top: 0, h: APP_H }
	const slide = Math.max(
		0,
		Math.min(total - room, at.top + at.h / 2 - room / 2),
	)

	const backdrop = backdropSize(canvas)
	const pickKey = focused.startsWith("title:")
		? focused.slice("title:".length)
		: null
	const pick = side
		? (side.picks.find((title) => title.key === pickKey) ?? side.picks[0])
		: null
	const files = side
		? pick?.backdrop
			? [tmdbImageUrl(pick.backdrop, backdrop)]
			: []
		: on.app
			? artFiles(on.app.art, backdrop, "w342")
			: []
	return (
		<>
			<Cross
				id={`${on.id}:${pick?.key ?? ""} ${files.join(" ")}`}
				files={files}
			>
				{on.app ? (
					<AppArt art={on.app.art} files={files} className="h-full w-full" />
				) : files[0] ? (
					<Img src={files[0]} className="h-full w-full" />
				) : (
					<span className="block h-full w-full bg-[#10131c]" />
				)}
			</Cross>
			{/* The list's side is dark; the picture shows on the right. */}
			<div
				className="absolute inset-0"
				style={{
					background:
						"linear-gradient(90deg, rgba(5,6,10,.97) 0%, rgba(5,6,10,.93) 30%, rgba(5,6,10,.45) 60%, rgba(5,6,10,.2) 100%), linear-gradient(0deg, rgba(5,6,10,.85) 0%, rgba(5,6,10,0) 55%)",
				}}
			/>
			<div className="absolute left-14 top-11 text-[22px] font-bold uppercase tracking-[0.22em] text-white/80 transition-opacity [[data-tv-toast]_&]:opacity-0">
				GoodWatch
			</div>
			<h1 className="sr-only">{headline}</h1>
			<div
				className="absolute left-10 w-[330px] overflow-hidden"
				// Entries fade at the list's ends rather than being cut.
				style={{
					top: LIST_TOP,
					height: room,
					maskImage:
						"linear-gradient(180deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%)",
				}}
			>
				<div
					className="relative transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none"
					style={{ transform: `translateY(${-slide}px)`, height: total }}
				>
					<div
						aria-hidden
						className="absolute left-4 text-[20px] font-semibold uppercase tracking-[0.14em] text-white/60"
						style={{
							top:
								(place.get(entries[apps.length]?.id)?.top ?? 0) - HEADING + 10,
						}}
					>
						{SIDES_HEADING}
					</div>
					{entries.map((entry) => {
						const box = place.get(entry.id) ?? { top: 0, h: APP_H }
						// The entry that is on keeps a light plate while the focus is in its picks.
						const lit = entry.id === on.id && focused !== entry.id
						return (
							<Item
								key={entry.id}
								id={entry.id}
								label={
									entry.side
										? sideEntryLabel(
												entry.at,
												sides.length,
												entry.side.loved.map((title) => title.title),
												entry.side.words?.name ?? null,
											)
										: undefined
								}
								className={`tvc-entry absolute inset-x-2 flex items-center gap-4 px-4 font-bold ${lit ? "bg-white/[.14]" : "bg-black/40"}`}
								style={{ top: box.top, height: box.h, borderRadius: 14 }}
							>
								{entry.side ? (
									<SideEntry side={entry.side} />
								) : (
									<span className="truncate text-[26px] font-bold">
										{entry.app.name}
									</span>
								)}
							</Item>
						)
					})}
				</div>
			</div>
			<div className="absolute left-[420px] right-14 top-[120px]">
				<div key={on.id} className="tvc-fade">
					{side ? (
						<SideHeader side={side} />
					) : on.app ? (
						<>
							<div
								className="font-bold leading-[0.95] tracking-tight"
								style={{ fontSize: 96 }}
							>
								{on.app.name}
							</div>
							<div className="mt-4 text-[32px] leading-snug text-white/85">
								{on.app.line}
							</div>
						</>
					) : null}
				</div>
			</div>
			{side && (
				<div className="absolute left-[420px] right-0" style={{ top: 384 }}>
					{side.picks.length ? (
						<div
							{...{ [TV_ROW_ATTR]: "" }}
							className="relative flex gap-[20px] overflow-hidden py-4 pl-3 pr-14"
						>
							{side.picks.map((title) => (
								<Item
									key={title.key}
									id={`title:${title.key}`}
									label={title.title}
									className="tvc-tile shrink-0 bg-[#10131c]"
									style={{ width: POSTER_W, height: POSTER_H }}
								>
									{title.poster && (
										<Img
											src={tmdbImageUrl(title.poster, "w185")}
											className="absolute inset-0 h-full w-full"
										/>
									)}
								</Item>
							))}
						</div>
					) : (
						<p className="py-4 pl-3 text-[24px] text-white/75">{NO_PICKS}</p>
					)}
					<div className="flex items-center gap-5 pl-3">
						<Item
							id={`watch-next:${side.id}`}
							label={WATCH_NEXT_LABEL}
							className="tvc-btn flex h-[56px] items-center whitespace-nowrap px-7 text-[22px]"
						>
							{watchNextKey(side.words?.moods ?? null)}
						</Item>
						{pick && (
							<span className="min-w-0 text-[20px] leading-tight text-white/75">
								<span className="block truncate font-bold text-white">
									{pick.title}
								</span>
								<span className="block truncate">{pick.facts}</span>
							</span>
						)}
					</div>
				</div>
			)}
			{/* Last in the markup, as in `tvItems`: the items are met in reading order. */}
			<CornerBar items={items} />
		</>
	)
}

/** The guide's entry an item belongs to: an entry itself, or the side a pick or a Watch next key is of. */
function ownerOf(item: string, sides: readonly TvHomeSide[]): string | null {
	if (item.startsWith("app:") || item.startsWith("home-side:")) return item
	if (item.startsWith("watch-next:"))
		return `home-side:${item.slice("watch-next:".length)}`
	if (item.startsWith("title:")) {
		const key = item.slice("title:".length)
		const side = sides.find((one) => one.picks.some((pick) => pick.key === key))
		return side ? `home-side:${side.id}` : null
	}
	return null
}

/** A side's entry in the list: its loved posters, and its name once the words gate lets it through. */
function SideEntry({ side }: { side: TvHomeSide }) {
	const name = side.words?.name
	return (
		<>
			<span className="flex h-[72px] shrink-0 gap-1 overflow-hidden rounded-[8px]">
				{side.loved.slice(0, name ? 2 : 4).map((title) => (
					<span
						key={title.key}
						className="relative block h-full w-[48px] bg-[#10131c]"
					>
						{title.poster && (
							<Img
								src={tmdbImageUrl(title.poster, "w92")}
								className="absolute inset-0 h-full w-full"
							/>
						)}
					</span>
				))}
			</span>
			{name && (
				<span className="line-clamp-3 min-w-0 text-[22px] font-bold leading-[1.1]">
					{name}
				</span>
			)}
		</>
	)
}

/** Over a side's picks: its name once the words gate lets it through, and the loved titles it is shown by. */
function SideHeader({ side }: { side: TvHomeSide }) {
	const name = side.words?.name
	return (
		<>
			{name && (
				<div className="line-clamp-2 pb-1 text-[46px] font-bold leading-[1.02] tracking-tight">
					{name}
				</div>
			)}
			<div className={`flex items-center gap-3 ${name ? "mt-3" : ""}`}>
				<span className="mr-1 w-[110px] text-[20px] leading-tight text-white/70">
					{LOVED_LABEL}
				</span>
				{side.loved.map((title) => (
					<span
						key={title.key}
						className="relative block shrink-0 overflow-hidden rounded-[8px] bg-[#10131c] shadow-lg"
						style={{ width: name ? 64 : 96, height: name ? 96 : 144 }}
					>
						{title.poster && (
							<Img
								src={tmdbImageUrl(title.poster, "w154")}
								className="absolute inset-0 h-full w-full"
							/>
						)}
						<span className="sr-only">{title.title}</span>
					</span>
				))}
			</div>
			{side.fewOnServices && (
				<div className="mt-3 text-[22px] text-white/75">{FEW_ON_SERVICES}</div>
			)}
		</>
	)
}
