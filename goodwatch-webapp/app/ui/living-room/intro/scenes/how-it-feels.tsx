// "How it feels": the pick's feelings, one at a time, huge, each over one of the title's own pictures, flying
// through its poster from "Picked for you" (a cut from that scene's last frame). It ends on the last feeling, still in
// motion, under the crossfade into search.
import type { CSSProperties } from "react"
import { Missing, at, img } from "~/ui/living-room/intro/parts/feeling-kit"
import {
	HERO_PUSH,
	avatarFeel,
} from "~/ui/living-room/intro/parts/feelings-zoom"
import { HeroPoster } from "~/ui/living-room/intro/parts/hero-poster"
import type { SceneProps } from "~/ui/living-room/intro/scene"

const FIRST = 700
const ZSTEP = 1550
/** After the last feeling lands: a read, the last 800 ms under the crossfade. */
const TAIL = 700
export const howItFeelsMs = (feelings: number) =>
	FIRST + feelings * ZSTEP + TAIL

function Bd({
	path,
	ms,
	kbl,
}: { path: string | null; ms: number; kbl?: number }) {
	return (
		<div
			className="intro-feel-bd intro-feel-bd-zoom"
			style={at(ms, { "--len": "800ms" })}
		>
			<img
				src={img(path, "w1280")}
				alt=""
				decoding="async"
				className={`intro-feel-kb ${kbl ? "intro-tempo-kb" : ""}`}
				style={at(ms, kbl ? { "--kbl": `${kbl}ms` } : {})}
			/>
			<div
				className="absolute inset-0"
				style={{
					background:
						"linear-gradient(90deg, rgba(5,6,10,0.85) 0, rgba(5,6,10,0.5) 55%, rgba(5,6,10,0.25) 100%)",
				}}
			/>
		</div>
	)
}

export function HowItFeels({ data }: SceneProps) {
	const f = avatarFeel(data)
	if (!f) return <Missing />
	const n = f.words.length
	const ms = howItFeelsMs(n)
	return (
		<div className="intro-feel">
			{f.words.map((w, i) => {
				const start = FIRST + i * ZSTEP - 250
				// The last picture drifts until the scene ends, so the hand-over into search never stands still.
				return (
					<Bd
						key={w.key}
						path={w.backdrop}
						ms={start}
						kbl={i === n - 1 ? ms - start : undefined}
					/>
				)
			})}
			{/* The way in: the pick's pushed-in poster grows past the camera. */}
			<div className="intro-feel-through intro-tempo-through" style={at(0)}>
				<div
					className="intro-tempo-pushed"
					style={{ "--p": HERO_PUSH } as CSSProperties}
				>
					<HeroPoster card={f.card} />
				</div>
			</div>
			<div
				className="intro-ask-kicker intro-ask-rise intro-feel-kicker-c"
				style={at(FIRST)}
			>
				How {f.hero.title} feels
			</div>
			<div className="intro-feel-zstage">
				{f.words.map((w, i) => (
					<div
						key={w.key}
						className="intro-feel-zin"
						style={at(FIRST + i * ZSTEP + (i ? 60 : 0))}
					>
						{/* Every feeling but the last flies past; the last one stays for the crossfade. */}
						<div
							className={i < n - 1 ? "intro-feel-zout" : "intro-lite-hold"}
							style={at(
								i < n - 1
									? FIRST + (i + 1) * ZSTEP - 420
									: FIRST + i * ZSTEP + 760,
								i < n - 1
									? {}
									: { "--hl": `${ms - (FIRST + i * ZSTEP + 760)}ms` },
							)}
						>
							<div className="intro-feel-word text-center">
								<span className="intro-feel-emoji">{w.emoji}</span> {w.word}.
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
