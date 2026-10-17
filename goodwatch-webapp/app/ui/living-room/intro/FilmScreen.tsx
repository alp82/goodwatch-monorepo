// The film on the TV's picture: it asks /api/intro for its data, then plays film.ts in the player. Loaded on demand
// (HomeIntro.tsx imports it lazily), so neither its code nor its styles are on the start page's first load.
import { useEffect, useState } from "react"
import { FILM } from "./film"
import "./intro.css"
import { Player, Stage } from "./player"
import type { Enter, IntroData } from "./scene"

export default function FilmScreen({
	startAt,
	firstEnter,
	waitMs,
	onAt,
	onFail,
}: {
	startAt: number
	firstEnter: Enter
	/** How long the film waits before its first scene: the boot screen's time. */
	waitMs: number
	onAt: (index: number) => void
	/** The data couldn't be read: the TV shows its home instead. */
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
	// Until both are there the TV's own home shows; the film comes in over it.
	if (!data || !ready) return null
	return (
		<div className="film-screen">
			<Stage k={1}>
				<Player
					scenes={FILM}
					data={data}
					firstEnter={firstEnter}
					startAt={startAt}
					onAt={onAt}
				/>
			</Stage>
		</div>
	)
}
