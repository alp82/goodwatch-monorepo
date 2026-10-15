// PROTOTYPE - throwaway (#660). Pieces the variants share, drawn with the TV's own kit and home's own tiles.
import { useMemo } from "react"
import { ServiceMark, hasDrawnMark } from "~/ui/living-room/Remote"
import { Img, Item, backdropSize, useTvView } from "~/ui/living-room/tv/kit"
import { AppArt, artFiles } from "~/ui/living-room/tv/screens/Home"
import type { TvListTitle } from "~/ui/living-room/tv/TitleList"
import { type TvAppArt, type TvService, homeApps, homeServices } from "~/ui/living-room/tv/tv-home"
import { serviceColor } from "~/ui/living-room/Remote"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { type HomeSide, type SidesHomeView, shareWords } from "./model"

/** A tile of home's row, as Home.tsx draws it. */
export type HomeTile = { id: string; name: string; line: string; art: TvAppArt; service?: TvService; signal?: { badge: string; label: string }; side?: HomeSide }

/** Home's tiles today: the apps, then the member's two services (Home.tsx). */
export function useHomeTiles(view: SidesHomeView) {
	return useMemo(() => {
		// The pool the real home asks for draws Discover's posters; here the sides' picks stand in for it.
		const data = { ...view.home, startTitles: view.sides.flatMap((s) => s.picks).map((t) => ({ poster_path: t.poster }) as never) }
		const apps: HomeTile[] = homeApps(data, null, true).map((a) => ({ ...a, id: `app:${a.app}` }))
		const services: HomeTile[] = homeServices(data, null).map(({ service, line, picture }) => ({
			id: `service:${service.id}`,
			name: service.name,
			line,
			art: { kind: "backdrop", path: picture, color: serviceColor(service) },
			service,
		}))
		return { apps, services }
	}, [view])
}

/** A side as one of home's tiles: three of its loved posters, and its title. */
export function sideTile(side: HomeSide, title: string): HomeTile {
	return {
		id: `side:${side.id}`,
		name: title,
		line: `${shareWords(side.share)}. ${side.picks.length} picks${side.onServices ? " on your services" : ""}.`,
		art: { kind: "posters", paths: side.loved.flatMap((t) => t.poster ?? []).slice(0, 3) },
		side,
	}
}

/** One tile of home's row, as Home.tsx draws it; a side's name may run to two lines. */
export function TileItem({ tile, width = 200, height = 128 }: { tile: HomeTile; width?: number; height?: number }) {
	const { canvas } = useTvView()
	return (
		<Item id={tile.id} label={tile.service ? `On ${tile.service.name}` : tile.name} className="tvc-tile shrink-0" style={{ width, height }}>
			<AppArt art={tile.art} files={artFiles(tile.art, backdropSize(canvas), "w154")} className="absolute inset-0 h-full w-full" />
			<span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
			{tile.service ? (
				<span className="absolute inset-x-4 bottom-3 flex items-center gap-2.5">
					<ServiceMark service={tile.service} height={28} />
					{!hasDrawnMark(tile.service) && <span className="truncate text-[23px] font-bold leading-none">{tile.name}</span>}
				</span>
			) : tile.side ? (
				<span className="absolute inset-x-3 bottom-2.5 line-clamp-2 text-[21px] font-bold leading-[1.05]">{tile.name}</span>
			) : (
				<span className="absolute bottom-3 left-4 text-[26px] font-bold leading-none">{tile.name}</span>
			)}
			{tile.signal && (
				<span aria-hidden className="absolute right-2.5 top-2.5 z-[1] flex h-[36px] min-w-[36px] items-center justify-center rounded-full bg-sky-300 px-2 text-[22px] font-bold leading-none text-black">
					{tile.signal.badge}
				</span>
			)}
		</Item>
	)
}

/** A tile's picture at the size of the whole screen. */
export function wholeArt(tile: HomeTile, backdrop: string) {
	return artFiles(tile.art, backdrop, "w342")
}

/** A title's poster as a focusable item. */
export function PosterItem({ id, title, width, height, streams }: { id: string; title: TvListTitle; width: number; height: number; streams?: boolean }) {
	return (
		<Item id={id} label={title.title} className="tvc-tile shrink-0 bg-[#10131c]" style={{ width, height }}>
			{title.poster && <Img src={tmdbImageUrl(title.poster, width > 160 ? "w342" : "w185")} className="absolute inset-0 h-full w-full" />}
			{streams === false && (
				<span className="absolute inset-x-0 bottom-0 z-[1] bg-black/80 px-2 py-1 text-[18px] font-bold leading-tight text-white/80">Not on yours</span>
			)}
		</Item>
	)
}

/** A title's backdrop as a focusable card, its name under the picture. */
export function BackdropItem({ id, title, width, height }: { id: string; title: TvListTitle; width: number; height: number }) {
	return (
		<Item id={id} label={title.title} className="tvc-tile shrink-0 bg-[#10131c]" style={{ width, height }}>
			{title.backdrop && <Img src={tmdbImageUrl(title.backdrop, "w780")} className="absolute inset-0 h-full w-full" />}
			<span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
			<span className="absolute inset-x-4 bottom-3 line-clamp-2 text-[24px] font-bold leading-[1.05]">{title.title}</span>
		</Item>
	)
}

/** The side's loved titles, small and not focusable: what the side groups, without a word about it. */
export function LovedStrip({ side, n = 6, height = 96, label = true }: { side: HomeSide; n?: number; height?: number; label?: boolean }) {
	const loved = side.loved.slice(0, n)
	return (
		<div className="flex items-center gap-3">
			{label && <span className="mr-1 text-[20px] leading-tight text-white/70">From what<br />you love</span>}
			{loved.map((t) => (
				<span key={t.key} className="relative block shrink-0 overflow-hidden rounded-[8px] bg-[#10131c] shadow-lg" style={{ width: Math.round(height * (2 / 3)), height }}>
					{t.poster && <Img src={tmdbImageUrl(t.poster, "w154")} className="absolute inset-0 h-full w-full" />}
				</span>
			))}
		</div>
	)
}

/** The moods Watch next opens a side with, as quiet chips. */
export function MoodChips({ side }: { side: HomeSide }) {
	if (!side.moods.length) return null
	return (
		<span className="flex gap-2">
			{side.moods.map((m) => (
				<span key={m.key} className="rounded-full bg-white/15 px-3.5 py-1 text-[20px] font-semibold">
					{m.name}
				</span>
			))}
		</span>
	)
}

export function Wordmark() {
	return <div className="absolute left-14 top-11 text-[22px] font-bold uppercase tracking-[0.22em] text-white/80 transition-opacity [[data-tv-toast]_&]:opacity-0">GoodWatch</div>
}
