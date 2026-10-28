// PROTOTYPE (start page lab, round 6): stage j · "Spotlight card": h with Discover's chips, and the module as a large
// elevated card over the rug with an amber halo: "Tap three you loved" (a poster fan before any choice, a dice, poster toggles that
// dim the rest from the first loved, three Loved slots), then "For you" (one featured on its backdrop, Also for you).
// The card is the intro film's hand-off target: #start-picks, and the `start-lab:try-tap-three` window event.
// Round 11: a bigger card and posters, a poster-fan empty state, and the room graded to the mood (jk-grade).
import type { BlockVariant } from "../../lab/types"
import { JkBody, JkHead, JkSlots } from "./jk-module"
import { useRef } from "react"
import { type JkFlow, JkStage, type Reg, useJkBringIntoView, useJkHandOff } from "./jk-shared"

// Round 11: a bigger card (up to 1200 px wide) with bigger posters: ~130 px on phones, 192-200 px on desktop.
const CSS = `.jkj-mod{height:306px}.jkj-head{height:68px}.jkj-col{width:130px}.jkj-slot{width:22px}
@media (min-width:640px){.jkj-mod{height:356px}.jkj-head{height:78px}.jkj-col{width:156px}.jkj-slot{width:30px}}
@media (min-width:1024px){.jkj-mod{height:420px}.jkj-head{height:90px}.jkj-col{width:192px}.jkj-slot{width:38px}}
@media (min-width:1024px) and (max-height:820px){.jkj-mod{height:378px}.jkj-head{height:82px}.jkj-col{width:168px}.jkj-slot{width:34px}}
@media (min-width:1600px) and (min-height:1000px){.jkj-mod{height:436px}.jkj-col{width:200px}}`

// Round 15: exported for stages l and m, which keep this card under their own picker.
export function SpotlightCard({ f, reg }: { f: JkFlow; reg: Reg }) {
	const box = useJkBringIntoView(f)
	const lit = f.view !== "empty"
	const pulse = useRef<HTMLSpanElement>(null)
	useJkHandOff(f, box, pulse)
	return (
		<div
			ref={box}
			id="start-picks"
			className="relative mx-auto w-full max-w-[1200px] scroll-mt-20"
		>
			<style>{CSS}</style>
			{/* The halo: amber light behind the card, a little stronger once there's something to tap. */}
			<div
				aria-hidden
				className="pointer-events-none absolute -inset-x-[10%] -inset-y-[30%] -z-10 transition-opacity duration-500"
				style={{
					opacity: lit ? 1 : 0.7,
					background:
						"radial-gradient(ellipse 50% 50% at 50% 55%, rgb(251 191 36 / .38) 0%, rgb(251 191 36 / .18) 45%, rgb(251 191 36 / .06) 68%, transparent 80%)",
				}}
			/>
			<div
				ref={reg("module")}
				className="jkj-mod pointer-events-auto relative flex flex-col overflow-hidden rounded-[22px] bg-gray-950 shadow-[0_40px_100px_rgb(0_0_0/.75),0_12px_30px_rgb(0_0_0/.5),inset_0_1px_0_rgb(255_255_255/.07)] ring-1 ring-amber-400/25 sm:rounded-[26px]"
			>
				<JkHead
					f={f}
					big
					className="jkj-head shrink-0 border-b border-white/[0.06] px-4 sm:px-6 lg:px-7"
					slots={<JkSlots f={f} w="jkj-slot" drop />}
				/>
				<div className="relative min-h-0 flex-1">
					<JkBody f={f} col="jkj-col" pad="px-4 sm:px-6 lg:px-7" />
				</div>
			</div>
			{/* The hand-off pulse: an amber ring and glow around the card, shown only while it animates. */}
			<span
				ref={pulse}
				aria-hidden
				className="pointer-events-none absolute -inset-1.5 rounded-[26px] opacity-0 ring-[3px] ring-amber-400 shadow-[0_0_0_8px_rgb(251_191_36/.16),0_0_60px_8px_rgb(251_191_36/.4)] sm:-inset-2 sm:rounded-[32px]"
			/>
		</div>
	)
}

function SpotlightStage() {
	return <JkStage k="j" placement="card" module={(f, reg) => <SpotlightCard f={f} reg={reg} />} />
}

export const variant: BlockVariant = { key: "j", name: "Spotlight card", C: SpotlightStage }
