// PROTOTYPE (start page lab, round 3): stage f · "Lamplight": stage a's flow and tray, with the search block lit like
// the room's lamps: a low warm amber glow above and around the field, a thick soft shadow under it as if it stood off
// the wall, more padding, and the moods as bigger cards in one sideways row (snap) whose poster fans spread on hover.
import type { BlockVariant } from "../../lab/types"
import { moodHue, type StageFlow, useMoodFaces } from "./ab-shared"
import { EfgFan, EfgField, EfgPrompts, EfgStage } from "./efg-shared"

/** Lamp light over the block: warm at the top center, gone long before any edge. Under it a faint dark for legibility. */
const LAMP = [
	"radial-gradient(ellipse 30% 26% at 50% 34%, rgb(253 186 116 / .2), rgb(251 191 36 / .07) 55%, rgb(251 191 36 / 0) 100%)",
	"radial-gradient(ellipse 48% 40% at 50% 30%, rgb(245 158 11 / .1), rgb(245 158 11 / 0) 100%)",
	"radial-gradient(ellipse 46% 44% at 50% 50%, rgb(3 6 14 / .7) 0%, rgb(3 6 14 / .5) 45%, rgb(3 6 14 / .18) 78%, rgb(3 6 14 / 0) 100%)",
].join(", ")

const FIELD_SHADOW =
	"0 1px 0 rgb(255 214 153 / .16) inset, 0 -1px 0 rgb(0 0 0 / .4) inset, 0 4px 8px rgb(0 0 0 / .4), 0 18px 36px rgb(0 0 0 / .5)"

/** Mood cards per breakpoint: phones 132 px, wider 184 px. */
const CARD = "w-[132px] sm:w-[184px]"

function Top({ f }: { f: StageFlow }) {
	const moods = f.data.guest.moods
	const faces = useMoodFaces(moods)
	const moodOn = f.source.kind === "mood" ? f.source.key : null
	return (
		<div className="relative isolate pt-3 sm:pt-14 lg:pt-[clamp(56px,10vh,112px)]">
			<div
				aria-hidden
				className="pointer-events-none absolute left-1/2 -top-28 -z-10 h-[calc(100%+240px)] w-[240%] -translate-x-1/2 sm:w-[min(1700px,170%)]"
				style={{ background: LAMP }}
			/>
			<h1 className="pointer-events-auto text-center text-[25px] font-extrabold leading-8 tracking-tight text-white [text-shadow:0_2px_24px_rgb(0_0_0/.75)] sm:text-[44px] sm:leading-[1.12] lg:text-5xl">
				Find something to watch by mood or anything
			</h1>
			<EfgField
				f={f}
				className="mt-4 max-w-[840px] sm:mt-10"
				body="h-[60px] rounded-full bg-gray-900 ring-1 ring-amber-200/15 sm:h-[80px] lg:h-[86px]"
				decor={
					<>
						{/* The thick soft shadow on the floor of the block: an ellipse under the field, offset down. */}
						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-[4%] top-[58%] h-[120%]"
							style={{ background: "radial-gradient(ellipse 50% 50% at 50% 40%, rgb(0 0 0 / .72), rgb(0 0 0 / .35) 50%, rgb(0 0 0 / 0) 75%)" }}
						/>
						<span aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: FIELD_SHADOW }} />
					</>
				}
				glow="rounded-full ring-2 ring-amber-300/80 shadow-[0_0_0_5px_rgb(251_191_36/.12),0_-10px_60px_8px_rgb(251_191_36/.3),0_0_100px_20px_rgb(245_158_11/.14)]"
			/>
			<EfgPrompts f={f} className="mt-3 sm:mt-7" />
			{/* One row of bigger cards; snaps a card at a time, fades out at the edges. */}
			<div
				className="pointer-events-auto relative -mx-4 mt-3 sm:mx-auto sm:mt-7 sm:max-w-[1050px]"
				style={{ maskImage: "linear-gradient(to right, transparent, #000 4%, #000 96%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, #000 4%, #000 96%, transparent)" }}
			>
				<ul className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-2 sm:pt-2 sm:pb-3 [scrollbar-width:none] sm:scroll-px-6 sm:gap-4 sm:px-6">
					{moods.map((m) => {
						const on = moodOn === m.key
						const hue = moodHue(m.key)
						return (
							<li key={m.key} className="snap-start">
								<button
									type="button"
									onClick={() => (on ? f.clear() : f.mood(m.key))}
									aria-pressed={on}
									className={`efg-fan-host efg-lift flex ${CARD} cursor-pointer flex-col items-center rounded-2xl px-3 pt-2.5 pb-2 text-center shadow-[0_14px_34px_rgb(0_0_0/.5)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:pt-4 sm:pb-3.5 ${on ? "bg-gray-900 ring-2 ring-amber-400" : "bg-gray-950/90 ring-1 ring-white/10 hover:bg-gray-900"}`}
									style={{ backgroundImage: `radial-gradient(ellipse 75% 60% at 50% 38%, ${hue}${on ? "72" : "42"}, transparent 78%)` }}
								>
									<EfgFan cards={faces[m.key]?.fan ?? []} size={30} spread={1.5} className="sm:hidden" />
									<EfgFan cards={faces[m.key]?.fan ?? []} size={56} spread={1.5} className="hidden sm:block" />
									<span className="mt-1.5 flex max-w-full items-center gap-1.5 text-[15px] font-bold leading-5 text-white sm:mt-3 sm:text-lg">
										<span className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5" style={{ background: hue }} />
										<span className="truncate">{m.label}</span>
									</span>
									<span className="mt-0.5 block w-full truncate text-xs leading-4 text-gray-400 sm:text-[13px]">{faces[m.key]?.examples}</span>
								</button>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}

function LamplightStage() {
	return <EfgStage k="f" vars="[--room-top:110px] sm:[--room-top:140px] lg:[--room-top:200px]" top={(f) => <Top f={f} />} />
}

export const variant: BlockVariant = { key: "f", name: "Lamplight", C: LamplightStage }
