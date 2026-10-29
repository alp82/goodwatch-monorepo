// The film on the TV's picture: it asks /api/intro for its data, then plays film.ts in the player. Loaded on demand
// (HomeIntro.tsx imports it lazily), so neither its code nor its styles are on the start page's first load.
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { FILM } from "./film"
import { FilmPhone, isPhonePicture } from "./parts/film-phone"
import "./intro.css"
import { Player, Stage } from "./player"
import type { Enter, IntroData, Scene } from "./scene"

export default function FilmScreen({
	scenes = FILM,
	startAt,
	firstEnter,
	waitMs,
	onAt,
	onShown,
	onFail,
}: {
	/** The film: the TV's (FILM) by default. */
	scenes?: readonly Scene[]
	startAt: number
	firstEnter: Enter
	/** How long the film waits before its first scene: the boot screen's time. */
	waitMs: number
	onAt: (index: number) => void
	/** The film is on the picture: its first scene is coming in. */
	onShown?: () => void
	/** The data couldn't be read: the TV shows its home instead (the start page's theater says so). */
	onFail: () => void
}) {
	const [data, setData] = useState<IntroData | null>(null)
	const [ready, setReady] = useState(waitMs <= 0)
	useEffect(() => {
		let gone = false
		fetch("/api/intro")
			.then((res) =>
				res.ok
					? (res.json() as Promise<IntroData>)
					: Promise.reject(new Error(`status ${res.status}`)),
			)
			.then((body) => {
				if (gone) return
				if (body.pool?.length) setData(body)
				else onFail()
			})
			.catch((error) => {
				console.error("The intro's data couldn't be read", error)
				if (!gone) onFail()
			})
		return () => {
			gone = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])
	useEffect(() => {
		if (waitMs <= 0) return
		const timer = setTimeout(() => setReady(true), waitMs)
		return () => clearTimeout(timer)
	}, [waitMs])
	const shown = Boolean(data && ready)
	// The picture's size, measured before the first scene paints: a scene that lays itself out for the phone does it
	// from its first frame.
	const box = useRef<HTMLDivElement>(null)
	const [phone, setPhone] = useState(false)
	useLayoutEffect(() => {
		const el = box.current
		if (!el) return
		const measure = () =>
			setPhone(isPhonePicture(el.clientWidth, el.clientHeight))
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [shown])
	useEffect(() => {
		if (shown) onShown?.()
	}, [shown, onShown])
	// Until both are there the TV's own home shows (after the boot screen, under a dark hold: HomeIntro.tsx); the
	// film comes in over it.
	if (!data || !ready) return null
	return (
		<div ref={box} className="film-screen">
			<FilmPhone.Provider value={phone}>
				<Stage k={1}>
					<Player
						scenes={scenes}
						data={data}
						firstEnter={firstEnter}
						startAt={startAt}
						onAt={onAt}
					/>
				</Stage>
			</FilmPhone.Provider>
		</div>
	)
}
