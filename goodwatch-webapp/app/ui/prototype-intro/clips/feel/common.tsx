// PROTOTYPE - throwaway. Shared pieces of the "feel" clips.
import { type CSSProperties, type ReactNode, useLayoutEffect, useEffect, useRef, useState } from "react"
import type { FeelData } from "~/server/prototype-intro/feel.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { IntroData } from "../../clip"

export const feelOf = (data: IntroData) => (data.extra.feel ?? null) as FeelData | null

/** A delay (and other vars) for a moving part. */
export const at = (ms: number, more: Record<string, string | number> = {}) => ({ "--d": `${ms}ms`, ...more }) as CSSProperties

export const img = (path: string | null | undefined, size: string) => (path ? tmdbImageUrl(path, size) : "")

/** "Situationally funny" for a fingerprint adjective, with "-focused" words read as their subject. */
export const word = (adjective: string) => {
	const w = adjective.replace(/-focused$/, "")
	return w.charAt(0).toUpperCase() + w.slice(1)
}

/** The details page's pillar colors. */
export const PILLAR_HEX: Record<string, string> = {
	Energy: "#f59e0b",
	Heart: "#f43f5e",
	Humor: "#14b8a6",
	World: "#10b981",
	Craft: "#8b5cf6",
	Style: "#0ea5e9",
}
export const PILLAR_EMOJI: Record<string, string> = { Energy: "⚡", Heart: "❤️", Humor: "🎭", World: "🌍", Craft: "🛠️", Style: "🎨" }
export const TIER_WORD = ["None", "Low", "Medium", "High", "Very high"]

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

/** The stage's width in px, for parts sized in px (the score ring). Server: the desktop TV's. */
export function useStageWidth() {
	const ref = useRef<HTMLDivElement>(null)
	const [w, setW] = useState(1080)
	useIso(() => {
		const stage = ref.current?.closest(".lpi-stage") ?? ref.current?.parentElement
		if (!stage) return
		const measure = () => setW(stage.getBoundingClientRect().width || 1080)
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(stage)
		return () => ro.disconnect()
	}, [])
	return [ref, w] as const
}

/** The app's GoodWatch score ring, sized to the stage. */
export function Ring({ percent, size }: { percent: number | null; size: number }) {
	return <ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: percent } } as never} size={Math.round(size)} />
}

export function Root({ children, rootRef }: { children: ReactNode; rootRef?: React.Ref<HTMLDivElement> }) {
	return (
		<div ref={rootRef} className="lpc-fe">
			{children}
		</div>
	)
}

export const NoData = () => (
	<div className="lpc-fe">
		<div className="absolute inset-0 flex items-center justify-center text-[2.4cqw] text-white/50">No title analysis data loaded.</div>
	</div>
)
