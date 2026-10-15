// PROTOTYPE - throwaway (#660). Variant "Side tiles in the home row" (existing look): today's home, unchanged, with
// one tile per side after the apps and before the services. A side's tile is three of its loved posters; while it
// has the focus the home shows the side large: its title, its share of what you love, and its loved titles. OK opens
// the side's picks (personal order) with a Watch next key for its moods.
import { useRef } from "react"
import { CornerBar, Cross, Shade, backdropSize, useTvView } from "~/ui/living-room/tv/kit"
import { AppArt } from "~/ui/living-room/tv/screens/Home"
import { HOME_HEADLINE } from "~/ui/living-room/tv/screens/Home"
import { TV_ROW_ATTR } from "~/ui/living-room/tv/tv-dom"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { LovedStrip, TileItem, Wordmark, sideTile, useHomeTiles, wholeArt } from "./bits"
import { useHost } from "./host"
import { sideTitle } from "./model"

export function Tiles() {
	const { view, names } = useHost()
	const { canvas, focused } = useTvView()
	const { apps, services } = useHomeTiles(view)
	const sides = view.sides.map((side) => sideTile(side, sideTitle(side, names)))
	const tiles = [...apps, ...sides, ...services]
	const last = useRef(tiles[0].id)
	if (tiles.some((t) => t.id === focused)) last.current = focused
	const shown = tiles.find((t) => t.id === last.current) ?? tiles[0]
	const backdrop = backdropSize(canvas)
	// A side's picture: its best pick's backdrop, the first thing it would offer.
	const sidePicture = shown.side ? (shown.side.picks.find((t) => t.backdrop)?.backdrop ?? shown.side.backdrop) : null
	const whole = shown.side ? (sidePicture ? [tmdbImageUrl(sidePicture, backdrop)] : []) : wholeArt(shown, backdrop)
	return (
		<>
			<Cross id={`${shown.id} ${whole.join(" ")}`} files={whole}>
				{shown.side ? (
					whole[0] ? <img src={whole[0]} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-[#10131c]" />
				) : (
					<AppArt art={shown.art} files={whole} className="h-full w-full" />
				)}
			</Cross>
			<Shade dim={0.5} />
			<Wordmark />
			<div className="absolute left-14 top-[136px] w-[860px]">
				<h1 className="text-[28px] text-white/75">{shown.side ? "A side of you" : HOME_HEADLINE}</h1>
				<div key={shown.id} className="tvc-fade">
					<div className={`font-bold leading-[0.95] tracking-tight ${shown.side ? "line-clamp-2" : ""}`} style={{ fontSize: shown.side ? (shown.name.length > 26 ? 56 : 72) : 108 }}>
						{shown.name}
					</div>
					<div className="mt-4 text-[32px] leading-snug text-white/85">{shown.line}</div>
					{shown.side && (
						<div className="mt-5">
							<LovedStrip side={shown.side} n={6} height={84} />
						</div>
					)}
				</div>
			</div>
			<div {...{ [TV_ROW_ATTR]: "" }} className="absolute inset-x-0 bottom-0 flex gap-[22px] overflow-hidden px-14 pb-12 pt-11">
				{tiles.map((tile, i) => (
					// Not positioned: the row pages by its items' offsets (tv-dom.ts).
					<div key={tile.id} className="shrink-0">
						{/* Where the sides start, a quiet label over the first. */}
						{tile.side && i === apps.length && (
							<span className="absolute -translate-y-[30px] whitespace-nowrap text-[20px] font-semibold text-white/70">Sides of you</span>
						)}
						<TileItem tile={tile} />
					</div>
				))}
			</div>
			<CornerBar items={["bar:search", "bar:menu"]} />
		</>
	)
}
