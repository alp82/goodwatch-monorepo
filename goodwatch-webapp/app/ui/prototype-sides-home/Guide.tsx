// PROTOTYPE - throwaway (#660). Variant "Sides as channels" (bolder): the home turns from a row into a guide. On
// the left, today's apps and then the sides, one under the other like a TV's channel list; Up and Down zap
// through them, and the right shows whatever is on: an app's line as today, or a side's picks in personal order
// with its loved titles and Watch next. Right steps into the picks; Left from the first pick comes back to the side.
import { useRef } from "react"
import { CornerBar, Cross, Img, Item, Shade, backdropSize, useTvView } from "~/ui/living-room/tv/kit"
import { AppArt } from "~/ui/living-room/tv/screens/Home"
import { TV_ROW_ATTR } from "~/ui/living-room/tv/tv-dom"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { type HomeTile, LovedStrip, MoodChips, PosterItem, Wordmark, sideTile, useHomeTiles, wholeArt } from "./bits"
import { useHooks, useHost, watchNextLabel } from "./host"
import { shareWords, sideTitle } from "./model"

const LIST_TOP = 120
const LIST_BOTTOM = 620
const APP_H = 56
const SIDE_H = 92
const GAP = 10
const HEADER = 44

export function Guide() {
	const { view, names } = useHost()
	const { canvas, focused } = useTvView()
	const { apps } = useHomeTiles(view)
	const sides = view.sides.map((side) => sideTile(side, sideTitle(side, names)))
	const entries: HomeTile[] = [...apps, ...sides]

	// Places in the list, with the header over the sides.
	let y = 0
	const place = new Map<string, { top: number; h: number }>()
	entries.forEach((e, i) => {
		if (i === apps.length) y += HEADER
		const h = e.side ? SIDE_H : APP_H
		place.set(e.id, { top: y, h })
		y += h + GAP
	})
	const total = y

	// The channel that is on: the focused entry, or the side whose pick or key has the focus.
	const last = useRef(entries[0].id)
	const [kind, arg] = focused.split(":")
	const owner = kind === "pick" || kind === "watch" ? `side:${arg}` : focused
	if (entries.some((e) => e.id === owner)) last.current = owner
	const on = entries.find((e) => e.id === last.current) ?? entries[0]
	const side = on.side

	// The list scrolls so the channel that is on stays in view.
	const room = LIST_BOTTOM - LIST_TOP
	const p = place.get(on.id) ?? { top: 0, h: APP_H }
	const scroll = Math.max(0, Math.min(total - room, p.top + p.h / 2 - room / 2))

	useHooks({
		move: (dir, from) => {
			const [k, a] = from.split(":")
			const at = entries.findIndex((e) => e.id === from)
			if (at >= 0 && (dir === "up" || dir === "down")) {
				const next = entries[at + (dir === "down" ? 1 : -1)]
				return next ? next.id : dir === "up" ? undefined : null
			}
			if (at >= 0 && dir === "right") {
				const s = entries[at].side
				return s?.picks[0] ? `pick:${s.id}:${s.picks[0].key}` : s ? `watch:${s.id}` : null
			}
			if (k === "pick" && dir === "left") {
				const s = view.sides.find((one) => one.id === a)
				if (s && from === `pick:${s.id}:${s.picks[0]?.key}`) return `side:${s.id}`
			}
			if (k === "watch" && dir === "up") {
				const s = view.sides.find((one) => one.id === a)
				return s?.picks[0] ? `pick:${s.id}:${s.picks[0].key}` : `side:${a}`
			}
			if (k === "watch" && dir === "left") return `side:${a}`
			if (k === "pick" && dir === "down") return `watch:${a}`
			return undefined
		},
	})

	const backdrop = backdropSize(canvas)
	const pickKey = kind === "pick" ? focused.split(":").slice(2).join(":") : null
	const pick = side ? (side.picks.find((t) => t.key === pickKey) ?? side.picks[0]) : null
	const files = side ? (pick?.backdrop ? [tmdbImageUrl(pick.backdrop, backdrop)] : []) : wholeArt(on, backdrop)
	return (
		<>
			<Cross id={`${on.id}:${pick?.key ?? ""} ${files.join(" ")}`} files={files}>
				{side ? files[0] ? <Img src={files[0]} className="h-full w-full" /> : <span className="block h-full w-full bg-[#10131c]" /> : <AppArt art={on.art} files={files} className="h-full w-full" />}
			</Cross>
			{/* The guide's side is dark; the picture shows on the right. */}
			<div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(5,6,10,.97) 0%, rgba(5,6,10,.93) 30%, rgba(5,6,10,.45) 60%, rgba(5,6,10,.2) 100%), linear-gradient(0deg, rgba(5,6,10,.85) 0%, rgba(5,6,10,0) 55%)" }} />
			<Wordmark />
			<div className="absolute left-10 w-[330px] overflow-hidden" style={{ top: LIST_TOP, height: LIST_BOTTOM - LIST_TOP }}>
				<div className="relative transition-transform duration-200 ease-out" style={{ transform: `translateY(${-scroll}px)`, height: total }}>
					{sides.length > 0 && (
						<div className="absolute left-4 text-[20px] font-semibold uppercase tracking-[0.14em] text-white/60" style={{ top: (place.get(sides[0].id)?.top ?? 0) - HEADER + 10 }}>
							Sides of you
						</div>
					)}
					{entries.map((e) => {
						const at = place.get(e.id) ?? { top: 0, h: APP_H }
						// The channel that is on keeps a light plate while the focus is in its picks.
						const isOn = e.id === on.id && focused !== e.id
						return (
							<Item key={e.id} id={e.id} label={e.name} className={`absolute inset-x-2 flex items-center gap-4 px-4 ${isOn ? "bg-white/[.14]" : ""} tvc-act`} style={{ top: at.top, height: at.h, borderRadius: 14 }}>
								{e.side ? (
									<>
										<span className="flex h-[72px] shrink-0 overflow-hidden rounded-[8px]">
											{e.side.loved.slice(0, 2).map((t) => (
												<span key={t.key} className="relative block h-full w-[48px] bg-[#10131c]">
													{t.poster && <Img src={tmdbImageUrl(t.poster, "w92")} className="absolute inset-0 h-full w-full" />}
												</span>
											))}
										</span>
										<span className="min-w-0">
											<span className="line-clamp-3 text-[22px] font-bold leading-[1.1]">{e.name}</span>
										</span>
									</>
								) : (
									<span className="truncate text-[26px] font-bold">{e.name}</span>
								)}
							</Item>
						)
					})}
				</div>
			</div>
			<div className="absolute left-[420px] right-14 top-[120px]">
				<div key={on.id} className="tvc-fade">
					{side ? (
						<>
							<div className="flex items-center gap-4 text-[24px] text-white/80">
								<span>
									{shareWords(side.share)}
									{view.hasServices && !side.onServices && " · few on your services"}
								</span>
								{names && <MoodChips side={side} />}
							</div>
							{/* With the edge line under it, the name keeps to one line so the picks keep their place. */}
							<div className={`mt-2 font-bold tracking-tight ${names && side.edges[0] ? "truncate pb-1 leading-tight" : "line-clamp-2 leading-[1.02]"}`} style={{ fontSize: names && side.edges[0] ? 44 : on.name.length > 28 ? 46 : 58 }}>
								{on.name}
							</div>
							{names && side.edges[0] && <div className="mt-2 line-clamp-1 text-[22px] text-sky-200">Just past it: {side.edges[0].line}</div>}
							<div className="mt-4">
								<LovedStrip side={side} n={7} height={64} />
							</div>
						</>
					) : (
						<>
							<div className="font-bold leading-[0.95] tracking-tight" style={{ fontSize: 96 }}>
								{on.name}
							</div>
							<div className="mt-4 text-[32px] leading-snug text-white/85">{on.line}</div>
						</>
					)}
				</div>
			</div>
			{side && (
				<div className="absolute left-[420px] right-0" style={{ top: 384 }}>
					<div {...{ [TV_ROW_ATTR]: "" }} className="relative flex gap-[20px] overflow-hidden py-4 pl-3 pr-14">
						{side.picks.map((t) => (
							<PosterItem key={t.key} id={`pick:${side.id}:${t.key}`} title={t} width={110} height={165} />
						))}
					</div>
					<div className="flex items-center gap-5 pl-3">
						<Item id={`watch:${side.id}`} label={`${watchNextLabel(side)}, on Watch next`} className="tvc-btn flex h-[56px] items-center whitespace-nowrap px-7 text-[22px]">
							{watchNextLabel(side)}
						</Item>
						{pick && (
							<span className="min-w-0 text-[20px] leading-tight text-white/75">
								<span className="block truncate font-bold text-white">{pick.title}</span>
								<span className="block truncate">{pick.facts}</span>
							</span>
						)}
					</div>
				</div>
			)}
			<CornerBar items={["bar:search", "bar:menu"]} />
		</>
	)
}
