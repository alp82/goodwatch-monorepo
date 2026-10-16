// PROTOTYPE - throwaway (#660). Variant "A row per side" (existing look): today's home on top, and under it one row
// per side, each its unseen titles in personal order with a Watch next key at its end. The first side's row peeks
// in at the bottom of the home. Down from the home's tiles slides the rows up; the focused title's name and facts
// stand above them, its backdrop behind everything, as on the TV's lists.
import { useRef } from "react"
import { CornerBar, Cross, Img, Item, Shade, backdropSize, useTvView } from "~/ui/living-room/tv/kit"
import { AppArt, HOME_HEADLINE } from "~/ui/living-room/tv/screens/Home"
import { TV_ROW_ATTR } from "~/ui/living-room/tv/tv-dom"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { MoodChips, PosterItem, TileItem, Wordmark, useHomeTiles, wholeArt } from "./bits"
import { WatchNextWords, useHooks, useHost, watchNextLabel } from "./host"
import { type HomeSide, shareWords, sideTitle } from "./model"

const BAND = 648
/** Where a side's row starts under the home: its header peeks in at the bottom. */
const FIRST = BAND - 50
const ROW = 318
/** Where the focused row stands on the screen. */
const AT = 250

const sideOfItem = (focused: string) => {
	const [kind, side] = focused.split(":")
	return kind === "pick" || kind === "watch" ? side : null
}

function SideRow({ side, title, top, hidden, names, marks }: { side: HomeSide; title: string; top: number; hidden: boolean; names: boolean; marks: boolean }) {
	return (
		<div className="absolute inset-x-0 transition-opacity duration-200" style={{ top, opacity: hidden ? 0 : 1 }}>
			<div className="flex items-baseline gap-4 px-14">
				<span className="min-w-0 truncate pb-1 text-[30px] font-bold leading-tight">{title}</span>
				<span className="shrink-0 whitespace-nowrap text-[22px] text-white/70">
					{shareWords(side.share)}
					{marks && " · few on your services"}
				</span>
				{/* With names off the moods stay on the Watch next key: next to the title they'd describe the person. */}
				{names && (
					<span className="shrink-0">
						<MoodChips side={side} />
					</span>
				)}
			</div>
			<div className="flex items-center gap-6 pr-14">
				<div {...{ [TV_ROW_ATTR]: "" }} className="relative flex min-w-0 flex-1 gap-[22px] overflow-hidden py-5 pl-14 pr-4">
					{side.picks.map((t) => (
						<PosterItem key={t.key} id={`pick:${side.id}:${t.key}`} title={t} width={150} height={225} />
					))}
				</div>
				<Item id={`watch:${side.id}`} label={`${watchNextLabel(side)}, on Watch next`} className="tvc-btn flex min-h-[76px] w-[260px] shrink-0 items-center px-7 py-2 text-[24px]">
					<WatchNextWords side={side} />
				</Item>
			</div>
		</div>
	)
}

export function Rows() {
	const { view, names } = useHost()
	const { canvas, focused } = useTvView()
	const { apps, services } = useHomeTiles(view)
	const tiles = [...apps, ...services]
	const backdrop = backdropSize(canvas)
	// Down from a row's Watch next key starts the next row at its first title, as Down from its posters would.
	useHooks({
		move: (dir, from) => {
			if (!from.startsWith("watch:")) return undefined
			const at = view.sides.findIndex((s) => `watch:${s.id}` === from)
			const next = view.sides[at + (dir === "down" ? 1 : dir === "up" ? -1 : 0)]
			if ((dir !== "down" && dir !== "up") || !next || at < 0) return undefined
			return next.picks[0] ? `pick:${next.id}:${next.picks[0].key}` : `watch:${next.id}`
		},
	})

	const sideId = sideOfItem(focused)
	const rowAt = view.sides.findIndex((s) => s.id === sideId)
	const lastRow = useRef(-1)
	// The bar keeps the screen where it was.
	if (rowAt >= 0) lastRow.current = rowAt
	else if (tiles.some((t) => t.id === focused)) lastRow.current = -1
	const row = lastRow.current
	const inRows = row >= 0
	const shift = inRows ? -(FIRST + row * ROW - AT) : 0

	// The focused title, in the rows.
	const lastPick = useRef<string | null>(null)
	const pickKey = focused.startsWith("pick:") ? focused.split(":").slice(2).join(":") : null
	if (pickKey) lastPick.current = pickKey
	const rowSide = inRows ? view.sides[row] : null
	const pick = rowSide ? (rowSide.picks.find((t) => t.key === lastPick.current) ?? rowSide.picks[0]) : null

	const lastTile = useRef(tiles[0].id)
	if (tiles.some((t) => t.id === focused)) lastTile.current = focused
	const tile = tiles.find((t) => t.id === lastTile.current) ?? tiles[0]

	const files = inRows ? (pick?.backdrop ? [tmdbImageUrl(pick.backdrop, backdrop)] : []) : wholeArt(tile, backdrop)
	return (
		<>
			<Cross id={`${inRows ? pick?.key : tile.id} ${files.join(" ")}`} files={files}>
				{inRows ? files[0] ? <Img src={files[0]} className="h-full w-full" /> : <span className="block h-full w-full bg-[#10131c]" /> : <AppArt art={tile.art} files={files} className="h-full w-full" />}
			</Cross>
			<Shade dim={inRows ? 0.62 : 0.5} />
			{/* What has the focus in the rows: its name and facts, over the rows. */}
			<div className="absolute left-14 top-[96px] w-[900px] transition-opacity duration-200" style={{ opacity: inRows ? 1 : 0 }}>
				{pick && (
					<div key={pick.key} className="tvc-fade">
						<div className="truncate pb-1 text-[56px] font-bold leading-tight tracking-tight">{pick.title}</div>
						<div className="mt-3 truncate text-[26px] text-white/75">{pick.facts}</div>
					</div>
				)}
			</div>
			<div className="absolute inset-0 transition-transform duration-300 ease-out" style={{ transform: `translateY(${shift}px)` }}>
				<div className="absolute inset-x-0 top-0 transition-opacity duration-200" style={{ height: BAND, opacity: inRows ? 0 : 1 }}>
					<Wordmark />
					<div className="absolute left-14 top-[120px] w-[780px]">
						<h1 className="text-[28px] text-white/75">{HOME_HEADLINE}</h1>
						<div key={tile.id} className="tvc-fade">
							<div className="font-bold leading-[0.95] tracking-tight" style={{ fontSize: 100 }}>
								{tile.name}
							</div>
							<div className="mt-4 text-[32px] leading-snug text-white/85">{tile.line}</div>
						</div>
					</div>
					<div {...{ [TV_ROW_ATTR]: "" }} className="absolute inset-x-0 flex gap-[22px] overflow-hidden px-14 py-6" style={{ top: 410 }}>
						{tiles.map((t) => (
							<TileItem key={t.id} tile={t} />
						))}
					</div>
				</div>
				{view.sides.map((side, i) => (
					<SideRow key={side.id} side={side} title={sideTitle(side, names)} top={FIRST + i * ROW} hidden={inRows ? i < row : false} names={names} marks={view.hasServices && !side.onServices} />
				))}
			</div>
			{/* The bar stays in its corner. */}
			<CornerBar items={["bar:search", "bar:menu"]} />
		</>
	)
}
