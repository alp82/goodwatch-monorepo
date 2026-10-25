// The "Use with AI" chapter: one evening with The Penguin in a ChatGPT-style chat (story.tsx), then the chat sinks
// back and 20 more asks (uses.ts, each a real MCP tool, its plain name on the pill) come out of the depth and rush
// past the camera: the first two typed big in the middle, then smaller, faster and more at once, spread over the
// whole picture. Last frame: "Use with AI" in the middle over a lone "Ask anything" composer.
import type { CSSProperties } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { useFilmPhone } from "~/ui/living-room/intro/parts/film-phone"
import { Push } from "~/ui/living-room/intro/parts/push"
import type { SceneProps } from "~/ui/living-room/intro/scene"
import { Typed, at, titleOf, typedEnd } from "./kit"
import {
	Final,
	Headline,
	STORY_END,
	StoryAsks,
	StoryRoot,
	StoryWindow,
} from "./story"
import { USES } from "./uses"

const S = STORY_END
const GAPS = [
	880, 680, 500, 390, 300, 240, 190, 150, 120, 100, 85, 72, 62, 55, 50, 46, 44,
	42, 40,
]
const PER = [16, 12]
const GOLDEN = (137.5 * Math.PI) / 180

const PLAN = (() => {
	let t = S
	return USES.map((u, i) => {
		const gap = GAPS[i] ?? 40
		const per = PER[i]
		const near = per ? 220 : Math.min(600, Math.max(260, gap * 1.8))
		const hold = per
			? ([...u.ask].length - 1) * per + 260
			: Math.min(500, Math.max(120, gap * 1.6))
		const pass = per ? 520 : Math.min(560, Math.max(300, gap * 2.2))
		const r = i < 2 ? 0 : 0.3 + 0.7 * Math.min(1, (i - 2) / 7)
		const x = Math.cos(i * GOLDEN) * r * 30
		const y = Math.sin(i * GOLDEN) * r * 30
		const appear = t
		const leave = appear + (per ? hold : near + hold * 0.5)
		t += gap
		return { u, i, per, appear, near, leave, pass, x, y }
	})
})()
const LAST = PLAN[PLAN.length - 1]
const FIN = LAST.appear + 300
export const USE_WITH_AI_MS = FIN + 1150

export function UseWithAi({ data }: SceneProps) {
	const phone = useFilmPhone()
	if (!titleOf(data, "The Penguin")) return null
	const k = phone ? 1.15 : 1
	return (
		<StoryRoot label="Use with AI: in a ChatGPT-style chat GoodWatch picks The Penguin from the member's Wishlist, gives its one score and logs episode 1; then many more asks rush past: best episodes, dropping a show, a top 5 list, similar titles, services and more.">
			<Push from={FIN} dur={USE_WITH_AI_MS - FIN} scale={1.04}>
				<StoryWindow
					data={data}
					fin={FIN}
					wrapClass="intro-ai-to"
					wrapStyle={at(S - 120, 800, {
						"--ts": 0.86,
						"--ty": "3cqh",
						"--to": 0.22,
					})}
				/>
				<StoryAsks />
				{PLAN.map((p) => {
					const size = Math.max(1.5, 3.8 * 0.87 ** p.i) * k
					return (
						<div key={p.u.ask} className="intro-ai-mid" aria-hidden="true">
							<span
								className="intro-ai-rush-pos"
								style={{ left: `${p.x}cqw`, top: `${p.y}cqh` }}
							>
								<span
									className="intro-ai-rush-near"
									style={at(p.per ? p.appear - 120 : p.appear, p.near, {
										"--nx": `${-p.x * 0.85}cqw`,
										"--ny": `${-p.y * 0.85}cqh`,
										"--z0": p.per ? 0.7 : 0.25,
									})}
								>
									<span
										className="intro-ai-rush-pass"
										style={at(p.leave, p.pass, {
											"--px": `${p.x * 1.4}cqw`,
											"--py": `${p.y * 1.4}cqh`,
											"--z1": p.per ? 2.4 : 2,
										})}
									>
										<span
											className="intro-ai-rush-ask"
											style={
												{ fontSize: `${size.toFixed(2)}cqw` } as CSSProperties
											}
										>
											{p.per ? (
												<Typed text={p.u.ask} start={p.appear} per={p.per} />
											) : (
												p.u.ask
											)}
											<span
												className="intro-ai-rush-tool intro-ai-fade"
												style={at(
													p.per
														? typedEnd(p.u.ask, p.appear, p.per)
														: p.appear + p.near * 0.4,
													250,
												)}
											>
												<span className="intro-ai-chat-app">
													<GoodWatchG height="0.8em" />
												</span>
												{p.u.tool}
											</span>
										</span>
									</span>
								</span>
							</span>
						</div>
					)
				})}
				<Headline fin={FIN} />
				<Final fin={FIN} />
			</Push>
		</StoryRoot>
	)
}
