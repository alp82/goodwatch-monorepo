// PROTOTYPE - throwaway (#662). Variant "shape" (bolder): silent after an ordinary rating. It speaks only when the
// rating changes the shape of the member's sides: a new side, a side that may be forming, or a side that moves up by
// size. Then the screen gives way to the sides drawn as piles of posters, and the rated title drops into its pile.
// A score of 5 or less brings only the #526 why row, at the bottom of the screen.
import { Link } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import { posterUrl } from "~/ui/taste/tabs/parts"
import { SideRef, WhyRow, pct, sideTitles, titlesOf } from "./bits"
import type { MomentSide, MomentView, Outcome } from "./model"

/** Whether the outcome changes the shape: what this variant speaks about. */
export function changesShape(o: Outcome | undefined) {
	if (!o) return false
	if (o.kind === "new" || o.kind === "forming") return true
	// The rank keeps the order before the rating on a tie, so a side moves up only by passing another.
	return o.kind === "joins" && (o.reshaped || o.rankAfter < o.rankBefore)
}

export function ShapeTakeover({ view, score, names, why }: { view: MomentView | null; score: number | null; names: boolean; why: boolean }) {
	const [closed, setClosed] = useState(false)
	const box = useRef<HTMLDivElement>(null)
	const o = view?.outcome
	const open = !closed && score !== null && score > 5 && changesShape(o)
	useEffect(() => {
		if (!open) return
		box.current?.focus()
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setClosed(true)
		window.addEventListener("keydown", onKey)
		const overflow = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => {
			window.removeEventListener("keydown", onKey)
			document.body.style.overflow = overflow
		}
	}, [open])
	if (score !== null && score <= 5 && why && !closed)
		return (
			<div className="fixed inset-x-0 bottom-28 z-[1050] flex justify-center px-4 lg:bottom-20">
				<div className="w-full max-w-md rounded-2xl border border-white/10 bg-stone-900 p-3 text-sm text-white shadow-2xl shadow-black/60">
					<WhyRow score={score} compact onDone={() => setClosed(true)} />
				</div>
			</div>
		)
	if (!open || !view || !o) return null
	const sides = view.after?.sides ?? []
	const me = view.titles[view.key]
	const home = o.kind === "joins" || o.kind === "new" ? o.side : null
	const headline =
		o.kind === "forming"
			? "A new side may be forming"
			: o.kind === "new" || (o.kind === "joins" && o.reshaped)
				? "Your sides changed shape"
				: o.kind === "joins" && o.rankAfter === 0
					? "This side is now your biggest"
					: "This side just moved up"
	const homeSide = sides.find((s) => s.id === home)
	return (
		<div className="fixed inset-0 z-[1200] overflow-y-auto bg-stone-950/95 pb-24 lg:pb-0" role="dialog" aria-modal="true" aria-label={headline}>
			<div className="flex min-h-full items-end justify-center md:items-center">
			<style>
				{"@keyframes protoDrop{0%{transform:translateY(-38vh) scale(2.2);opacity:0}25%{opacity:1}100%{transform:none;opacity:1}}@keyframes protoRise{from{transform:translateY(16px);opacity:0}}"}
			</style>
			<div ref={box} tabIndex={-1} className="w-full max-w-4xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 text-white outline-none md:p-8">
				<p className="animate-[protoRise_.4s_ease-out_both] text-sm font-semibold text-amber-300">
					{o.kind === "new" ? `${o.sidesBefore} sides → ${o.sidesAfter}` : o.kind === "joins" && o.reshaped ? "The sides regrouped" : "After your score"}
				</p>
				<h2 className="mt-1 animate-[protoRise_.4s_ease-out_.05s_both] text-3xl font-black leading-tight md:text-5xl">{headline}</h2>
				{homeSide && (
					<p className="mt-2 animate-[protoRise_.4s_ease-out_.1s_both] text-gray-300">
						{me?.title} {o.kind === "new" ? "starts" : "joins"} <SideRef view={view} side={homeSide} names={names} />, now {pct(homeSide.share)} of what you
						love.
					</p>
				)}
				{o.kind === "forming" && (
					<p className="mt-2 animate-[protoRise_.4s_ease-out_.1s_both] text-gray-300">
						{me?.title} and {o.with.length} other titles you love fit none of your sides, but they go together.{" "}
						{o.needs > 0 ? `${o.needs} more like them and they hold as a side.` : "They could already hold as a side."}
					</p>
				)}
				<div className="mt-8 grid items-start gap-2.5 md:gap-5" style={{ gridTemplateColumns: `repeat(${sides.length + (o.kind === "forming" ? 1 : 0)}, minmax(0, 7.5rem))` }}>
					{sides.map((s, i) => (
						<Pile key={s.id} view={view} side={s} names={names} drop={s.id === home ? me : undefined} delay={i * 0.06} />
					))}
					{o.kind === "forming" && <FormingPile view={view} keys={o.with} drop={me} />}
				</div>
				<div className="mt-8 flex flex-wrap items-center gap-3">
					<Link to="/taste" className="rounded-full bg-white px-5 py-2.5 font-bold text-black hover:bg-amber-100">
						See your sides
					</Link>
					<button type="button" onClick={() => setClosed(true)} className="cursor-pointer rounded-full px-4 py-2.5 font-semibold text-gray-300 hover:bg-white/10 hover:text-white">
						Keep going
					</button>
				</div>
			</div>
			</div>
		</div>
	)
}

// A pile: up to three of the side's posters fanned upward, the rated title dropping onto the top. Its share under it.
const STEP = 14 // px between fanned posters

function Pile({ view, side, names, drop, delay }: { view: MomentView; side: MomentSide; names: boolean; drop?: MomentView["titles"][string]; delay: number }) {
	const posters = sideTitles(view, side, 3)
	return (
		<div className="flex min-w-0 animate-[protoRise_.4s_ease-out_both] flex-col items-center" style={{ animationDelay: `${delay + 0.15}s` }}>
			<Stack posters={posters} hue={side.hue} drop={drop} dropRing={`0 0 0 3px #fff, 0 0 28px ${side.hue}`} />
			<span className="mt-3 h-1.5 w-full rounded-full" style={{ background: side.hue }} />
			<span className="mt-1.5 text-base font-black tabular-nums md:text-lg">{pct(side.share)}</span>
			{names && (
				<span className="w-full break-words text-center text-[10px] font-semibold leading-tight md:text-xs" style={{ color: side.hue }}>
					{side.name}
				</span>
			)}
		</div>
	)
}

function Stack({ posters, hue, drop, dropRing, dashed = false }: { posters: MomentView["titles"][string][]; hue: string; drop?: MomentView["titles"][string]; dropRing: string; dashed?: boolean }) {
	// The same room above every pile (a fan of three plus a dropped poster), so the piles line up.
	const above = 3 * STEP
	return (
		<div className={`relative w-full ${dashed ? "rounded-lg outline-2 outline-offset-4 outline-dashed outline-white/40" : ""}`} style={{ paddingTop: above }}>
			<div className="relative aspect-[2/3] w-full">
				{/* The first (most typical) in front, the others fanned behind it. */}
				{posters.map((t, i) => (
					<img
						key={t.key}
						src={posterUrl(t, "w185")}
						alt=""
						className={`absolute inset-0 aspect-[2/3] w-full rounded-md object-cover shadow-lg shadow-black/60 ${dashed ? "opacity-80" : ""}`}
						style={{ transform: `translateY(${-i * STEP}px) scale(${1 - i * 0.06})`, zIndex: 10 - i, boxShadow: dashed ? undefined : `0 0 0 2px ${hue}` }}
					/>
				))}
				{drop && (
					<img
						src={posterUrl(drop, "w185")}
						alt={`Poster for ${drop.title}`}
						className="absolute inset-0 z-20 aspect-[2/3] w-full animate-[protoDrop_.9s_cubic-bezier(.2,.8,.2,1)_.35s_both] rounded-md object-cover"
						style={{ boxShadow: dropRing, top: STEP }}
					/>
				)}
			</div>
		</div>
	)
}

function FormingPile({ view, keys, drop }: { view: MomentView; keys: number[]; drop?: MomentView["titles"][string] }) {
	const posters = titlesOf(view, keys).slice(0, 3)
	return (
		<div className="flex min-w-0 flex-col items-center">
			<Stack posters={posters} hue="#fff" drop={drop} dropRing="0 0 0 3px #fff" dashed />
			<span className="mt-3 h-1.5 w-full rounded-full border border-dashed border-white/50" />
			<span className="mt-1.5 text-sm font-bold text-gray-300">Forming</span>
		</div>
	)
}
