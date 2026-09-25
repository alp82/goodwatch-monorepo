// PROTOTYPE — score-area redesign variants for show and movie pages, switchable with ?score=1..6
// on the real details route. ?score=0 or no param shows the current bar. Throwaway: this folder
// lives only on the prototype/score-area branch and must not reach main.
import { useSearchParams } from "@remix-run/react"
import { useEffect } from "react"
import { PrototypeFonts, type VariantProps } from "./shared"
import Variant1Byline from "./Variant1Byline"
import Variant2Consensus from "./Variant2Consensus"
import Variant3Synthesis from "./Variant3Synthesis"
import Variant4Dials from "./Variant4Dials"
import Variant5Glass from "./Variant5Glass"
import Variant6YourTurn from "./Variant6YourTurn"

export const SCORE_VARIANTS: { key: string; name: string; Component: ((p: VariantProps) => JSX.Element) | null }[] = [
	{ key: "0", name: "Current bar", Component: null },
	{ key: "1", name: "Byline", Component: Variant1Byline },
	{ key: "2", name: "Consensus strip", Component: Variant2Consensus },
	{ key: "3", name: "Synthesis", Component: Variant3Synthesis },
	{ key: "4", name: "Dials", Component: Variant4Dials },
	{ key: "5", name: "Glass card", Component: Variant5Glass },
	{ key: "6", name: "Your turn", Component: Variant6YourTurn },
]

export function useScoreVariant() {
	const [params] = useSearchParams()
	const key = params.get("score") ?? "0"
	return SCORE_VARIANTS.find((v) => v.key === key) ?? SCORE_VARIANTS[0]
}

export function ScoreAreaPrototype(props: VariantProps & { variantKey: string }) {
	const variant = SCORE_VARIANTS.find((v) => v.key === props.variantKey)
	if (!variant?.Component) return null
	const { Component } = variant
	return (
		<>
			<PrototypeFonts />
			<Component media={props.media} hasEpisodeGrid={props.hasEpisodeGrid} />
		</>
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
