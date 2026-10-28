// PROTOTYPE - throwaway. Shared pieces of the Scores section: the GoodWatch score as the hero control, each source with
// its logo and brand color as a compact "and up" row, and Critics vs audiences with a small two-bar picture.
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import { MIN_SCORES, type MinScore, SCORE_GAPS, type ScoreGap, type SourceKey } from "~/domain/filter-state"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-64.webp?no-inline"
import rottenLogoIcon from "~/img/rotten-logo-icon-64.webp"
import { whiteMark } from "~/ui/brand/white-mark"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { assetUrl } from "~/utils/asset-url"
import { getVibeColorValue, goodwatchVibeIndex, scoreWord } from "~/utils/ratings"
import type { ProtoDiscover } from "../../../kit"

// ---------------------------------------------------------------------------------------------------------------
// GoodWatch score

export const SCORE_STEPS = MIN_SCORES as readonly MinScore[]
export const vibeHex = (v: number) => getVibeColorValue((goodwatchVibeIndex(v) / 10) as Parameters<typeof getVibeColorValue>[0])
export const scoreCount = (d: ProtoDiscover, v: number) => d.counts?.optionCounts.minScore?.[String(v)] ?? null
export const setScore = (d: ProtoDiscover, v: number) => d.filters.set({ minScore: v as MinScore })

export function GoodWatchMark({ size = 28, v }: { size?: number; v?: number }) {
	return (
		<span
			className="grid shrink-0 place-items-center rounded-lg"
			style={{ width: size, height: size, background: v ? vibeHex(v) : "rgba(255,255,255,0.08)" }}
		>
			<img {...whiteMark()} alt="" className="h-[60%] w-[60%] object-contain" />
		</span>
	)
}

/** The hero: one tall tile per step, the chosen one and everything above it lit in the score's color. */
export function ScoreHero({ d, compact = false }: { d: ProtoDiscover; compact?: boolean }) {
	const value = d.filters.state.minScore
	return (
		<div role="radiogroup" aria-label="GoodWatch score" className="grid grid-cols-4 gap-2">
			{SCORE_STEPS.map((v) => {
				const on = v === value
				const lit = value !== 0 && v >= value
				const n = scoreCount(d, v)
				return (
					<motion.button
						key={v}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: an "and up" scale; the buttons carry the radio role
						role="radio"
						aria-checked={on}
						whileTap={TAP}
						onClick={() => setScore(d, v)}
						className={`flex flex-col items-start justify-between rounded-xl px-3 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
							compact ? "h-[68px] py-2" : "h-[104px] py-3"
						} ${on ? "ring-2 ring-inset ring-white" : ""} ${lit || on ? "" : "bg-white/[0.05] hover:bg-white/[0.09]"}`}
						style={lit ? { background: `color-mix(in srgb, ${vibeHex(v)} ${on ? 55 : 30}%, #111418)` } : undefined}
					>
						<span className={`font-bold tabular-nums leading-none ${compact ? "text-[20px]" : "text-[28px]"} ${lit || on ? "text-white" : "text-gray-300"}`}>
							{v ? `${v}+` : "Any"}
						</span>
						<span className="flex w-full items-baseline justify-between gap-1">
							<span className={`text-[12px] ${lit || on ? "text-white/85" : "text-gray-500"}`}>{v ? scoreWord(v) : "Every score"}</span>
							{!on && n != null && <span className="text-[11px] tabular-nums text-gray-500">{compactCount(n)}</span>}
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Sources

export interface Source {
	key: SourceKey
	name: string
	/** Who scores it. */
	who: "Critics" | "Audience"
	site: "IMDb" | "Rotten Tomatoes" | "Metacritic"
	/** The brand color, for lit steps. */
	hex: string
	steps: number[]
	fmt: (v: number) => string
}

export const SOURCES: Source[] = [
	{ key: "imdb", name: "IMDb", who: "Audience", site: "IMDb", hex: "#f6c800", steps: [65, 75, 80], fmt: (v) => (v / 10).toFixed(1) },
	{ key: "rtCritics", name: "Tomatometer", who: "Critics", site: "Rotten Tomatoes", hex: "#f83309", steps: [60, 80, 90], fmt: (v) => `${v}%` },
	{ key: "rtAudience", name: "Popcornmeter", who: "Audience", site: "Rotten Tomatoes", hex: "#fb923c", steps: [70, 85, 90], fmt: (v) => `${v}%` },
	{ key: "metacritic", name: "Metascore", who: "Critics", site: "Metacritic", hex: "#22c55e", steps: [60, 75, 81], fmt: (v) => String(v) },
]

export const sourceValue = (d: ProtoDiscover, k: SourceKey) => d.filters.state.sourceScores?.[k] ?? 0
export const sourceCount = (d: ProtoDiscover, k: SourceKey, v: number) => d.counts?.optionCounts.sourceScores?.[`${k}:${v}`] ?? null
export function setSource(d: ProtoDiscover, k: SourceKey, v: number) {
	const next = { ...(d.filters.state.sourceScores ?? {}) }
	if (v) next[k] = v
	else delete next[k]
	d.filters.set({ sourceScores: Object.keys(next).length ? next : undefined })
}
export const sourcesSet = (d: ProtoDiscover) => Object.keys(d.filters.state.sourceScores ?? {}).length

/** The site's logo on its brand tile, as on the title page's score chips. */
export function SourceLogo({ s, size = 28 }: { s: Source; size?: number }) {
	if (s.site === "IMDb")
		return (
			<span className="grid shrink-0 place-items-center rounded-md bg-imdb" style={{ width: size, height: size }}>
				<img src={assetUrl(imdbLogo)} alt="IMDb" className="w-[78%]" />
			</span>
		)
	const logo = s.site === "Metacritic" ? metacriticLogoIcon : rottenLogoIcon
	return (
		<span
			className={`relative grid shrink-0 place-items-center rounded-md ${s.site === "Metacritic" ? "bg-metacritic ring-1 ring-inset ring-white/15" : "bg-rotten"}`}
			style={{ width: size, height: size }}
		>
			<img src={assetUrl(logo)} alt={s.site} className="h-[62%] w-[62%] object-contain" />
			{s.key === "rtAudience" && (
				<span className="absolute -right-1 -bottom-1 rounded bg-orange-400 px-[3px] text-[8px] font-black leading-[11px] text-gray-950">A</span>
			)}
		</span>
	)
}

/** One source as one line: logo, name, and small "and up" steps lit in the brand color. */
export function SourceRow({ d, s, dense = false }: { d: ProtoDiscover; s: Source; dense?: boolean }) {
	const value = sourceValue(d, s.key)
	return (
		<div className={`flex items-center gap-3 ${dense ? "h-10" : "h-11"}`}>
			<SourceLogo s={s} size={dense ? 26 : 28} />
			<span className="w-[118px] shrink-0 leading-tight">
				<span className="block text-[13px] font-semibold text-gray-100">{s.name}</span>
				<span className="block text-[11px] text-gray-500">
					{s.site === "IMDb" ? "Audience" : `${s.site === "Rotten Tomatoes" ? "RT" : s.site} ${s.who.toLowerCase()}`}
				</span>
			</span>
			<SourceSteps d={d} s={s} value={value} />
		</div>
	)
}

export function SourceSteps({ d, s, value }: { d: ProtoDiscover; s: Source; value: number }) {
	return (
		<div role="radiogroup" aria-label={s.name} className="grid min-w-0 flex-1 grid-cols-4 gap-1">
			{[0, ...s.steps].map((v) => {
				const on = v === value
				const lit = value !== 0 && v >= value
				const n = sourceCount(d, s.key, v)
				return (
					<button
						key={v}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: an "and up" scale; the buttons carry the radio role
						role="radio"
						aria-checked={on}
						title={v && n != null ? `${compactCount(n)} titles` : undefined}
						onClick={() => setSource(d, s.key, v)}
						className={`h-7 rounded-md text-[12px] tabular-nums cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
							on ? "font-bold" : ""
						} ${lit ? "" : on ? "bg-white font-semibold text-gray-950" : "bg-white/[0.05] text-gray-400 hover:bg-white/[0.1] hover:text-gray-200"}`}
						style={
							lit
								? {
										background: `color-mix(in srgb, ${s.hex} ${on ? 85 : 30}%, #111418)`,
										color: on && s.key === "imdb" ? "#000" : "#fff",
									}
								: undefined
						}
					>
						{v ? `${s.fmt(v)}+` : "Any"}
					</button>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Critics vs audiences

export const GAP_WORDS: Record<ScoreGap, { label: string; short: string }> = {
	agree: { label: "Both agree", short: "Agree" },
	critics: { label: "Critics liked it more", short: "Critics' pick" },
	audience: { label: "Audiences liked it more", short: "Crowd pleaser" },
}
export const GAPS = SCORE_GAPS
export const gapCount = (d: ProtoDiscover, g: ScoreGap) => d.counts?.optionCounts.scoreGap?.[g] ?? null
export const setGap = (d: ProtoDiscover, g: ScoreGap | undefined) =>
	d.filters.set({ scoreGap: g && d.filters.state.scoreGap !== g ? g : undefined })

const CRITIC = "#f83309"
const CROWD = "#f6c800"

/** Two bars: critics (red, like the Tomatometer) and audiences (yellow, like IMDb). */
export function GapGlyph({ gap, size = 22, dim = false }: { gap: ScoreGap | "any"; size?: number; dim?: boolean }) {
	const [c, a] = gap === "critics" ? [1, 0.45] : gap === "audience" ? [0.45, 1] : gap === "agree" ? [0.85, 0.85] : [0.6, 0.6]
	const bar = (h: number, color: string) => (
		<span
			className="w-[38%] rounded-[2px]"
			style={{ height: `${h * 100}%`, background: gap === "any" || dim ? "rgba(255,255,255,0.22)" : color }}
		/>
	)
	return (
		<span aria-hidden className="flex shrink-0 items-end justify-center gap-[2px]" style={{ width: size, height: size }}>
			{bar(c, CRITIC)}
			{bar(a, CROWD)}
		</span>
	)
}

export function GapLegend() {
	return (
		<span className="flex items-center gap-3 text-[11px] text-gray-500">
			<span className="flex items-center gap-1">
				<span className="h-2 w-2 rounded-[2px]" style={{ background: CRITIC }} />
				Critics
			</span>
			<span className="flex items-center gap-1">
				<span className="h-2 w-2 rounded-[2px]" style={{ background: CROWD }} />
				Audiences
			</span>
		</span>
	)
}

/** The three choices plus Any as small tiles, each with its picture. */
export function GapChoices({ d, layout = "row" }: { d: ProtoDiscover; layout?: "row" | "col" | "grid" }) {
	const value = d.filters.state.scoreGap
	const opts: (ScoreGap | "any")[] = ["any", ...GAPS]
	return (
		<div role="radiogroup" aria-label="Critics vs audiences" className={layout === "row" ? "grid grid-cols-4 gap-1.5" : layout === "grid" ? "grid grid-cols-2 gap-1.5" : "grid gap-1.5"}>
			{opts.map((g) => {
				const on = g === "any" ? !value : value === g
				const n = g === "any" ? null : gapCount(d, g)
				return (
					<motion.button
						key={g}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a single choice; the buttons carry the radio role
						role="radio"
						aria-checked={on}
						whileTap={TAP}
						onClick={() => setGap(d, g === "any" ? undefined : g)}
						className={`flex items-center gap-2.5 rounded-xl px-2.5 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
							layout === "row" ? "h-14" : layout === "grid" ? "h-12" : "h-11"
						} ${on ? "bg-white text-gray-950" : "bg-white/[0.05] text-gray-200 hover:bg-white/[0.09]"}`}
					>
						<span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on ? "bg-gray-950" : "bg-black/30"}`}>
							<GapGlyph gap={g} size={20} />
						</span>
						<span className={`min-w-0 text-[13px] leading-[1.2] ${on ? "font-semibold" : ""}`}>
							{g === "any" ? "Any" : GAP_WORDS[g].label}
							{n != null && !on && <span className="ml-1.5 text-[11px] font-normal tabular-nums text-gray-500">{compactCount(n)}</span>}
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function Head({ children, icon, right, note }: { children: ReactNode; icon?: ReactNode; right?: ReactNode; note?: ReactNode }) {
	return (
		<div className="mb-2.5 flex min-h-7 items-center gap-2">
			{icon}
			<h4 className="text-[14px] font-semibold text-gray-100">{children}</h4>
			{note && <span className="text-[12px] text-gray-500">{note}</span>}
			{right && <span className="ml-auto">{right}</span>}
		</div>
	)
}

export function ClearButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			Clear
		</button>
	)
}
