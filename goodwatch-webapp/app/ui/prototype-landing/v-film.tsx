// PROTOTYPE - throwaway. Variant I, "the film": after the boot, a short explainer on the TV (endless scroll, then
// what makes GoodWatch different, in big type and bold logos), ending in "tap three you loved" and a real pick.
// The scenes are CSS-timed from the first paint; Skip ends them at once. Guests only; members get the boot.
import { useState } from "react"
import { FILM_MS, FilmScenes } from "./film-scenes"
import { FilmTaps } from "./film-taps"
import { BOOT_MS, Boot, useAfter } from "./shared"
import type { Landing, VariantProps } from "./variants"
import "./v-film.css"

/** The scenes start as the boot fades. */
const START = BOOT_MS - 350

export function useFilm({ data, tvOpen }: VariantProps): Landing {
	const [left, setLeft] = useState(false)
	const [skipped, setSkipped] = useState(false)
	const over = useAfter(START + FILM_MS)
	if (data.member || tvOpen || left) return { screen: <Boot /> }
	const playing = !skipped && !over
	return {
		screen: (
			<div className="lpf">
				<FilmTaps data={data} onLeave={() => setLeft(true)} />
				{playing && (
					<>
						<FilmScenes data={data} start={START} />
						<button type="button" className="lpf-skip" onClick={() => setSkipped(true)}>
							Skip
						</button>
					</>
				)}
				<Boot />
			</div>
		),
	}
}
