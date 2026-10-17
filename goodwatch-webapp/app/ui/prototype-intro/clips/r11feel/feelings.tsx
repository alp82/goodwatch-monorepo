// PROTOTYPE - throwaway. Round 11 "r11feel": "How it feels" now follows the "For you" pick. Round 9's zoom-through
// (r9a/feelings.tsx), unchanged in treatment and timing, made to work for any title:
// - "How Avatar feels": starts on the pick's hand-over poster (already pushed in, `enter: "cut"`), Avatar's own
//   attributes (r11feel.server.ts) over Avatar's own backdrops, chosen by hand below.
// - "How Interstellar feels" for this position: the approved clip, but its poster arrives under the crossfade (a slow
//   push for LEAD ms) before it flies through, since the clip before it now ends on another title.
import type { CSSProperties } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import type { R5Hero } from "~/server/prototype-intro/r5feel.server"
import type { R11FeelData } from "~/server/prototype-intro/r11feel.server"
import type { ClipProps } from "../../clip"
import { HeroPoster } from "../../hero"
import { Missing, at, img, r5, sayable } from "../r5feel/kit"

/** The poster's scale where the pick's dive leaves it (r9a/pick.tsx HERO_PUSH). */
export const HERO_PUSH = 1.08

/**
 * Avatar's own backdrops, one per feeling: chosen by hand from TMDB's image set for movie 19995 (GET
 * /3/movie/19995/images, 93 language-free backdrops, looked at on 2026-10-17). A static decision: no TMDB calls at
 * runtime. The clip ends on Avatar's main backdrop, so it isn't used for a feeling.
 */
const AVATAR: Record<string, string> = {
	// Jake on his banshee, soaring past the floating mountains into the sun.
	spectacular: "/jlQJDD0L5ZojjlS0KYnApdO0n19.jpg",
	// Neytiri walking into the sunlit jungle, from behind.
	immersive: "/xg8QMKgG0NgAIVJQZD4X2scenxu.jpg",
	// Neytiri with the glowing woodsprite seeds drifting around her hand.
	wondrous: "/eDwzMSFGjwlwtLDCNJSJ7MAW7nr.jpg",
	// The floating Hallelujah Mountains, joined by hanging vines.
	fantastical: "/eD1C60oJXvA5uYVBx3k6lq2RMve.jpg",
}
/** The banshee flight wide, the glowing forest, the floating mountains in mist. */
const AVATAR_SPARE = ["/qCv5kKfYRAofZGxYCPWlIuE6jP5.jpg", "/3AOjItDNXMdnwyz5WTKUMSHWt1e.jpg", "/xMMrBziwJqrgjerqpNeQvwuwiUp.jpg"]

/** Interstellar's own backdrops, as round 7 chose them by hand (r7feel/feelings.tsx, r9a/feelings.tsx). */
const INTERSTELLAR: Record<string, string> = {
	spectacular: "/pbrkL804c8yAv3zBZR4QPEafpAR.jpg",
	immersive: "/rAiYTfKGqDCRIIqo664sY9XZIvQ.jpg",
	wondrous: "/vvjYv7bSWerbsi0LsMjLnTVOX7c.jpg",
	tense: "/wqBlk1ejN71gzKvlbXYrC1FfdsY.jpg",
}
const INTERSTELLAR_SPARE = ["/Ab9eQH5O3VCTQjJsQghxjYOkfMp.jpg", "/pOvgpLgOO84GTqgwFpE5W4OBIBa.jpg", "/9mmkq59uRuJWDFz9UHeX5ATNJYf.jpg"]

type Feel = { hero: R5Hero; card: LandingCard; words: ReturnType<typeof withBackdrops> }

function withBackdrops(hero: R5Hero, map: Record<string, string>, spareList: string[]) {
	const spare = [...spareList]
	return sayable(hero.top, 4).map((w) => ({ ...w, backdrop: map[w.word.toLowerCase()] ?? spare.shift() ?? hero.backdrop_path }))
}

/** The pick (Avatar), as r11feel.server.ts read it, with its card for the hand-over poster. */
export function avatarFeel(data: ClipProps["data"]): Feel | null {
	const x = (data.extra.r11feel ?? null) as R11FeelData | null
	const card = data.pool.find((c) => c.key === x?.pickKey)
	if (!x?.pick || !card) return null
	return { hero: x.pick, card, words: withBackdrops(x.pick, AVATAR, AVATAR_SPARE) }
}

function interstellarFeel(data: ClipProps["data"]): Feel | null {
	const hero = r5(data)?.hero
	const card = data.pool[0]
	if (!hero || !card) return null
	return { hero, card, words: withBackdrops(hero, INTERSTELLAR, INTERSTELLAR_SPARE) }
}

/** A full-screen backdrop that fades in at `ms` and keeps drifting; `zoom` comes in from closer. */
function Bd({ path, ms, dim = 0.5, zoom = false, len = 700, kbl }: { path: string | null; ms: number; dim?: number; zoom?: boolean; len?: number; kbl?: number }) {
	return (
		<div className={`lpc-r6feel-bd ${zoom ? "lpc-r6feel-bd-zoom" : ""}`} style={at(ms, { "--len": `${len}ms` })}>
			<img src={img(path, "w1280")} alt="" className={`lpc-r6feel-kb ${kbl ? "lpc-r9a-kb" : ""}`} style={at(ms, kbl ? { "--kbl": `${kbl}ms` } : {})} />
			<div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(5,6,10,${dim + 0.35}) 0, rgba(5,6,10,${dim}) 55%, rgba(5,6,10,${dim * 0.5}) 100%)` }} />
		</div>
	)
}

function Word({ w }: { w: { emoji: string; word: string } }) {
	return (
		<div className="lpc-r6feel-word text-center">
			<span className="lpc-r6feel-emoji">{w.emoji}</span> {w.word}.
		</div>
	)
}

function Chips({ words, ms }: { words: Feel["words"]; ms: number }) {
	return (
		<div className="flex flex-wrap justify-center gap-[1.2cqw]">
			{words.map((w, i) => (
				<span key={w.key} className="lpc-r5f-chip lpc-r5f-pop lpc-r6feel-chip" style={at(ms + i * 140, { "--c": w.hex })}>
					<span aria-hidden="true">{w.emoji}</span> {w.word}
				</span>
			))}
		</div>
	)
}

// Round 9's timing, shifted by `lead` (the poster's arrival, 0 when the clip cuts in on the pushed-in poster).
const FIRST = 700
const ZSTEP = 1550
/** "That's <title>." rises at END + 1000 (850 ms), then a 1.1 s read, the last 800 under the crossfade. */
export const zoomMs = (feelings: number, lead: number) => lead + FIRST + feelings * ZSTEP + 1000 + 850 + 1100
/** Interstellar's poster pushes in this long under the crossfade before it flies through. */
export const LEAD = 550

function Zoom({ f, lead }: { f: Feel; lead: number }) {
	const first = lead + FIRST
	const end = first + f.words.length * ZSTEP
	const ms = zoomMs(f.words.length, lead)
	return (
		<div className="lpc-r6feel">
			{f.words.map((w, i) => (
				<Bd key={w.key} path={w.backdrop} ms={first + i * ZSTEP - 250} zoom len={800} />
			))}
			<Bd path={f.hero.backdrop_path} ms={end - 150} dim={0.6} zoom len={900} kbl={ms - (end - 150)} />
			{/* The way in: the poster grows past the camera. Cut in, it is already pushed in; arriving, it pushes in first. */}
			{lead ? (
				<div className="lpc-r9a-push" style={at(0, { "--dur": `${lead}ms`, "--p": HERO_PUSH })}>
					<div className="lpc-r6feel-through lpc-r9a-through" style={at(lead)}>
						<HeroPoster card={f.card} />
					</div>
				</div>
			) : (
				<div className="lpc-r6feel-through lpc-r9a-through" style={at(0)}>
					<div className="lpc-r9a-pushed" style={{ "--p": HERO_PUSH } as CSSProperties}>
						<HeroPoster card={f.card} />
					</div>
				</div>
			)}
			<div className="lpc-r5f-kicker lpc-r5f-rise lpc-r6feel-kicker-c" style={at(first)}>
				How {f.hero.title} feels
			</div>
			<div className="lpc-r6feel-zstage">
				{f.words.map((w, i) => (
					<div key={w.key} className="lpc-r6feel-zin" style={at(first + i * ZSTEP + (i ? 60 : 0))}>
						<div className="lpc-r6feel-zout" style={at(first + (i + 1) * ZSTEP - 420)}>
							<Word w={w} />
						</div>
					</div>
				))}
			</div>
			<div className="lpc-r6feel-zfinal">
				<div className="lpc-r6feel-zposter lpc-r5f-deal" style={at(end + 100)}>
					<HeroPoster card={f.card} className="lpc-r6feel-static" />
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

export function FeelingsAvatarR11({ data }: ClipProps) {
	const f = avatarFeel(data)
	return f ? <Zoom f={f} lead={0} /> : <Missing />
}

export function FeelingsInterstellarR11({ data }: ClipProps) {
	const f = interstellarFeel(data)
	return f ? <Zoom f={f} lead={LEAD} /> : <Missing />
}
