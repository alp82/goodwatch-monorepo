// PROTOTYPE - throwaway. Variant I, "the film": after the boot, a short explainer on the TV (endless scroll, then
// what makes GoodWatch different, in big type and bold logos), ending in "tap three you loved" and a real pick.
// The scenes are CSS-timed from the first paint; Skip ends them at once. Guests only; members get the boot.
import { useSearchParams } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import { clipById } from "~/ui/prototype-intro/clips"
import { HOME_CUT } from "~/ui/prototype-intro/cut"
import { Sequence, Stage, TRANSITIONS, type TransitionId } from "~/ui/prototype-intro/Sequence"
import { FILM_MS, FilmScenes } from "./film-scenes"
import { FilmTaps, savedTaps } from "./film-taps"
import { FILM_CHAPTER_EVENT, HowItWorks } from "./HowItWorks"
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
	// The TV boots by itself (the CSS boot below, painted before any script), so the lab's boot clip is left out
	// and the first clip deals in after it, as the boot clip hands over in the lab.
	const listed = useMemo(
		() => (params.get("clips")?.split(",") ?? HOME_CUT).flatMap((id) => clipById(id) ?? []),
		[params],
	)
	const clips = useMemo(() => listed.filter((c) => c.section !== "boot"), [listed])
	// Back from sign-up with taps already made: straight to the quiz, where the visitor left it.
	// Read before any child effect runs; the film mounts after the boot, past hydration, so it can't mismatch.
	const [resume] = useState(() => typeof window !== "undefined" && Boolean(savedTaps()))
	const quizAt = clips.findIndex((c) => c.section === "closer")
	const startAt = resume && quizAt >= 0 ? quizAt : 0
	const firstEnter = startAt > 0 ? "fade" : listed[0]?.section === "boot" ? (clips[0]?.enter ?? "deal") : undefined
	const k = { "0.7×": 1.43, "0.8×": 1.25, "0.9×": 1.11, "1×": 1, "1.15×": 0.87 }[params.get("speed") ?? ""] ?? 1
	const tr = ((params.get("tr") ?? "") in TRANSITIONS ? params.get("tr") : "fade") as TransitionId
	// The clip data arrives during the boot, outside the page's HTML.
	const [intro, setIntro] = useState<VariantProps["data"]["intro"]>(data.intro ?? null)
	useEffect(() => {
		if (intro || !clips.length || data.member) return
		let gone = false
		fetch("/prototype/intro-data")
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => !gone && d && setIntro(d))
			.catch(() => {})
		return () => {
			gone = true
		}
	}, [intro, clips.length, data.member])
	const lab = clips.length > 0 && intro
	// The lab's sequence ends itself (its chapters can be jumped); the old film ends by the clock.
	const timeUp = useAfter(START + FILM_MS)
	const over = lab ? false : timeUp
	// "Watch in the intro" in the section below the room: play the film from that chapter.
	const [chapter, setChapter] = useState<{ at: number; n: number } | null>(null)
	useEffect(() => {
		const go = (e: Event) => {
			const at = clips.findIndex((c) => c.section === (e as CustomEvent<string>).detail)
			if (at < 0) return
			setLeft(false)
			setSkipped(false)
			setChapter((now) => ({ at, n: (now?.n ?? 0) + 1 }))
		}
		addEventListener(FILM_CHAPTER_EVENT, go)
		return () => removeEventListener(FILM_CHAPTER_EVENT, go)
	}, [clips])
	// What Google reads, and a guest's way into each chapter: the film's chapters as page content below the room.
	const startTitles = data.startTitles
	const below = useMemo(() => <HowItWorks titles={startTitles} />, [startTitles])
	const page = data.member ? {} : { below, homeHeadingAs: "p" as const }
	if (data.member || tvOpen || left) return { screen: <Boot />, ...page }
	const playing = !skipped && !over
	return {
		...page,
		screen: (
			<div className="lpf">
				<FilmTaps data={data} onLeave={() => setLeft(true)} />
				{playing && (
					<>
						{lab ? (
							<SequenceAfterBoot>
								<Stage k={k}>
									<Sequence
										key={chapter?.n ?? 0}
										clips={clips}
										data={intro!}
										k={k}
										transition={tr}
										chapters
										firstEnter={chapter ? "fade" : firstEnter}
										startAt={chapter?.at ?? startAt}
										onEnd={() => setSkipped(true)}
									/>
								</Stage>
							</SequenceAfterBoot>
						) : clips.length ? null : (
							// Round 3's film, only without a cut. With one, the TV waits for the clip data during the boot.
							<FilmScenes data={data} start={START} />
						)}
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
