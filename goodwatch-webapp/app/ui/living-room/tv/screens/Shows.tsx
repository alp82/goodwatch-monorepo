// My shows, a member's: the shows with a Next episode, then the Want to See shows to start, as posters in one row
// that pages sideways. The show with the focus is named above the row, with its Next episode or what starting it
// takes, and its backdrop is the picture. A show opens its title screen, where Seen it marks the Next episode.
// A chunk the TV asks for on first use (screen-code.tsx).
//
// The rows are the member's loader's (tv-shows.ts, `showRows`). A show the New episodes signal counts carries
// "New" on its poster, and the line under the screen's name says what is new.
//
// A poster says what a press leads to: the Next episode with its length ("S2 E4 · 50 min"), or "Start". On the
// phone a poster is too small for that, and the line of the focused show says it.
//
// On the phone every key is a touch target, 44 px or more on the phone's screen (`keySize` in kit.tsx). The last
// row is the Expand key's corner at the bottom right; My shows has no key of its own there.
import { useRef } from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import {
	Frame,
	Img,
	Item,
	backdropSize,
	keySize,
	useReport,
	useTvView,
} from "../kit"
import { TV_ROW_ATTR } from "../tv-dom"
import {
	NO_SIGNAL,
	SHOWS_EMPTY,
	type TvShowRow,
	type TvShows,
	type TvShowsSignal,
	showRows,
	showsCrumb,
} from "../tv-shows"
import { type TvShowsReport, useTvShows } from "../use-tv-shows"

/**
 * What is new for the member's shows (use-tv-shows.ts). Draws nothing. The scene mounts it once for a member and
 * gets what it holds through `report`. It is in this chunk, so the signal's words cost nothing in the page's
 * first view.
 */
export function ShowsData({
	report,
}: { report: (signal: TvShowsReport | null) => void }) {
	useReport(report, useTvShows())
	return null
}

/** A long name is set smaller, so it stays on two lines. */
const nameSize = (name: string, large: number, small: number) =>
	name.length > 16 ? small : large

/** "New" on the poster of a show the New episodes signal counts, in the signal's sky blue. */
function Fresh({ phone }: { phone: boolean }) {
	return (
		<span
			className={`absolute left-0 top-0 z-[1] rounded-br-[12px] bg-sky-300 font-bold uppercase leading-none tracking-[0.08em] text-black ${phone ? "px-2 py-1.5 text-[20px]" : "px-3 py-2 text-[20px]"}`}
		>
			New
		</span>
	)
}

export default function Shows({
	items,
	shows,
	signal,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	/** The member's shows on the TV, from the loader. */
	shows: TvShows | null
	/** What is new for them; null until its data component has reported. */
	signal: TvShowsSignal | null
}) {
	const { canvas, focused } = useTvView()
	const P = canvas.edition === "phone"
	const news = signal ?? NO_SIGNAL
	const rows = showRows(shows, news).filter((row) => items.includes(row.item))
	// The show the screen names and shows behind everything: the one with the focus, and while the focus is on the
	// bar, the one that had it last.
	const last = useRef<string | null>(null)
	const at = rows.find((row) => row.item === focused)
	if (at) last.current = at.key
	const shown: TvShowRow | null =
		rows.find((row) => row.key === last.current) ?? rows[0] ?? null
	const behind = shown?.backdrop_path
		? tmdbImageUrl(shown.backdrop_path, backdropSize(canvas))
		: undefined
	const crumb = showsCrumb(shows, news)
	const poster = (row: TvShowRow, size: string) =>
		row.poster_path && (
			<Img
				src={tmdbImageUrl(row.poster_path, size)}
				className="absolute inset-0 h-full w-full"
			/>
		)
	// A screen reader hears the show, where a press leads, and that it is new.
	const said = (row: TvShowRow) =>
		`${row.title}, ${row.fresh ? "new, " : ""}${row.label}`

	// The phone: one line of name, one of facts, the posters as tall as is left, and the Expand key's corner.
	if (P)
		return (
			<Frame name="My shows" crumb={crumb} items={items} art={behind}>
				<div className="flex h-full flex-col">
					{shown ? (
						<div key={shown.key} className="tvc-fade shrink-0">
							<div className="truncate text-[30px] font-bold leading-none tracking-tight">
								{shown.title}
							</div>
							<div className="mt-2 truncate text-[20px] leading-tight text-white/75">
								{shown.facts}
							</div>
						</div>
					) : (
						<div className="shrink-0">
							<div className="text-[30px] font-bold leading-none tracking-tight">
								{SHOWS_EMPTY.title}
							</div>
							<div className="mt-2 text-[20px] leading-tight text-white/75">
								{SHOWS_EMPTY.line}
							</div>
						</div>
					)}
					<div
						{...{ [TV_ROW_ATTR]: "" }}
						className="relative -mx-5 flex min-h-0 flex-1 gap-3.5 overflow-hidden px-5 py-3.5"
					>
						{rows.map((row) => (
							<Item
								key={row.key}
								id={row.item}
								label={said(row)}
								// Four posters fit the row: a taller phone leaves the rest under them.
								className="tvc-tile aspect-[2/3] h-full max-h-[156px] shrink-0 bg-[#10131c]"
							>
								{poster(row, "w185")}
								{row.fresh && <Fresh phone />}
							</Item>
						))}
					</div>
					{/* The Expand key's corner is at this row's right end. */}
					<div className="shrink-0" style={{ height: keySize(canvas, 54) }} />
				</div>
			</Frame>
		)
	return (
		<Frame name="My shows" crumb={crumb} items={items} art={behind} reserve>
			<div className="flex min-h-full flex-col justify-between">
				<div className="w-[820px]">
					{shown ? (
						<div key={shown.key} className="tvc-fade">
							<div
								className="line-clamp-2 font-bold leading-none tracking-tight"
								style={{ fontSize: nameSize(shown.title, 62, 46) }}
							>
								{shown.title}
							</div>
							<div className="mt-3 truncate text-[26px] text-white/75">
								{shown.facts}
							</div>
						</div>
					) : (
						<>
							<div className="text-[46px] font-bold leading-none tracking-tight">
								{SHOWS_EMPTY.title}
							</div>
							<div className="mt-3 text-[26px] leading-snug text-white/75">
								{SHOWS_EMPTY.line}
							</div>
						</>
					)}
				</div>
				<div
					{...{ [TV_ROW_ATTR]: "" }}
					className="relative -mx-6 flex gap-6 overflow-hidden px-6 py-7"
				>
					{rows.map((row) => (
						<Item
							key={row.key}
							id={row.item}
							label={said(row)}
							className="tvc-tile shrink-0 bg-[#10131c]"
							style={{ width: 172, height: 258 }}
						>
							{poster(row, "w342")}
							{row.fresh && <Fresh phone={false} />}
							<span className="absolute inset-x-0 bottom-0 truncate bg-black/80 px-3 py-2 text-[21px] font-bold leading-tight">
								{row.label}
							</span>
						</Item>
					))}
				</div>
			</div>
		</Frame>
	)
}
