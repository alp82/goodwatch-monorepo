// PROTOTYPE - throwaway. Chapter 4, "How it feels", round 9: round 7's zoom-through (fingerprint-own-zoom), retimed.
// What changed: it starts on the hero already pushed in by chapter 3 (HERO_PUSH) and flies through at once (round 7
// held the poster still for 0.5 s); each feeling gets 1.55 s instead of 1.7 s (the backdrops never stop drifting);
// the last backdrop drifts exactly until the clip ends; and `ms` now covers every animation (round 7's was 1.65 s short).
// Same words, same backdrops (Interstellar's own, chosen by hand), same ending.
//
// The helpers are round 7's (r7feel/feelings.tsx), copied.
import type { CSSProperties } from "react"
import type { ClipProps, IntroData } from "../../clip"
import { HeroPoster } from "../../hero"
import { Missing, at, img, r5, sayable } from "../r5feel/kit"
import { HERO_PUSH } from "./pick"

/**
 * Interstellar's own backdrops, one per feeling: chosen by hand from TMDB's image set for movie 157336 (GET
 * /3/movie/157336/images, 159 language-free backdrops, looked at on 2026-10-17). A static decision: no TMDB calls at
 * runtime. A feeling not listed takes the next unused one of SPARE.
 */
const BACKDROPS: Record<string, string> = {
	// The Endurance beside Gargantua's glowing disc.
	spectacular: "/pbrkL804c8yAv3zBZR4QPEafpAR.jpg",
	// Cooper wading through the water planet's shallows, the Ranger behind him.
	immersive: "/rAiYTfKGqDCRIIqo664sY9XZIvQ.jpg",
	// An astronaut floating before the wormhole. (The wormhole shot itself is Interstellar's main backdrop, which the
	// clips end on, so it isn't used for a feeling.)
	wondrous: "/vvjYv7bSWerbsi0LsMjLnTVOX7c.jpg",
	// The Ranger alone on the grey water, just before the wave.
	tense: "/wqBlk1ejN71gzKvlbXYrC1FfdsY.jpg",
}
/** The tesseract, the black hole's ring, the ice planet walk. */
const SPARE = ["/Ab9eQH5O3VCTQjJsQghxjYOkfMp.jpg", "/pOvgpLgOO84GTqgwFpE5W4OBIBa.jpg", "/9mmkq59uRuJWDFz9UHeX5ATNJYf.jpg"]

/** The hero's four strongest plain feelings, each with one of its own backdrops. */
function feelings(data: IntroData) {
	const hero = r5(data)?.hero
	if (!hero) return null
	const spare = [...SPARE]
	const words = sayable(hero.top, 4).map((w) => ({
		...w,
		backdrop: BACKDROPS[w.word.toLowerCase()] ?? spare.shift() ?? hero.backdrop_path,
	}))
	return { hero, words }
}

/** A full-screen backdrop that fades in at `ms` and keeps drifting; `zoom` comes in from closer, for the zoom-through. */
function Bd({ path, ms, dim = 0.5, zoom = false, len = 700, kbl }: { path: string | null; ms: number; dim?: number; zoom?: boolean; len?: number; kbl?: number }) {
	return (
		<div className={`lpc-r6feel-bd ${zoom ? "lpc-r6feel-bd-zoom" : ""}`} style={at(ms, { "--len": `${len}ms` })}>
			<img src={img(path, "w1280")} alt="" className={`lpc-r6feel-kb ${kbl ? "lpc-r9a-kb" : ""}`} style={at(ms, kbl ? { "--kbl": `${kbl}ms` } : {})} />
			<div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(5,6,10,${dim + 0.35}) 0, rgba(5,6,10,${dim}) 55%, rgba(5,6,10,${dim * 0.5}) 100%)` }} />
		</div>
	)
}

function Word({ w, className = "" }: { w: { emoji: string; word: string }; className?: string }) {
	return (
		<div className={`lpc-r6feel-word ${className}`}>
			<span className="lpc-r6feel-emoji">{w.emoji}</span> {w.word}.
		</div>
	)
}

function Chips({ words, ms }: { words: { key: string; emoji: string; word: string; hex: string }[]; ms: number }) {
	return (
		<div className="flex flex-wrap gap-[1.2cqw]">
			{words.map((w, i) => (
				<span key={w.key} className="lpc-r5f-chip lpc-r5f-pop lpc-r6feel-chip" style={at(ms + i * 140, { "--c": w.hex })}>
					<span aria-hidden="true">{w.emoji}</span> {w.word}
				</span>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
const THROUGH = 0 // [500] the poster flies through at once
const FIRST = 700 // [1200]
const ZSTEP = 1550 // [1700]
const END = FIRST + 4 * ZSTEP
/** "That's Interstellar." rises at END + 1000 (850 ms); then a 1.1 s read, the last 800 under the crossfade. */
export const ZOOM_R9_MS = END + 1000 + 850 + 1100

export function FeelingsZoomR9({ data }: ClipProps) {
	const f = feelings(data)
	if (!f) return <Missing />
	const end = FIRST + f.words.length * ZSTEP
	const ms = end + 1000 + 850 + 1100
	return (
		<div className="lpc-r6feel">
			{f.words.map((w, i) => (
				<Bd key={w.key} path={w.backdrop} ms={FIRST + i * ZSTEP - 250} zoom len={800} />
			))}
			<Bd path={f.hero.backdrop_path} ms={end - 150} dim={0.6} zoom len={900} kbl={ms - (end - 150)} />
			{/* The poster, already pushed in by chapter 3, grows past the camera: the way in. */}
			<div className="lpc-r6feel-through lpc-r9a-through" style={at(THROUGH)}>
				<div className="lpc-r9a-pushed" style={{ "--p": HERO_PUSH } as CSSProperties}>
					{data.pool[0] && <HeroPoster card={data.pool[0]} />}
				</div>
			</div>
			<div className="lpc-r5f-kicker lpc-r5f-rise lpc-r6feel-kicker-c" style={at(FIRST)}>
				How {f.hero.title} feels
			</div>
			<div className="lpc-r6feel-zstage">
				{f.words.map((w, i) => (
					<div key={w.key} className="lpc-r6feel-zin" style={at(FIRST + i * ZSTEP + (i ? 60 : 0))}>
						<div className="lpc-r6feel-zout" style={at(FIRST + (i + 1) * ZSTEP - 420)}>
							<Word w={w} className="text-center" />
						</div>
					</div>
				))}
			</div>
			<div className="lpc-r6feel-zfinal">
				<div className="lpc-r6feel-zposter lpc-r5f-deal" style={at(end + 100)}>
					{data.pool[0] && <HeroPoster card={data.pool[0]} className="lpc-r6feel-static" />}
				</div>
				<div className="mt-[2.4cqh] flex justify-center">
					<Chips words={f.words} ms={end + 450} />
				</div>
				<div className="lpc-r5f-line lpc-r5f-rise mt-[2.2cqh] text-center" style={at(end + 1000)}>
					That's <em>{f.hero.title}.</em>
				</div>
			</div>
		</div>
	)
}
