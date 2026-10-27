// PROTOTYPE (start page lab, round 5): stage j · "Spotlight card": h with Discover's chips, and the results as a large
// elevated card over the rug (about half the stage on desktop) with an amber halo, a lit empty state before any
// choice, posters 164 px wide, and three header slots that take the loved posters (dropped in like the TV quiz's).
import type { BlockVariant } from "../../lab/types"
import { JkBody, JkHead, JkSlots } from "./jk-module"
import { type JkFlow, JkStage, type Reg, useJkBringIntoView } from "./jk-shared"

const CSS = `.jkj-mod{height:300px}.jkj-head{height:68px}.jkj-col{width:116px}.jkj-slot{width:24px}
@media (min-width:640px){.jkj-mod{height:344px}.jkj-head{height:76px}.jkj-col{width:140px}.jkj-slot{width:30px}}
@media (min-width:1024px){.jkj-mod{height:388px}.jkj-head{height:86px}.jkj-col{width:164px}.jkj-slot{width:34px}}
@media (min-width:1024px) and (max-height:820px){.jkj-mod{height:360px}.jkj-head{height:80px}.jkj-col{width:150px}}`

function SpotlightCard({ f, reg }: { f: JkFlow; reg: Reg }) {
	const box = useJkBringIntoView(f)
	const lit = f.view !== "empty"
	return (
		<div ref={box} className="relative mx-auto w-full max-w-[1180px]">
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
		</div>
	)
}

function SpotlightStage() {
	return <JkStage k="j" placement="card" module={(f, reg) => <SpotlightCard f={f} reg={reg} />} />
}

export const variant: BlockVariant = { key: "j", name: "Spotlight card", C: SpotlightStage }
