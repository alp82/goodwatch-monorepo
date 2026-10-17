// PROTOTYPE - throwaway. Round 14: "How Avatar feels" without the summary screen (owner: "for how it feels, remove the
// last screen with the summary"). Round 11's zoom-through (r11feel/feelings.tsx) ends on the last feeling: the word
// stays and its backdrop keeps drifting, under the crossfade into search.
import type { CSSProperties } from "react"
import type { ClipProps } from "../../../clip"
import { HeroPoster } from "../../../hero"
import { HERO_PUSH, avatarFeel } from "../../r11feel/feelings"
import { Missing, at, img } from "../../r5feel/kit"

const FIRST = 700
const ZSTEP = 1550
/** After the last feeling lands: a read, the last 800 ms under the crossfade. */
const TAIL = 700
export const feelingsR14Ms = (feelings: number) => FIRST + feelings * ZSTEP + TAIL

function Bd({ path, ms, kbl }: { path: string | null; ms: number; kbl?: number }) {
	return (
		<div className="lpc-r6feel-bd lpc-r6feel-bd-zoom" style={at(ms, { "--len": "800ms" })}>
			<img
				src={img(path, "w1280")}
				alt=""
				decoding="async"
				className={`lpc-r6feel-kb ${kbl ? "lpc-r9a-kb" : ""}`}
				style={at(ms, kbl ? { "--kbl": `${kbl}ms` } : {})}
			/>
			<div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(5,6,10,0.85) 0, rgba(5,6,10,0.5) 55%, rgba(5,6,10,0.25) 100%)" }} />
		</div>
	)
}

export function FeelingsAvatarR14({ data }: ClipProps) {
	const f = avatarFeel(data)
	if (!f) return <Missing />
	const n = f.words.length
	const ms = feelingsR14Ms(n)
	return (
		<div className="lpc-r6feel">
			{f.words.map((w, i) => {
				const start = FIRST + i * ZSTEP - 250
				// The last picture drifts until the clip ends, so the hand-over into search never stands still.
				return <Bd key={w.key} path={w.backdrop} ms={start} kbl={i === n - 1 ? ms - start : undefined} />
			})}
			{/* The way in: the pick's pushed-in poster grows past the camera. */}
			<div className="lpc-r6feel-through lpc-r9a-through" style={at(0)}>
				<div className="lpc-r9a-pushed" style={{ "--p": HERO_PUSH } as CSSProperties}>
					<HeroPoster card={f.card} />
				</div>
			</div>
			<div className="lpc-r5f-kicker lpc-r5f-rise lpc-r6feel-kicker-c" style={at(FIRST)}>
				How {f.hero.title} feels
			</div>
			<div className="lpc-r6feel-zstage">
				{f.words.map((w, i) => (
					<div key={w.key} className="lpc-r6feel-zin" style={at(FIRST + i * ZSTEP + (i ? 60 : 0))}>
						{/* Every feeling but the last flies past; the last one stays for the crossfade. */}
						<div className={i < n - 1 ? "lpc-r6feel-zout" : "lpc-r14a-hold"} style={at(i < n - 1 ? FIRST + (i + 1) * ZSTEP - 420 : FIRST + i * ZSTEP + 760, i < n - 1 ? {} : { "--hl": `${ms - (FIRST + i * ZSTEP + 760)}ms` })}>
							<div className="lpc-r6feel-word text-center">
								<span className="lpc-r6feel-emoji">{w.emoji}</span> {w.word}.
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}
