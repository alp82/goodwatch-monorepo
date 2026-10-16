// PROTOTYPE - throwaway (#660). Variant "A side for tonight" (existing look): today's home row stays as it is; the
// space above it offers one side for tonight. The side is the one holding the best of all sides' picks in personal
// order, so the order across sides is still personal order's. Three of its picks stand as backdrop cards, with
// Another side (to step through the others) and Watch next for its moods.
import { useSearchParams } from "@remix-run/react"
import { useState } from "react"
import { CornerBar, Cross, Img, Item, Shade, backdropSize, useTvView } from "~/ui/living-room/tv/kit"
import { TV_ROW_ATTR } from "~/ui/living-room/tv/tv-dom"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { BackdropItem, LovedStrip, MoodChips, TileItem, Wordmark, useHomeTiles } from "./bits"
import { WatchNextWords, useHooks, useHost, watchNextLabel } from "./host"
import { Tiles } from "./Tiles"
import { shareWords, sideTitle } from "./model"

const CARDS = 3

export function Tonight() {
	const { view, names, focus } = useHost()
	const { canvas, focused } = useTvView()
	const { apps, services } = useHomeTiles(view)
	const tiles = [...apps, ...services]
	// Tonight's side first, then the others in the order of their best pick.
	// `&tonight=day` turns the featured side each day instead (open question for the owner).
	const [params] = useSearchParams()
	const daily = params.get("tonight") === "day"
	const byBest = [...view.sides].sort((a, b) => a.rank - b.rank)
	const day = Math.floor(Date.now() / 86_400_000)
	const order = daily && byBest.length ? [...view.sides.slice(day % view.sides.length), ...view.sides.slice(0, day % view.sides.length)] : byBest
	const [at, setAt] = useState(0)
	const side = order[at % Math.max(1, order.length)]
	useHooks({
		choose: (item) => {
			if (item !== "another") return false
			setAt((n) => (n + 1) % order.length)
			return true
		},
	})
	// Without sides the home is today's.
	if (!side) return <Tiles />
	const cards = side.picks.slice(0, CARDS)
	const focusedTile = tiles.find((t) => t.id === focused)
	const pickKey = focused.startsWith("pick:") ? focused.split(":").slice(2).join(":") : null
	const shown = cards.find((t) => t.key === pickKey) ?? cards[0]
	const files = shown?.backdrop ? [tmdbImageUrl(shown.backdrop, backdropSize(canvas))] : []
	return (
		<>
			<Cross id={`${side.id}:${shown?.key} ${files.join(" ")}`} files={files}>
				{files[0] ? <Img src={files[0]} className="h-full w-full" /> : <span className="block h-full w-full bg-[#10131c]" />}
			</Cross>
			<Shade dim={0.66} />
			<Wordmark />
			<div className="absolute left-14 top-[104px] w-[1090px]">
				<div key={side.id} className="tvc-fade">
					<div className="flex items-center gap-4 text-[24px] text-white/75">
						<span>{at === 0 ? (daily ? "Today's side of you" : "Tonight, from one side of you") : `Another side of you · ${(at % order.length) + 1} of ${order.length}`}</span>
						{names && <MoodChips side={side} />}
					</div>
					<div className="mt-2 flex items-end justify-between gap-6">
						<div className="min-w-0">
							<div className="truncate pb-1 font-bold leading-tight tracking-tight" style={{ fontSize: sideTitle(side, names).length > 30 ? 40 : 52 }}>
								{sideTitle(side, names)}
							</div>
							<div className="mt-2 text-[26px] text-white/80">{shareWords(side.share)}</div>
						</div>
						<LovedStrip side={side} n={5} height={78} label={false} />
					</div>
				</div>
				<div className="mt-5 flex items-center gap-[22px]">
					{cards.map((t) => (
						<BackdropItem key={`${side.id}:${t.key}`} id={`pick:${side.id}:${t.key}`} title={t} width={260} height={146} />
					))}
					<div className="ml-2 flex flex-col gap-3">
						{order.length > 1 && (
							<Item id="another" className="tvc-btn flex h-[68px] w-[250px] items-center whitespace-nowrap px-7 text-[24px]">
								Another side
							</Item>
						)}
						<Item id={`watch:${side.id}`} label={`${watchNextLabel(side)}, on Watch next`} className="tvc-btn flex min-h-[76px] w-[250px] items-center px-7 py-2 text-[24px]">
							<WatchNextWords side={side} />
						</Item>
					</div>
				</div>
			</div>
			{/* The focused home tile says what it is, as the home's large caption does today. */}
			{focusedTile && (
				<div key={focusedTile.id} className="tvc-fade absolute bottom-[150px] left-14 right-14 truncate text-[26px] text-white/85">
					<span className="font-bold text-white">{focusedTile.name}</span> · {focusedTile.line}
				</div>
			)}
			<div {...{ [TV_ROW_ATTR]: "" }} className="absolute inset-x-0 bottom-0 flex gap-[22px] overflow-hidden px-14 pb-8 pt-6">
				{tiles.map((t) => (
					<TileItem key={t.id} tile={t} width={180} height={104} />
				))}
			</div>
			<CornerBar items={["bar:search", "bar:menu"]} />
			<FocusKeeper ids={cards.map((t) => `pick:${side.id}:${t.key}`)} focused={focused} focus={focus} />
		</>
	)
}

/** After Another side, the focus stays on the key; a card that left with the old side hands the focus to the first new one. */
function FocusKeeper({ ids, focused, focus }: { ids: string[]; focused: string; focus: (id: string) => void }) {
	if (focused.startsWith("pick:") && !ids.includes(focused) && ids[0]) queueMicrotask(() => focus(ids[0]))
	return null
}
