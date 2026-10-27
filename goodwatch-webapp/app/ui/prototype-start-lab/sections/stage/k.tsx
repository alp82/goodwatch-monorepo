// PROTOTYPE (start page lab, round 5): stage k · "Results band": h with Discover's chips, and the results as a band
// across the full stage width at the bottom, the room above dimming once there's something to tap, posters 176 px
// wide, a lit empty state before any choice, and three header slots the loved posters fly into (transform only).
import { useCallback, useRef, useState } from "react"
import { tmdbImage } from "../../lab/kit"
import type { BlockVariant, LabCard } from "../../lab/types"
import { NEED } from "./ab-shared"
import { JkBody, JkHead, JkSlots } from "./jk-module"
import { type JkFlow, JkStage, type Reg, useJkBringIntoView } from "./jk-shared"

const CSS = `.jkk-mod{height:312px}.jkk-head{height:70px}.jkk-col{width:124px}.jkk-slot{width:28px}
@media (min-width:640px){.jkk-mod{height:358px}.jkk-head{height:76px}.jkk-col{width:152px}.jkk-slot{width:34px}}
@media (min-width:1024px){.jkk-mod{height:400px}.jkk-head{height:82px}.jkk-col{width:176px}.jkk-slot{width:42px}}
@media (min-width:1024px) and (max-height:820px){.jkk-mod{height:360px}.jkk-head{height:80px}.jkk-col{width:150px}.jkk-slot{width:38px}}`

/** A copy of the tapped poster flies from the card into its slot: one fixed image, transform only, then removed. */
function fly(src: string, from: DOMRect, to: DOMRect, done: () => void) {
	const img = document.createElement("img")
	img.src = src
	img.alt = ""
	Object.assign(img.style, {
		position: "fixed",
		left: `${from.left}px`,
		top: `${from.top}px`,
		width: `${from.width}px`,
		height: `${from.height}px`,
		objectFit: "cover",
		borderRadius: "8px",
		border: "3px solid #fbbf24",
		boxShadow: "0 14px 34px rgb(0 0 0 / .6)",
		transformOrigin: "0 0",
		willChange: "transform",
		pointerEvents: "none",
		zIndex: "80",
	})
	document.body.appendChild(img)
	const dx = to.left - from.left
	const dy = to.top - from.top
	const s = to.width / from.width
	let finished = false
	const end = () => {
		if (finished) return
		finished = true
		img.remove()
		done()
	}
	const anim = img.animate(
		[
			{ transform: "translate(0px, 0px) scale(1)" },
			{ transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 70}px) scale(${(1 + s) / 2}) rotate(-4deg)`, offset: 0.5 },
			{ transform: `translate(${dx}px, ${dy}px) scale(${s})` },
		],
		{ duration: 560, easing: "cubic-bezier(.3,.6,.25,1)" },
	)
	anim.onfinish = end
	anim.oncancel = end
	setTimeout(end, 900)
}

function ResultsBand({ f, reg }: { f: JkFlow; reg: Reg }) {
	const box = useJkBringIntoView(f)
	const slotRefs = useRef<(HTMLElement | null)[]>([])
	const [landing, setLanding] = useState<Set<number>>(() => new Set())
	const onToggle = useCallback(
		(card: LabCard, el: HTMLElement | null) => {
			const adding = !f.isLoved(card) && f.loved.length < NEED
			const target = slotRefs.current[f.loved.length]
			const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
			if (adding && el && target && !reduce) {
				setLanding((s) => new Set(s).add(card.key))
				fly(tmdbImage(card.poster_path, "w342"), el.getBoundingClientRect(), target.getBoundingClientRect(), () =>
					setLanding((s) => {
						const next = new Set(s)
						next.delete(card.key)
						return next
					}),
				)
			}
			f.toggleLoved(card)
		},
		[f],
	)
	return (
		<div className="pointer-events-auto relative w-full">
			<style>{CSS}</style>
			<div
				ref={reg("module")}
				className="relative bg-gray-950 shadow-[0_-30px_80px_rgb(0_0_0/.55),0_-1px_0_rgb(251_191_36/.28)]"
			>
				{/* A warm edge on top: amber at the middle, fading out to the sides. */}
				<span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
				<span
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 h-28"
					style={{ background: "radial-gradient(ellipse 45% 100% at 50% 0%, rgb(251 191 36 / .12), transparent 80%)" }}
				/>
				<div ref={box} className="jkk-mod relative mx-auto flex w-full max-w-[1360px] flex-col">
					<JkHead
						f={f}
						big
						className="jkk-head shrink-0 px-4 sm:px-6"
						slots={<JkSlots f={f} w="jkk-slot" slotRefs={slotRefs} landing={landing} />}
					/>
					<div className="relative min-h-0 flex-1">
						<JkBody f={f} col="jkk-col" pad="px-4 sm:px-6" onToggle={onToggle} />
					</div>
				</div>
				{/* The lab bar's space, inside the band so it runs to the bottom edge. */}
				<div aria-hidden className="h-16 sm:h-[72px]" />
			</div>
		</div>
	)
}

function BandStage() {
	return (
		<JkStage
			k="k"
			placement="band"
			over={(f) => (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out"
					style={{ background: "rgb(3 6 14 / .5)", opacity: f.view === "empty" ? 0 : 1 }}
				/>
			)}
			module={(f, reg) => <ResultsBand f={f} reg={reg} />}
		/>
	)
}

export const variant: BlockVariant = { key: "k", name: "Results band", C: BandStage }
