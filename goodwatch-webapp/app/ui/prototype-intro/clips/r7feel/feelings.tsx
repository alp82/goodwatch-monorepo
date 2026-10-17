// PROTOTYPE - throwaway. Chapter 4, "How it feels", round 7: round 6's three styles (the owner liked all of them),
// now with Interstellar's OWN backdrops. Round 6 used other titles' pictures, which the owner found confusing.
// Every clip starts on the hand-over frame (hero.tsx) with `enter: "cut"`.
import type { CSSProperties } from "react"
import type { ClipProps, IntroData } from "../../clip"
import { HeroPoster } from "../../hero"
import { Missing, at, img, r5, sayable } from "../r5feel/kit"

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

/** The hero's poster in its hand-over place, moving to (x, y, scale) from `ms` over `len`. */
function MovingHero({ data, ms, to, len = 900 }: ClipProps & { ms: number; to: [string, string, number]; len?: number }) {
	const card = data.pool[0]
	if (!card) return null
	return (
		<div className="lpc-r6feel-hero" style={at(ms, { "--hx": to[0], "--hy": to[1], "--hs": to[2], "--len": `${len}ms` })}>
			<HeroPoster card={card} />
		</div>
	)
}

/** A full-screen backdrop that fades in at `ms` and keeps drifting; `zoom` comes in from closer, for the zoom-through. */
function Bd({ path, ms, dim = 0.5, zoom = false, len = 700 }: { path: string | null; ms: number; dim?: number; zoom?: boolean; len?: number }) {
	return (
		<div className={`lpc-r6feel-bd ${zoom ? "lpc-r6feel-bd-zoom" : ""}`} style={at(ms, { "--len": `${len}ms` })}>
			<img src={img(path, "w1280")} alt="" className="lpc-r6feel-kb" style={at(ms)} />
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
// A. One at a time, in place. The poster tucks into the top corner as the anchor; each feeling lands huge over its own
// backdrop (one of Interstellar's own), with a bar for how strong it is. It ends on Interstellar's main backdrop with
// all four as chips.
export const STEP = 1700
export const PLACE_MS = 1300 + 4 * STEP + 2300
export function FeelingsInPlace({ data }: ClipProps) {
	const f = feelings(data)
	if (!f) return <Missing />
	const first = 1300
	const end = first + f.words.length * STEP
	return (
		<div className="lpc-r6feel">
			{f.words.map((w, i) => (
				<Bd key={w.key} path={w.backdrop} ms={first + i * STEP - 150} />
			))}
			<Bd path={f.hero.backdrop_path} ms={end - 100} dim={0.62} len={900} />
			<MovingHero data={data} ms={500} to={["-41cqw", "-29cqh", 0.3]} />
			<div className="lpc-r5f-kicker lpc-r5f-rise lpc-r6feel-kicker" style={at(900)}>
				How {f.hero.title} feels
			</div>
			<div className="lpc-r6feel-stage">
				{f.words.map((w, i) => (
					<div key={w.key} className="lpc-r6feel-in" style={at(first + i * STEP)}>
						<div className="lpc-r6feel-out" style={at(first + (i + 1) * STEP - 160)}>
							<Word w={w} />
							<span className="lpc-r6feel-bar">
								<b className="lpc-r5f-slam" style={at(first + i * STEP + 250, { background: w.hex, width: `${Math.min(100, w.value * 10)}%` })} />
							</span>
						</div>
					</div>
				))}
			</div>
			<div className="lpc-r6feel-final">
				<Chips words={f.words} ms={end + 200} />
				<div className="lpc-r5f-line lpc-r5f-rise mt-[3cqh]" style={at(end + 800)}>
					All of it is <em>{f.hero.title}.</em>
				</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// B. A carousel: each feeling is a full panel (its backdrop, the word huge) that pushes the one before it off to the
// left. The last panel is Interstellar itself, with the poster and all four chips.
export const PANEL = 1750
export const CAROUSEL_MS = 1100 + 4 * PANEL + 2500
export function FeelingsCarousel({ data }: ClipProps) {
	const f = feelings(data)
	if (!f) return <Missing />
	const first = 1100
	const end = first + f.words.length * PANEL
	const panels = [
		...f.words.map((w) => ({ key: w.key, backdrop: w.backdrop, w })),
		{ key: "hero", backdrop: f.hero.backdrop_path, w: null },
	]
	return (
		<div className="lpc-r6feel">
			{panels.map((p, i) => {
				const inAt = first + i * PANEL - (i === 0 ? 0 : 0)
				const last = i === panels.length - 1
				return (
					<div
						key={p.key}
						className="lpc-r6feel-panel"
						style={at(inAt, { zIndex: i + 1, "--out": last ? "999999ms" : `${first + (i + 1) * PANEL}ms` } as Record<string, string | number>)}
					>
						<div className="lpc-r6feel-panel-out" style={{ "--d": last ? "999999ms" : `${first + (i + 1) * PANEL}ms` } as CSSProperties}>
							<img src={img(p.backdrop, "w1280")} alt="" className="lpc-r6feel-kb" style={at(inAt)} />
							<div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(5,6,10,.88) 0, rgba(5,6,10,.45) 60%, rgba(5,6,10,.2) 100%)" }} />
							{p.w ? (
								<div className="lpc-r6feel-panel-text">
									<div className="lpc-r5f-kicker">How {f.hero.title} feels</div>
									<div className="lpc-r6feel-in" style={at(inAt + 250)}>
										<Word w={p.w} />
									</div>
									<span className="lpc-r6feel-bar">
										<b className="lpc-r5f-slam" style={at(inAt + 500, { background: p.w.hex, width: `${Math.min(100, p.w.value * 10)}%` })} />
									</span>
								</div>
							) : (
								<div className="lpc-r6feel-panel-hero">
									<div className="lpc-r6feel-panel-poster lpc-r5f-deal" style={at(end + 250)}>
										{data.pool[0] && <HeroPoster card={data.pool[0]} className="lpc-r6feel-static" />}
									</div>
									<div>
										<Chips words={f.words} ms={end + 500} />
										<div className="lpc-r5f-line lpc-r5f-rise mt-[3cqh]" style={at(end + 1100)}>
											That's <em>{f.hero.title}.</em>
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				)
			})}
			{/* The hand-over frame on top at first: it shrinks away into the first panel. */}
			<div className="lpc-r6feel-handover" style={at(first - 200)}>
				<div className="absolute inset-0 bg-[#05060a]" />
				{data.pool[0] && <HeroPoster card={data.pool[0]} />}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// C. Zoom through: the camera flies through the poster into the first feeling; each word comes from deep in the
// picture and flies past the viewer as the next backdrop zooms in. It lands on Interstellar's backdrop, poster back.
export const ZSTEP = 1700
export const ZOOM_MS = 1200 + 4 * ZSTEP + 2400
export function FeelingsZoom({ data }: ClipProps) {
	const f = feelings(data)
	if (!f) return <Missing />
	const first = 1200
	const end = first + f.words.length * ZSTEP
	return (
		<div className="lpc-r6feel">
			{f.words.map((w, i) => (
				<Bd key={w.key} path={w.backdrop} ms={first + i * ZSTEP - 250} zoom len={800} />
			))}
			<Bd path={f.hero.backdrop_path} ms={end - 150} dim={0.6} zoom len={900} />
			{/* The poster grows past the camera: the way in. */}
			<div className="lpc-r6feel-through" style={at(500)}>
				{data.pool[0] && <HeroPoster card={data.pool[0]} />}
			</div>
			<div className="lpc-r5f-kicker lpc-r5f-rise lpc-r6feel-kicker-c" style={at(first)}>
				How {f.hero.title} feels
			</div>
			<div className="lpc-r6feel-zstage">
				{f.words.map((w, i) => (
					<div key={w.key} className="lpc-r6feel-zin" style={at(first + i * ZSTEP + (i ? 60 : 0))}>
						<div className="lpc-r6feel-zout" style={at(first + (i + 1) * ZSTEP - 420)}>
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
