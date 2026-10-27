// PROTOTYPE (start page lab, round 3): stage e · "Shadow pool": stage a's flow and tray, with the search block lifted by
// a huge soft dark pool behind it (layered radial gradients, no edge, no panel), a bigger H1, a big field with a deep
// layered drop shadow and an amber focus glow, and bigger mood tiles in two rows on desktop.
import type { BlockVariant } from "../../lab/types"
import { moodHue, type StageFlow, useMoodFaces } from "./ab-shared"
import { EfgFan, EfgField, EfgPrompts, EfgStage } from "./efg-shared"

const POOL = [
	"radial-gradient(ellipse 34% 30% at 50% 42%, rgb(2 4 10 / .55), rgb(2 4 10 / 0) 100%)",
	"radial-gradient(ellipse 50% 46% at 50% 45%, rgb(2 4 10 / .82) 0%, rgb(2 4 10 / .66) 40%, rgb(2 4 10 / .34) 68%, rgb(2 4 10 / .1) 88%, rgb(2 4 10 / 0) 100%)",
].join(", ")

const FIELD_SHADOW =
	"0 1px 0 rgb(255 255 255 / .06) inset, 0 2px 4px rgb(0 0 0 / .45), 0 10px 22px rgb(0 0 0 / .45), 0 28px 56px rgb(0 0 0 / .55), 0 60px 120px rgb(0 0 0 / .55)"

function Top({ f }: { f: StageFlow }) {
	const moods = f.data.guest.moods
	const faces = useMoodFaces(moods)
	const moodOn = f.source.kind === "mood" ? f.source.key : null
	return (
		<div className="relative isolate pt-3 sm:pt-12 lg:pt-[clamp(48px,9vh,104px)]">
			{/* The pool: hundreds of px of fading dark behind the whole block. */}
			<div
				aria-hidden
				className="pointer-events-none absolute left-1/2 -top-24 -z-10 h-[calc(100%+260px)] w-[230%] -translate-x-1/2 sm:w-[min(1700px,170%)]"
				style={{ background: POOL }}
			/>
			<h1 className="pointer-events-auto text-center text-[26px] font-extrabold leading-8 tracking-tight text-white [text-shadow:0_2px_4px_rgb(0_0_0/.6),0_8px_40px_rgb(0_0_0/.85)] sm:text-5xl sm:leading-[1.1] lg:text-[52px] 2xl:text-[56px]">
				Find something to watch by mood or anything
			</h1>
			<EfgField
				f={f}
				className="mt-4 max-w-[880px] sm:mt-9"
				body="h-[62px] rounded-2xl bg-gray-900 ring-1 ring-white/12 sm:h-[84px] sm:rounded-[22px] lg:h-[92px]"
				decor={<span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-[22px]" style={{ boxShadow: FIELD_SHADOW }} />}
				glow="rounded-2xl ring-2 ring-amber-400/80 shadow-[0_0_0_6px_rgb(251_191_36/.12),0_0_70px_10px_rgb(251_191_36/.28)] sm:rounded-[22px]"
			/>
			<EfgPrompts f={f} className="mt-3 sm:mt-6" />
			<div className="pointer-events-auto -mx-4 mt-3 overflow-x-auto px-4 pt-1 pb-2 [scrollbar-width:none] sm:-mx-6 sm:mt-7 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0">
				<ul className="flex w-max gap-2.5 lg:mx-auto lg:w-auto lg:max-w-[1010px] lg:flex-wrap lg:justify-center lg:gap-3.5">
					{moods.map((m) => {
						const on = moodOn === m.key
						const hue = moodHue(m.key)
						return (
							<li key={m.key}>
								<button
									type="button"
									onClick={() => (on ? f.clear() : f.mood(m.key))}
									aria-pressed={on}
									className={`efg-fan-host efg-lift flex w-[112px] cursor-pointer flex-col items-center rounded-2xl px-2 pt-2.5 pb-2 text-center shadow-[0_10px_30px_rgb(0_0_0/.45)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:w-[150px] sm:px-2.5 sm:pt-3.5 sm:pb-3 ${on ? "bg-gray-900 ring-2 ring-amber-400" : "bg-gray-950/90 ring-1 ring-white/10 hover:bg-gray-900"}`}
									style={{ backgroundImage: `radial-gradient(ellipse 70% 60% at 50% 40%, ${hue}${on ? "70" : "40"}, transparent 75%)` }}
								>
									<EfgFan cards={faces[m.key]?.fan ?? []} size={30} className="sm:hidden" />
									<EfgFan cards={faces[m.key]?.fan ?? []} size={46} className="hidden sm:block" />
									<span className="mt-1.5 flex max-w-full items-center gap-1.5 text-sm font-bold leading-5 text-white sm:mt-2 sm:text-base">
										<span className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5" style={{ background: hue }} />
										<span className="truncate">{m.label}</span>
									</span>
									<span className="mt-0.5 block w-full truncate text-[11px] leading-4 text-gray-400 sm:text-xs">{faces[m.key]?.examples}</span>
								</button>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}

function ShadowPoolStage() {
	return <EfgStage k="e" vars="[--room-top:110px] sm:[--room-top:140px] lg:[--room-top:200px]" top={(f) => <Top f={f} />} />
}

export const variant: BlockVariant = { key: "e", name: "Shadow pool", C: ShadowPoolStage }
