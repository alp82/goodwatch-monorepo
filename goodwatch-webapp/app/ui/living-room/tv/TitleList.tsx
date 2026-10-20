import type { PresentedMedia } from "~/utils/media-presentation"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { mediaTextAttributes } from "~/ui/media-text/media-text"
import { MediaFact } from "./MediaFact"
// A handful of titles on the TV: the focused one's name and facts over a row of posters, its backdrop behind
// everything, and the screen's own keys beside the row. One list for every app, as in the prototype: Discover's
// titles of a choice (with Change), an island's titles (with the islands to sail to), a side's titles and the
// quiz's picks (with Rate more), a member's shows (My shows: a poster then says where a press leads, and a show
// that is new is marked), and what to watch on a streaming service (under the service's mark, in a row that
// pages).
//
// What an app says of itself is its props: the screen's name and what stands under it, the titles, the keys with
// what they are called, the words while there is no title, and a picture for while no title has one.
//
// The Expand key's place is the Frame's corner at the bottom right. The desktop keeps the band under the posters
// free for it (`reserve`); on the phone the last row, the keys', ends before it.
//
// Several chunks share this file. It draws with kit.tsx, which is the TV's and on no other page, so the build keeps
// it out of every page's shell (vite.config.js, rule 3).
import { type ReactNode, useRef } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { Frame, Img, Item, backdropSize, keySize, useTvView } from "./kit"
import { TV_ROW_ATTR } from "./tv-dom"

/** A title as a list shows it. */
export type TvListTitle = PresentedMedia & {
	/** `movie-603`, as in the TV's URL: its item is `title:movie-603`. */
	key: string
	title: string
	/** TMDB paths; null when the title has none. */
	poster: string | null
	backdrop: string | null
	/** "2019 · Movie · 87 score · 93% match". */
	factMedia?: { text: string; lang: string; at?: number }
	facts: string
	/** Words on the poster itself, on the desktop: where a press leads ("S2 E4 · 50 min", "Start"). My shows'. */
	label?: string
	/** A mark in the poster's corner, in the New episodes signal's sky blue: "New". My shows'. */
	mark?: string
	/** For a screen reader, where the title alone does not say it all ("Slow Horses, new, S2 E4 · 50 min"). */
	says?: string
}

/** A key of the list's own, beside the posters. */
export type TvListAction = {
	/** Its item: `change`, `start-quiz`, `hop:<island>`. */
	id: string
	label: string
	/** For a screen reader, where the label alone does not say what the key does ("Sail to Scary"). */
	says?: string
	/** A mark in this colour before the label on the desktop: the island a key sails to, as it is on the map. */
	mark?: string
}

/** How wide the Expand key's corner is on the phone: the last row ends before it. */
const PHONE_CORNER = "pr-[158px]"

/** A long name is set smaller, so it stays on two lines. */
const nameSize = (name: string) =>
	name.length > 28 ? 38 : name.length > 16 ? 46 : 62

export function TitleList({
	name,
	crumb,
	items,
	titles,
	empty,
	actions = [],
	actionsLabel,
	art,
	mark,
	edge,
}: {
	/** The screen's name in the top bar, and what stands under it. */
	name: string
	crumb?: string
	/** The screen's items, from `tvItems`: the list draws the titles and the keys that are among them. */
	items: readonly string[]
	titles: readonly TvListTitle[]
	/** What the list says while it has no title. */
	empty: string
	actions?: readonly TvListAction[]
	/** What stands over the keys on the desktop: "Sail to". */
	actionsLabel?: string
	/** A backdrop's TMDB path for while no title has one. */
	art?: string | null
	/** What stands before the screen's name in the top bar: a service's mark. */
	mark?: ReactNode
	/** A colour for a thin line along the picture's top edge: a service's own. */
	edge?: string
}) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
	const on = titles.filter((title) => items.includes(`title:${title.key}`))
	const keys = actions.filter((action) => items.includes(action.id))
	// The title the screen names and shows behind everything: the one with the focus, and while the focus is on a
	// key or the bar, the one that had it last.
	const last = useRef<string | null>(null)
	const at = on.find((title) => `title:${title.key}` === focused)
	if (at) last.current = at.key
	const shown = on.find((title) => title.key === last.current) ?? on[0] ?? null
	const behind = shown?.backdrop ?? art
	const frame = {
		name,
		crumb,
		items,
		art: behind ? tmdbImageUrl(behind, backdropSize(canvas)) : undefined,
		mark,
		edge,
	}
	const posters = on.map((title) => (
		<Item
			key={title.key}
			id={`title:${title.key}`}
			label={title.says ?? title.title}
			// The phone: as tall as the row, and no taller than lets four stand side by side.
			className={`tvc-tile shrink-0 bg-[#10131c] ${P ? "aspect-[2/3] h-full max-h-[156px]" : ""}`}
			style={P ? undefined : { width: 163, height: 244 }}
		>
			{title.poster && (
				<Img
					src={tmdbImageUrl(title.poster, P ? "w185" : "w342")}
					className="absolute inset-0 h-full w-full"
				/>
			)}
			{/* It stays bright on a poster that sits back: raised over the tile's shade. */}
			{title.mark && (
				<span
					className={`absolute left-0 top-0 z-[1] rounded-br-[12px] bg-sky-300 text-[20px] font-bold uppercase leading-none tracking-[0.08em] text-black ${P ? "px-2 py-1.5" : "px-3 py-2"}`}
				>
					{title.mark}
				</span>
			)}
			{/* On the phone a poster is too small for words: the focused title's line says them. */}
			{!P && title.label && (
				<span className="absolute inset-x-0 bottom-0 truncate bg-black/80 px-3 py-2 text-[21px] font-bold leading-tight">
					{title.label}
				</span>
			)}
		</Item>
	))

	// The phone: one line of name, one of facts, the posters as tall as is left, and the keys beside the Expand
	// key's corner. The row is as tall as a key with or without one, so nothing above it reaches into the corner.
	if (P) {
		const height = keySize(canvas, 54)
		return (
			<Frame {...frame}>
				<div className="flex h-full flex-col">
					{shown ? (
						<div key={shown.key} className="tvc-fade h-[64px] shrink-0">
							<div
								{...mediaTextAttributes(mediaFieldLanguage(shown))}
								className="truncate text-[30px] font-bold leading-none tracking-tight"
							>
								{shown.title}
							</div>
							<div className="mt-2 truncate text-[20px] leading-tight text-white/75">
								<MediaFact text={shown.facts} media={shown.factMedia} />
							</div>
						</div>
					) : (
						<div className="h-[64px] shrink-0 text-[24px] leading-tight text-white/70">
							{empty}
						</div>
					)}
					<div
						{...{ [TV_ROW_ATTR]: "" }}
						className="relative -mx-5 flex min-h-0 flex-1 gap-3.5 overflow-hidden px-5 py-3.5"
					>
						{posters}
					</div>
					<div
						className={`flex shrink-0 items-center gap-2 ${PHONE_CORNER}`}
						style={{ height }}
					>
						{keys.map((action) => (
							<Item
								key={action.id}
								id={action.id}
								label={action.says}
								// Two keys share the row: each has less room around its words.
								className={`tvc-btn flex min-w-0 items-center text-[21px] ${keys.length > 1 ? "px-4" : "px-6"}`}
								style={{ height }}
							>
								<span className="truncate">{action.label}</span>
							</Item>
						))}
					</div>
				</div>
			</Frame>
		)
	}
	return (
		<Frame {...frame} reserve>
			<div className="flex h-full flex-col justify-between">
				<div className="h-[136px] w-[820px] shrink-0">
					{shown ? (
						<div key={shown.key} className="tvc-fade">
							<div
								{...mediaTextAttributes(mediaFieldLanguage(shown))}
								className="line-clamp-2 font-bold leading-none tracking-tight"
								style={{ fontSize: nameSize(shown.title) }}
							>
								{shown.title}
							</div>
							<div className="mt-3 truncate text-[26px] text-white/75">
								<MediaFact text={shown.facts} media={shown.factMedia} />
							</div>
						</div>
					) : (
						<div className="text-[32px] text-white/70">{empty}</div>
					)}
				</div>
				<div className="flex min-h-0 shrink-0 items-end gap-8">
					<div
						{...{ [TV_ROW_ATTR]: "" }}
						className="relative -mx-6 flex min-w-0 flex-1 gap-6 overflow-hidden px-6 py-5"
					>
						{posters}
					</div>
					{keys.length > 0 && (
						<div className="flex shrink-0 flex-col gap-3 pb-7">
							{actionsLabel && (
								<span className="text-[24px] text-white/70">
									{actionsLabel}
								</span>
							)}
							{keys.map((action) => (
								<Item
									key={action.id}
									id={action.id}
									label={action.says}
									className={`tvc-btn flex h-[68px] items-center whitespace-nowrap px-8 text-[26px] ${action.mark ? "gap-3.5" : "justify-center"}`}
								>
									{action.mark && (
										<span
											aria-hidden="true"
											className="h-[22px] w-[30px] shrink-0 rounded-[50%]"
											style={{ background: action.mark }}
										/>
									)}
									{action.label}
								</Item>
							))}
						</div>
					)}
				</div>
			</div>
		</Frame>
	)
}
