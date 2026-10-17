// PROTOTYPE - throwaway. Round 11 "r11feel": "How it feels" now follows the "For you" pick (Avatar), so it needs the
// pick's own title analysis, read the same way r5feel.server.ts reads Interstellar's. Lands in IntroData.extra["r11feel"].
import type { LandingCard } from "~/server/prototype-landing.server"
import { loadPool } from "~/server/prototype-intro/pool.server"
import type { R5Hero } from "~/server/prototype-intro/r5feel.server"
import type { R10bData } from "~/server/prototype-intro/r10b.server"
import { load as loadR10b } from "~/server/prototype-intro/r10b.server"
import { adjective, isWorded } from "~/server/taste-portrait/words.server"
import { type CoreScores, computePillarScores } from "~/server/utils/fingerprint"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import { query } from "~/utils/crate"

export type R11FeelData = { pick: R5Hero | null; pickKey: number | null }

let cached: Promise<R11FeelData> | null = null

export function load(request: Request, landing: LandingCard[]): Promise<R11FeelData> {
	if (!cached) {
		cached = (async () => {
			const pool = await loadPool(request)
			const r10b: R10bData = await loadR10b(request, landing)
			const h = pool.find((c) => c.key === r10b.pick) ?? pool.find((c) => c.media_type === "movie" && c.tmdb_id === 19995)
			if (!h) return { pick: null, pickKey: null }
			const rows = await query<{ fingerprint_scores: Record<string, number> | null }>(
				`SELECT fingerprint_scores FROM ${h.media_type} WHERE tmdb_id = ?`,
				[h.tmdb_id],
			)
			const fp = rows[0]?.fingerprint_scores ?? {}
			const top = Object.entries(fp)
				.filter(([k, v]) => isWorded(k) && typeof v === "number")
				.sort((a, b) => b[1] - a[1])
				.slice(0, 8)
				.map(([key, value]) => {
					const meta = FINGERPRINT_META[key]
					return {
						key,
						label: meta?.label ?? key,
						adjective: adjective(key),
						emoji: meta?.emoji ?? "",
						color: meta?.color ?? "rgba(251,191,36,.6)",
						value,
					}
				})
			const pick: R5Hero = {
				title: h.title,
				poster_path: h.poster_path,
				backdrop_path: h.backdrop_path,
				year: h.release_year,
				score: h.goodwatch_overall_score_normalized_percent == null ? null : Math.round(h.goodwatch_overall_score_normalized_percent),
				pillars: computePillarScores(fp as CoreScores),
				top,
			}
			return { pick, pickKey: h.key }
		})()
		cached.catch(() => {
			cached = null
		})
	}
	return cached
}
