// PROTOTYPE - throwaway (#657). Small pieces the better-sides variants share, built from the Taste page's own parts.
import type { ReactNode } from "react"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { RatedPoster, type ServicesFilter, type Titles, titlesOf } from "~/ui/taste/tabs/parts"
import type { ProtoEdge, ProtoSide } from "./model"

export const lift = (x: number) => (x >= 0 ? `+${x}` : `${x}`)

/** "53 titles you love, rated 3.3 above your usual". */
export function sideFacts(side: ProtoSide, loved: number) {
	return `${side.count} of the ${loved} titles you love, rated ${lift(side.lift)} above your usual`
}

export function AttributeChips({ side, className = "" }: { side: ProtoSide; className?: string }) {
	return (
		<div className={`flex flex-wrap items-center gap-2 ${className}`}>
			{side.attributes.map((a) => (
				<span key={a.key} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-sm">
					<span className="h-2.5 w-2.5 rounded-full" style={{ background: getFingerprintMeta(a.key).color.replace(/[\d.]+\)$/, "1)") }} />
					{a.label}
				</span>
			))}
		</div>
	)
}

/** An edge's suggestions: on the person's services first, then from everywhere, so it never looks empty. */
export function edgePicks(titles: Titles, edge: ProtoEdge, services: ServicesFilter, n: number) {
	const all = titlesOf(titles, edge.suggestions)
	if (!services.onlyMine) return all.slice(0, n)
	const mine = all.filter(services.keep)
	return [...mine, ...all.filter((t) => !mine.includes(t))].slice(0, n)
}

export function PosterRow({ keys, titles, n, showScore = true, className = "grid-cols-4" }: { keys: (number | null)[]; titles: Titles; n: number; showScore?: boolean; className?: string }) {
	const list = titlesOf(titles, keys as never).slice(0, n)
	if (!list.length) return null
	return (
		<div className={`grid gap-2 ${className}`}>
			{list.map((t) => (
				<RatedPoster key={t.key} t={t} size="w185" showScore={showScore} />
			))}
		</div>
	)
}

export function EdgeChips({ edges, current, onPick, label }: { edges: ProtoEdge[]; current: string; onPick: (id: string) => void; label: (e: ProtoEdge) => ReactNode }) {
	if (edges.length < 2) return null
	return (
		<>
			{edges.map((e) => (
				<button
					key={e.id}
					type="button"
					onClick={() => onPick(e.id)}
					aria-pressed={e.id === current}
					className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${e.id === current ? "border-sky-400 bg-sky-900/50 text-sky-100" : "border-white/20 bg-black/30 text-gray-300 hover:border-sky-400/70"}`}
				>
					{label(e)}
				</button>
			))}
		</>
	)
}
