// PROTOTYPE (start page lab, round 3): stage g · "Vignette focus": stage a's flow and tray; the whole scene dims smoothly
// toward the search block (one large elliptical vignette over the scene, no panel, no blur), the block floats with the
// most padding and the largest field, and the moods are a bigger grid of tiles, each fan on a soft glow of its color.
import type { BlockVariant } from "../../lab/types"
import { moodHue, type StageFlow, useMoodFaces } from "./ab-shared"
import { EfgFan, EfgField, EfgPrompts, EfgStage } from "./efg-shared"

/** Darkest behind the search block, fading over most of the scene; the sides keep a little shade too. */
const VIGNETTE = [
	"radial-gradient(ellipse 58% 42% at 50% 30%, rgb(3 6 14 / .86) 0%, rgb(3 6 14 / .74) 38%, rgb(3 6 14 / .46) 64%, rgb(3 6 14 / .16) 86%, rgb(3 6 14 / 0) 100%)",
	"radial-gradient(ellipse 90% 80% at 50% 40%, rgb(3 6 14 / 0) 60%, rgb(3 6 14 / .35) 100%)",
].join(", ")

const FIELD_SHADOW =
	"0 1px 0 rgb(255 255 255 / .07) inset, 0 3px 6px rgb(0 0 0 / .45), 0 16px 32px rgb(0 0 0 / .5), 0 40px 90px rgb(0 0 0 / .6)"

function Top({ f }: { f: StageFlow }) {
	const moods = f.data.guest.moods
	const faces = useMoodFaces(moods)
	const moodOn = f.source.kind === "mood" ? f.source.key : null
	return (
		<div className="relative pt-3 sm:pt-16 lg:pt-[clamp(64px,12vh,128px)]">
			<h1 className="pointer-events-auto text-center text-[26px] font-extrabold leading-8 tracking-tight text-white [text-shadow:0_2px_28px_rgb(0_0_0/.7)] sm:text-[46px] sm:leading-[1.12] lg:text-[52px]">
				Find something to watch by mood or anything
			</h1>
			<EfgField
				f={f}
				className="mt-4 max-w-[960px] sm:mt-11"
				inputText="lg:[&_input]:!text-[46px]"
				body="h-[58px] rounded-[20px] bg-gray-900 ring-1 ring-white/12 sm:h-[90px] sm:rounded-[26px] lg:h-[100px]"
				decor={<span aria-hidden className="pointer-events-none absolute inset-0 rounded-[20px] sm:rounded-[26px]" style={{ boxShadow: FIELD_SHADOW }} />}
				glow="rounded-[20px] ring-2 ring-amber-400/80 shadow-[0_0_0_7px_rgb(251_191_36/.1),0_0_80px_12px_rgb(251_191_36/.25)] sm:rounded-[26px]"
			/>
			<EfgPrompts f={f} className="mt-3.5 sm:mt-7" />
			{/* Phones: two rows that scroll sideways, two tiles across. Wider: a grid, 3 then 4 per row. */}
			<div className="pointer-events-auto -mx-4 mt-3 overflow-x-auto px-4 pt-1 pb-2 [scrollbar-width:none] sm:mx-auto sm:mt-8 sm:max-w-[1000px] sm:overflow-visible sm:px-0">
				<ul className="grid grid-flow-col grid-rows-2 auto-cols-[calc((100vw-2.75rem)/2)] gap-2.5 sm:grid-flow-row sm:grid-rows-none sm:auto-cols-auto sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-3.5">
					{moods.map((m) => {
						const on = moodOn === m.key
						const hue = moodHue(m.key)
						return (
							<li key={m.key} className="min-w-0">
								<button
									type="button"
									onClick={() => (on ? f.clear() : f.mood(m.key))}
									aria-pressed={on}
									className={`group efg-fan-host efg-lift flex h-[56px] w-full cursor-pointer items-center gap-2 rounded-2xl pr-2.5 pl-1 text-left shadow-[0_10px_28px_rgb(0_0_0/.45)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:h-[78px] sm:gap-3 sm:pr-3.5 sm:pl-2 ${on ? "bg-gray-900 ring-2 ring-amber-400" : "bg-gray-950/90 ring-1 ring-white/10 hover:bg-gray-900"}`}
								>
									<span className="relative shrink-0">
										{/* The mood's color, glowing behind its fan; it brightens on hover and when chosen (opacity). */}
										<span
											aria-hidden
											className={`absolute -inset-3 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}
											style={{ background: `radial-gradient(circle at 50% 60%, ${hue}cc, ${hue}33 45%, transparent 70%)` }}
										/>
										<EfgFan cards={faces[m.key]?.fan ?? []} size={24} spread={1.2} className="relative sm:hidden" />
										<EfgFan cards={faces[m.key]?.fan ?? []} size={32} spread={1.2} className="relative hidden sm:block" />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-bold leading-5 text-white sm:text-[17px] sm:leading-6">{m.label}</span>
										<span className="block truncate text-[11px] leading-4 text-gray-400 sm:text-xs">{faces[m.key]?.examples}</span>
									</span>
								</button>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}

function VignetteStage() {
	return (
		<EfgStage
			k="g"
			vars="[--room-top:110px] sm:[--room-top:140px] lg:[--room-top:210px]"
			overlays={<div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: VIGNETTE }} />}
			top={(f) => <Top f={f} />}
		/>
	)
}

export const variant: BlockVariant = { key: "g", name: "Vignette focus", C: VignetteStage }
