// The big screen, the page's side: which poster is on it, its card, and the moves in and back out. A poster gets there
// by being zoomed on into past its largest size (the engine's `onScreen`), or from the docked panel's "Big screen"
// button and Enter. The engine holds still under it; the effects play above it.
import { useQuery } from "@tanstack/react-query"
import { type RefObject, useEffect, useRef, useState } from "react"
import type { TitleChange } from "~/ui/title-actions/TitleControl"
import { PosterScreen } from "./PosterScreen"
import { explorerKeys, fetchCard } from "./api"
import { rgbCss, rgbHex } from "./color"
import type { MapEffects, Rect } from "./effects/types"
import type { Drawn, MapEngine } from "./engine"

interface OnScreen {
	d: Drawn
	from: Rect
}

const rectOf = (d: Drawn): Rect => ({ x: d.x, y: d.y, w: d.w, h: d.h })

export function usePosterScreen({
	engine,
	effects,
	member,
	viewer,
	language,
	userLoading,
	phone,
	onChange,
}: {
	engine: MapEngine | null
	effects: RefObject<MapEffects | null>
	member: boolean
	viewer: string
	language: string
	userLoading: boolean
	phone: boolean
	onChange: (key: number, change: TitleChange) => void
}) {
	const [shown, setShown] = useState<OnScreen | null>(null)
	// The effects play above the big screen while a poster is on it.
	useEffect(() => {
		effects.current?.raise(!!shown)
	}, [shown, effects])
	const [to, setTo] = useState<Rect | null>(null)
	const [reduce, setReduce] = useState(false)
	const eng = useRef(engine)
	eng.current = engine
	const shownRef = useRef<OnScreen | null>(null)
	shownRef.current = shown
	const leaving = useRef(false)

	useEffect(() => {
		setReduce(
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
		)
	}, [])

	const cardQuery = useQuery({
		queryKey: [...explorerKeys.card(viewer, shown?.d.title.key ?? 0), language],
		queryFn: () => fetchCard(shown?.d.title.key as number, member, language),
		enabled: !!shown && !userLoading,
	})
	const card =
		cardQuery.data && cardQuery.data.title.key === shown?.d.title.key
			? cardQuery.data
			: null

	const ctl = useRef({
		/** A poster becomes the screen: zoomed on into (`zoom`) or opened from the panel (`panel`). */
		open(d: Drawn, via: "zoom" | "panel") {
			const e = eng.current
			if (!e || shownRef.current || leaving.current) return
			e.holdForScreen(true)
			if (via === "panel") e.presentPoster(d.island, d.i)
			effects.current?.burst("open", d.cx, d.cy, {
				color: rgbHex(d.island.tint),
			})
			setTo(null)
			const next = { d, from: rectOf(d) }
			shownRef.current = next
			setShown(next)
		},
		/** Plays the move back into the map (scroll out, Escape, the dark, "Back to the map"). */
		release() {
			const e = eng.current
			const cur = shownRef.current
			if (!e || !cur || leaving.current) return
			leaving.current = true
			setTo(e.releasePoster(cur.d.island, cur.d.i))
		},
		up: () => !!shownRef.current,
	}).current

	const view = shown ? (
		<PosterScreen
			key={shown.d.title.key}
			title={shown.d.title}
			where={{
				name: shown.d.island.name,
				color: rgbCss(shown.d.island.tint),
			}}
			card={card}
			from={shown.from}
			to={to}
			phone={phone}
			reduce={reduce}
			onLanded={(r) => {
				effects.current?.pun(
					{
						name: shown.d.title.title,
						year: shown.d.title.year,
						kind: shown.d.title.mediaType === "show" ? "tv" : "movie",
					},
					r,
				)
			}}
			onRelease={ctl.release}
			onGone={() => {
				leaving.current = false
				shownRef.current = null
				setShown(null)
				setTo(null)
				eng.current?.holdForScreen(false)
				const c = eng.current?.size()
				if (c) effects.current?.burst("land", c.w / 2, c.h / 2)
			}}
			onChange={(c) => onChange(shown.d.title.key, c)}
		/>
	) : null

	return { ctl, view, up: !!shown }
}
