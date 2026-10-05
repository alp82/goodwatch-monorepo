// PROTOTYPE - throwaway. Per-title drawing arrays for the Space canvas, derived from Explorer state.
import { useMemo } from "react"
import type { Score } from "~/server/scores.server"
import { getVibeColorValue } from "~/utils/ratings"
import type { Explorer } from "./useExplorer"

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)
const hex = (h: string) => [Number.parseInt(h.slice(1, 3), 16), Number.parseInt(h.slice(3, 5), 16), Number.parseInt(h.slice(5, 7), 16)]
const ramp = (stops: string[], t: number) => {
	const c = stops.map(hex)
	const x = Math.max(0, Math.min(0.999, t)) * (c.length - 1)
	const k = Math.floor(x)
	const f = x - k
	return `rgb(${lerp(c[k][0], c[k + 1][0], f)},${lerp(c[k][1], c[k + 1][1], f)},${lerp(c[k][2], c[k + 1][2], f)})`
}
/** Far from you is warm grey, close to you is gold. */
export const heat = (match: number) => ramp(["#3f3a36", "#78716c", "#d6b36a", "#fbbf24"], (match - 50) / 49)
export const starColor = (match: number) => ramp(["#475569", "#94a3b8", "#fef3c7", "#fde68a"], (match - 50) / 49)

export type PaintOpts = {
	featured?: number // how many top matches draw large enough to read as posters when zoomed out
	featuredSize?: number
	glowTop?: number
	colors?: "heat" | "stars"
	extraAlpha?: number // the person's own titles outside the pool
}

export function usePaint(ex: Explorer, o: PaintOpts = {}) {
	const { featured = 24, featuredSize = 2.2, glowTop = 8, colors = "heat", extraAlpha = 0.9 } = o
	return useMemo(() => {
		const n = ex.items.length
		const alpha = new Float32Array(n)
		const size = new Float32Array(n).fill(1)
		const glow = new Uint8Array(n)
		const gray = new Uint8Array(n)
		const ring: (string | null)[] = new Array(n).fill(null)
		const dot: string[] = new Array(n)
		const hide = ex.filterMode === "hide"
		for (let i = 0; i < n; i++) {
			const it = ex.items[i]
			const s = ex.signals[it.key]
			const passing = ex.pass[i] === 1
			const own = s?.kind === "score"
			alpha[i] = passing ? 1 : own ? (hide ? 0 : 0.5) : hide ? 0 : 0.16
			if (ex.pool.extra.has(it.key)) alpha[i] = hide && ex.notSeen ? 0 : extraAlpha * (passing ? 1 : 0.5)
			if (!passing) gray[i] = 1
			dot[i] = colors === "stars" ? starColor(ex.match[i]) : heat(ex.match[i])
			if (own) ring[i] = getVibeColorValue(s.score as Score)
			else if (s?.kind === "want") ring[i] = "#f59e0b"
			if (ex.queue.includes(it.key)) ring[i] = "#38bdf8"
		}
		ex.ranked.slice(0, featured).forEach((i, r) => {
			size[i] = featuredSize - (r / featured) * (featuredSize - 1) * 0.4
			if (r < glowTop) glow[i] = 1
		})
		// Best on top.
		const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => alpha[a] - alpha[b] || size[a] - size[b] || ex.sims[a] - ex.sims[b])
		return { alpha, size, glow, gray, ring, dot, order }
	}, [ex.items, ex.signals, ex.pass, ex.match, ex.ranked, ex.queue, ex.filterMode, ex.sims, featured, featuredSize, glowTop, colors, extraAlpha, ex.notSeen, ex.pool.extra])
}
