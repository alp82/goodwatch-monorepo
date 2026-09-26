// PROTOTYPE — score-area layout variants for show and movie pages, switchable with ?score= on
// the real details route. ?score=0 or no param shows the current production hero; 8 is round 2's
// "One panel"; 8a to 8f are round 3, grown from it (see round3.tsx). Throwaway: this folder lives
// only on the prototype/score-area branch and must not reach main.
import { useSearchParams } from "@remix-run/react"
import { useEffect } from "react"
import {
	Variant8aBlurPanel,
	Variant8bStackedChips,
	Variant8cRateInActions,
	Variant8dScoreColumn,
	Variant8eDividers,
	Variant8fScoreAndRate,
} from "./round3"
import type { VariantProps } from "./shared"
import { Variant8OnePanel } from "./variants"

export const SCORE_VARIANTS: { key: string; name: string; Component: ((p: VariantProps) => JSX.Element) | null }[] = [
	{ key: "0", name: "Current bar", Component: null },
	{ key: "8", name: "One panel (round 2)", Component: Variant8OnePanel },
	{ key: "8a", name: "Blur panel", Component: Variant8aBlurPanel },
	{ key: "8b", name: "Stacked chips", Component: Variant8bStackedChips },
	{ key: "8c", name: "Rate in actions", Component: Variant8cRateInActions },
	{ key: "8d", name: "Score column", Component: Variant8dScoreColumn },
	{ key: "8e", name: "Lines, side light", Component: Variant8eDividers },
	{ key: "8f", name: "Score and Rate", Component: Variant8fScoreAndRate },
]

export function useScoreVariant() {
	const [params] = useSearchParams()
	const key = params.get("score") ?? "0"
	return SCORE_VARIANTS.find((v) => v.key === key) ?? SCORE_VARIANTS[0]
}

export function ScoreAreaPrototype(props: VariantProps & { variantKey: string }) {
	const variant = SCORE_VARIANTS.find((v) => v.key === props.variantKey)
	if (!variant?.Component) return null
	const { Component, key } = variant
	const { variantKey, ...rest } = props
	return (
		<div data-score-variant={key}>
			<Component {...rest} />
		</div>
	)
}

// Floating bottom bar that cycles the variants. Hidden in production builds.
export function ScorePrototypeSwitcher() {
	const [params, setParams] = useSearchParams()
	const current = SCORE_VARIANTS.findIndex((v) => v.key === (params.get("score") ?? "0"))
	const index = current < 0 ? 0 : current
	const go = (delta: number) => {
		const next = SCORE_VARIANTS[(index + delta + SCORE_VARIANTS.length) % SCORE_VARIANTS.length]
		const p = new URLSearchParams(params)
		p.set("score", next.key)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
			if (e.key === "ArrowLeft") go(-1)
			if (e.key === "ArrowRight") go(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (import.meta.env.PROD) return null
	const v = SCORE_VARIANTS[index]
	return (
		<div data-prototype-switcher className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-fuchsia-400 bg-white px-1.5 py-1 font-mono text-sm text-black shadow-2xl shadow-black/60">
			<button type="button" onClick={() => go(-1)} aria-label="Previous variant" className="h-8 w-8 cursor-pointer rounded-full hover:bg-black/10">
				←
			</button>
			<span className="min-w-44 px-2 text-center font-semibold whitespace-nowrap">
				{v.key} — {v.name}
			</span>
			<button type="button" onClick={() => go(1)} aria-label="Next variant" className="h-8 w-8 cursor-pointer rounded-full hover:bg-black/10">
				→
			</button>
		</div>
	)
}
