// The feelings of a title, one at a time: the camera flies through its poster and each feeling word lands huge over
// one of the title's own backdrops, chosen by hand from its TMDB images.
import type { CSSProperties } from "react"
import type { IntroCard } from "~/ui/living-room/intro/data"
import type { FeelTitle } from "~/ui/living-room/intro/data"
import type { PickFeelData } from "~/ui/living-room/intro/data"
import {
	Missing,
	at,
	img,
	sayable,
} from "~/ui/living-room/intro/parts/feeling-kit"
import { HeroPoster } from "~/ui/living-room/intro/parts/hero-poster"
import type { SceneProps } from "~/ui/living-room/intro/scene"

/** The poster's scale where the pick's dive leaves it (picked-for-you.tsx HERO_PUSH). */
export const HERO_PUSH = 1.08

/**
 * Avatar's own backdrops, one per feeling: chosen by hand from TMDB's image set for movie 19995 (GET
 * /3/movie/19995/images, 93 language-free backdrops, looked at on 2026-10-17). A static decision: no TMDB calls at
 * runtime. The scene ends on Avatar's main backdrop, so it isn't used for a feeling.
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
const AVATAR_SPARE = [
	"/qCv5kKfYRAofZGxYCPWlIuE6jP5.jpg",
	"/3AOjItDNXMdnwyz5WTKUMSHWt1e.jpg",
	"/xMMrBziwJqrgjerqpNeQvwuwiUp.jpg",
]

type Feel = {
	hero: FeelTitle
	card: IntroCard
	words: ReturnType<typeof withBackdrops>
}

function withBackdrops(
	hero: FeelTitle,
	map: Record<string, string>,
	spareList: string[],
) {
	const spare = [...spareList]
	return sayable(hero.top, 4).map((w) => ({
		...w,
		backdrop: map[w.word.toLowerCase()] ?? spare.shift() ?? hero.backdrop_path,
	}))
}

/** The pick (Avatar) with its feelings (content.json `pickFeel`), and its card for the hand-over poster. */
export function avatarFeel(data: SceneProps["data"]): Feel | null {
	const x = (data.extra.pickFeel ?? null) as PickFeelData | null
	const card = data.pool.find((c) => c.key === x?.pickKey)
	if (!x?.pick || !card) return null
	return {
		hero: x.pick,
		card,
		words: withBackdrops(x.pick, AVATAR, AVATAR_SPARE),
	}
}

/** A full-screen backdrop that fades in at `ms` and keeps drifting; `zoom` comes in from closer. */
function Bd({
	path,
	ms,
	dim = 0.5,
	zoom = false,
	len = 700,
	kbl,
}: {
	path: string | null
	ms: number
	dim?: number
	zoom?: boolean
	len?: number
	kbl?: number
}) {
	return (
		<div
			className={`intro-feel-bd ${zoom ? "intro-feel-bd-zoom" : ""}`}
			style={at(ms, { "--len": `${len}ms` })}
		>
			<img
				src={img(path, "w1280")}
				alt=""
				className={`intro-feel-kb ${kbl ? "intro-tempo-kb" : ""}`}
				style={at(ms, kbl ? { "--kbl": `${kbl}ms` } : {})}
			/>
			<div
				className="absolute inset-0"
				style={{
					background: `linear-gradient(90deg, rgba(5,6,10,${dim + 0.35}) 0, rgba(5,6,10,${dim}) 55%, rgba(5,6,10,${dim * 0.5}) 100%)`,
				}}
			/>
		</div>
	)
}

function Word({ w }: { w: { emoji: string; word: string } }) {
	return (
		<div className="intro-feel-word text-center">
			<span className="intro-feel-emoji">{w.emoji}</span> {w.word}.
		</div>
	)
}

function Chips({ words, ms }: { words: Feel["words"]; ms: number }) {
	return (
		<div className="flex flex-wrap justify-center gap-[1.2cqw]">
			{words.map((w, i) => (
				<span
					key={w.key}
					className="intro-ask-chip intro-ask-pop intro-feel-chip"
					style={at(ms + i * 140, { "--c": w.hex })}
				>
					<span aria-hidden="true">{w.emoji}</span> {w.word}
				</span>
			))}
		</div>
	)
}

// The timing, shifted by `lead` (the poster's arrival, 0 when the scene cuts in on the pushed-in poster).
const FIRST = 700
const ZSTEP = 1550
/** "That's <title>." rises at END + 1000 (850 ms), then a 1.1 s read, the last 800 under the crossfade. */
export const zoomMs = (feelings: number, lead: number) =>
	lead + FIRST + feelings * ZSTEP + 1000 + 850 + 1100
function Zoom({ f, lead }: { f: Feel; lead: number }) {
	const first = lead + FIRST
	const end = first + f.words.length * ZSTEP
	const ms = zoomMs(f.words.length, lead)
	return (
		<div className="intro-feel">
			{f.words.map((w, i) => (
				<Bd
					key={w.key}
					path={w.backdrop}
					ms={first + i * ZSTEP - 250}
					zoom
					len={800}
				/>
			))}
			<Bd
				path={f.hero.backdrop_path}
				ms={end - 150}
				dim={0.6}
				zoom
				len={900}
				kbl={ms - (end - 150)}
			/>
			{/* The way in: the poster grows past the camera. Cut in, it is already pushed in; arriving, it pushes in first. */}
			{lead ? (
				<div
					className="intro-tempo-push"
					style={at(0, { "--dur": `${lead}ms`, "--p": HERO_PUSH })}
				>
					<div
						className="intro-feel-through intro-tempo-through"
						style={at(lead)}
					>
						<HeroPoster card={f.card} />
					</div>
				</div>
			) : (
				<div className="intro-feel-through intro-tempo-through" style={at(0)}>
					<div
						className="intro-tempo-pushed"
						style={{ "--p": HERO_PUSH } as CSSProperties}
					>
						<HeroPoster card={f.card} />
					</div>
				</div>
			)}
			<div
				className="intro-ask-kicker intro-ask-rise intro-feel-kicker-c"
				style={at(first)}
			>
				How {f.hero.title} feels
			</div>
			<div className="intro-feel-zstage">
				{f.words.map((w, i) => (
					<div
						key={w.key}
						className="intro-feel-zin"
						style={at(first + i * ZSTEP + (i ? 60 : 0))}
					>
						<div
							className="intro-feel-zout"
							style={at(first + (i + 1) * ZSTEP - 420)}
						>
							<Word w={w} />
						</div>
					</div>
				))}
			</div>
			<div className="intro-feel-zfinal">
				<div
					className="intro-feel-zposter intro-ask-deal"
					style={at(end + 100)}
				>
					<HeroPoster card={f.card} className="intro-feel-static" />
				</div>
				<div className="mt-[2.4cqh] flex justify-center">
					<Chips words={f.words} ms={end + 450} />
				</div>
				<div
					className="intro-ask-line intro-ask-rise mt-[2.2cqh] text-center"
					style={at(end + 1000)}
				>
					That's <em>{f.hero.title}.</em>
				</div>
			</div>
		</div>
	)
}

export function HowItFeels({ data }: SceneProps) {
	const f = avatarFeel(data)
	return f ? <Zoom f={f} lead={0} /> : <Missing />
}
