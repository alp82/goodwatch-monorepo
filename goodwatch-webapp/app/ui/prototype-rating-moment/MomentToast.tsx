// PROTOTYPE - throwaway (#662). Variant "toast": the score sheet closes as today, and one line comes up where the
// undo toast does. A loved title that joins a side says so with the side's posters and its new share; a side that may
// be forming says so; anything else says nothing about sides. A score of 5 or less brings the #526 why row in the
// same place instead, and it stays until answered or skipped.
import { Link } from "@remix-run/react"
import { useEffect, useState } from "react"
import { SideMark, SideRef, WhyRow, pct, sideById, titlesOf } from "./bits"
import type { MomentView } from "./model"

const SHOW_MS = 7000

export function MomentToast({ view, score, names }: { view: MomentView | null; score: number | null; names: boolean }) {
	const [gone, setGone] = useState(false)
	const o = view?.outcome
	const low = score !== null && score <= 5
	const speaks = o && (o.kind === "joins" || o.kind === "new" || o.kind === "forming")
	useEffect(() => {
		if (!speaks) return
		const timer = setTimeout(() => setGone(true), SHOW_MS)
		return () => clearTimeout(timer)
	}, [speaks])
	if (gone || score === null || (!low && !speaks)) return null
	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-28 z-[1050] flex justify-center px-4 lg:bottom-20" aria-live="polite">
			<div className="pointer-events-auto w-full max-w-md animate-[protoUp_.22s_ease-out] rounded-2xl border border-white/10 bg-stone-900 p-3 text-sm text-white shadow-2xl shadow-black/60">
				<style>{"@keyframes protoUp{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}"}</style>
				{low ? (
					<WhyRow score={score} compact onDone={() => setGone(true)} />
				) : (
					view && o && <Line view={view} names={names} />
				)}
			</div>
		</div>
	)
}

function Line({ view, names }: { view: MomentView; names: boolean }) {
	const o = view.outcome
	const after = view.after?.sides
	if (o.kind === "joins" || o.kind === "new") {
		const side = sideById(after, o.side)
		if (!side) return null
		return (
			<div className="flex items-center gap-3">
				<SideMark view={view} side={side} names={false} size="md" />
				<p className="min-w-0 flex-1 leading-snug text-gray-200">
					{o.kind === "new" ? "Starts " : "Joins "}
					<SideRef view={view} side={side} names={names} />
					{o.kind === "joins" && o.rankAfter < o.rankBefore && o.rankAfter === 0 ? ", now your biggest" : ""}.{" "}
					<span className="text-gray-400">{pct(side.share)} of what you love.</span>
				</p>
				<Link to="/taste" className="shrink-0 rounded-full bg-white/10 px-3 py-1 font-semibold hover:bg-white/20">
					Sides
				</Link>
			</div>
		)
	}
	if (o.kind === "forming") {
		const others = titlesOf(view, o.with).slice(0, 2)
		return (
			<p className="leading-snug text-gray-200">
				This, <b className="text-white">{others[0]?.title}</b> and <b className="text-white">{others[1]?.title}</b> fit none of your sides yet, but they go
				together. <span className="text-gray-400">A few more like them make a new side.</span>
			</p>
		)
	}
	return null
}
