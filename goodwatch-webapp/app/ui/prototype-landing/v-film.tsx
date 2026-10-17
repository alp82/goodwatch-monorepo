// PROTOTYPE - throwaway. Variant I, "the film": after the boot, a short explainer on the TV (endless scroll, then
// what makes GoodWatch different, in big type and bold logos), ending in "tap three you loved" and a real pick.
// The scenes are CSS-timed from the first paint; Skip ends them at once. Guests only; members get the boot.
import { useSearchParams } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import { clipById } from "~/ui/prototype-intro/clips"
import { Sequence, Stage, TRANSITIONS, type TransitionId } from "~/ui/prototype-intro/Sequence"
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
	// The lab's quiz clip asks to leave with an event: it lives inside the sequence, out of reach of this state.
	useEffect(() => {
		const leave = () => setLeft(true)
		addEventListener("lp-film-leave", leave)
		return () => removeEventListener("lp-film-leave", leave)
	}, [])
	// The intro lab's "Play on the TV": `clips`, `speed` and `tr` name a sequence of lab clips to play instead.
	const [params] = useSearchParams()
	const clips = useMemo(() => (params.get("clips") ?? "").split(",").flatMap((id) => clipById(id) ?? []), [params])
	const k = { "0.7×": 1.43, "0.8×": 1.25, "0.9×": 1.11, "1×": 1, "1.15×": 0.87 }[params.get("speed") ?? ""] ?? 1
	const tr = ((params.get("tr") ?? "") in TRANSITIONS ? params.get("tr") : "fade") as TransitionId
	const lab = clips.length > 0 && data.intro
	// The lab's sequence ends itself (its chapters can be jumped); the old film ends by the clock.
	const timeUp = useAfter(START + FILM_MS)
	const over = lab ? false : timeUp
	if (data.member || tvOpen || left) return { screen: <Boot /> }
	const playing = !skipped && !over
	return {
		screen: (
			<div className="lpf">
				<FilmTaps data={data} onLeave={() => setLeft(true)} />
				{playing && (
					<>
						{lab ? (
							<SequenceAfterBoot>
								<Stage k={k}>
									<Sequence clips={clips} data={data.intro!} k={k} transition={tr} chapters onEnd={() => setSkipped(true)} />
								</Stage>
							</SequenceAfterBoot>
						) : (
							<FilmScenes data={data} start={START} />
						)}
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

/** Holds the lab's sequence back until the boot has faded, so its first clip starts on time. */
function SequenceAfterBoot({ children }: { children: React.ReactNode }) {
	const ready = useAfter(START)
	return ready ? <>{children}</> : null
}
