// Watch > Scores. Left: the GoodWatch score as four tall tiles (the pick and every tile above it lit in the score's
// color, each with its score word and count), and Critics vs audiences under it. Right: every source as one compact
// row on the one shared scale (60, 70, 80, 90), each in its own notation; each one set must pass.
//
// Counts show when the response has them: the GoodWatch score's always, the sources' and the gap's with `counts=scores`.
import { motion } from "framer-motion"
import {
	MIN_SCORES,
	type MinScore,
	SCORE_GAPS,
	type ScoreGap,
	type SourceKey,
} from "~/domain/filter-state"
import {
	SCORE_SOURCES,
	SCORE_STEPS,
	type ScoreSourceInfo,
	formatSourceStep,
} from "~/domain/title-scales"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-64.webp?no-inline"
import rottenLogoIcon from "~/img/rotten-logo-icon-64.webp"
import { whiteMark } from "~/ui/brand/white-mark"
import { radioKeys } from "~/ui/filter-bar/controls"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { assetUrl } from "~/utils/asset-url"
import {
	getVibeColorValue,
	goodwatchVibeIndex,
	scoreWord,
} from "~/utils/ratings"
import type { SubTabView } from "../DiscoverControls"
import { BlockHead, ClearLink, tabPad } from "./parts"
import {
	SCORE_GAP_NAMES as GAP_NAMES,
	sourceScorePatch,
	sourcesSet,
	stepLit,
} from "./watch-choices"

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
const BASE = "#111418"

const vibeHex = (score: number) =>
	getVibeColorValue(
		(goodwatchVibeIndex(score) / 10) as Parameters<typeof getVibeColorValue>[0],
	)

// ---------------------------------------------------------------------------------------------------------------
// GoodWatch score

function GoodWatchMark({ score }: { score: number }) {
	return (
		<span
			aria-hidden
			className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
			style={{
				background: score ? vibeHex(score) : "rgba(255,255,255,0.08)",
			}}
		>
			<img {...whiteMark()} alt="" className="h-[60%] w-[60%] object-contain" />
		</span>
	)
}

function ScoreTiles({ view }: { view: SubTabView }) {
	const { phone } = view
	const value = view.filters.state.minScore
	const counts = view.counts?.optionCounts.minScore
	const set = (minScore: MinScore) => view.filters.set({ minScore })
	return (
		<div
			role="radiogroup"
			aria-label="GoodWatch score"
			onKeyDown={(event) => radioKeys(event, (index) => set(MIN_SCORES[index]))}
			className="grid grid-cols-4 gap-2"
		>
			{MIN_SCORES.map((step) => {
				const on = step === value
				const lit = stepLit(step, value)
				const n = counts?.[String(step)]
				return (
					<motion.button
						key={step}
						// biome-ignore lint/a11y/useSemanticElements: an "and up" scale; the buttons carry the radio role
						type="button"
						role="radio"
						aria-checked={on}
						tabIndex={on ? 0 : -1}
						whileTap={TAP}
						onClick={() => set(step)}
						className={`flex flex-col items-start justify-between rounded-xl px-3 text-left cursor-pointer ${FOCUS} ${
							phone ? "h-[68px] py-2" : "h-[104px] py-3"
						} ${on ? "ring-2 ring-white ring-inset" : ""} ${lit || on ? "" : "bg-white/[0.05] hover:bg-white/[0.09]"}`}
						style={
							lit
								? {
										background: `color-mix(in srgb, ${vibeHex(step)} ${on ? 55 : 30}%, ${BASE})`,
									}
								: undefined
						}
					>
						<span
							className={`font-bold tabular-nums leading-none ${phone ? "text-[20px]" : "text-[28px]"} ${lit || on ? "text-white" : "text-gray-300"}`}
						>
							{step ? `${step}+` : "Any"}
						</span>
						<span className="flex w-full items-baseline justify-between gap-1">
							<span
								className={`truncate text-[12px] ${lit || on ? "text-white/85" : "text-gray-500"}`}
							>
								{step ? scoreWord(step) : phone ? "All" : "Every score"}
							</span>
							{!phone && (
								<span
									className={`text-[11px] tabular-nums ${lit || on ? "text-white/70" : "text-gray-500"}`}
								>
									{n === undefined ? "" : compactCount(n)}
								</span>
							)}
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Sources

const SOURCE_LOOK: Record<
	SourceKey,
	{
		site: "IMDb" | "Rotten Tomatoes" | "Metacritic"
		who: string
		/** The brand color, for lit steps. */
		hex: string
		/** The pick's text on the brand color. */
		ink: string
	}
> = {
	imdb: { site: "IMDb", who: "Audience", hex: "#f6c800", ink: "#000" },
	rtCritics: {
		site: "Rotten Tomatoes",
		who: "RT critics",
		hex: "#f83309",
		ink: "#fff",
	},
	rtAudience: {
		site: "Rotten Tomatoes",
		who: "RT audience",
		hex: "#fb923c",
		ink: "#fff",
	},
	metacritic: {
		site: "Metacritic",
		who: "Metacritic critics",
		hex: "#22c55e",
		ink: "#fff",
	},
	metacriticUsers: {
		site: "Metacritic",
		who: "Metacritic users",
		hex: "#facc15",
		ink: "#000",
	},
}

/** The short names the rows use; Find and the chips keep the full ones. */
const ROW_NAME: Partial<Record<SourceKey, string>> = {
	metacriticUsers: "User score",
}

const audience = (key: SourceKey) =>
	key === "rtAudience" || key === "metacriticUsers"

/** The site's logo on its brand tile, as on the title page's score chips; audience scores carry a small A. */
function SourceLogo({ source, size }: { source: SourceKey; size: number }) {
	const { site } = SOURCE_LOOK[source]
	if (site === "IMDb")
		return (
			<span
				className="grid shrink-0 place-items-center rounded-md bg-imdb"
				style={{ width: size, height: size }}
			>
				<img src={assetUrl(imdbLogo)} alt="" className="w-[78%]" />
			</span>
		)
	return (
		<span
			className={`relative grid shrink-0 place-items-center rounded-md ${site === "Metacritic" ? "bg-metacritic ring-1 ring-white/15 ring-inset" : "bg-rotten"}`}
			style={{ width: size, height: size }}
		>
			<img
				src={assetUrl(
					site === "Metacritic" ? metacriticLogoIcon : rottenLogoIcon,
				)}
				alt=""
				className="h-[62%] w-[62%] object-contain"
			/>
			{audience(source) && (
				<span className="absolute -right-1 -bottom-1 rounded bg-orange-400 px-[3px] text-[8px] leading-[11px] font-black text-gray-950">
					A
				</span>
			)}
		</span>
	)
}

function SourceRow({
	view,
	source,
}: {
	view: SubTabView
	source: ScoreSourceInfo
}) {
	const { state, set } = view.filters
	const { phone } = view
	const look = SOURCE_LOOK[source.key]
	const value = state.sourceScores?.[source.key] ?? 0
	const counts = view.counts?.optionCounts.sourceScores
	const steps = [0, ...SCORE_STEPS]
	const name = ROW_NAME[source.key] ?? source.name
	const pick = (step: number) => set(sourceScorePatch(state, source.key, step))
	return (
		<div className={`flex items-center gap-3 ${phone ? "h-11" : "h-12"}`}>
			<SourceLogo source={source.key} size={phone ? 26 : 28} />
			<span
				className={`shrink-0 leading-tight ${phone ? "w-[104px]" : "w-[124px]"}`}
			>
				<span className="block truncate text-[13px] font-semibold text-gray-100">
					{name}
				</span>
				<span className="block truncate text-[11px] text-gray-500">
					{look.who}
				</span>
			</span>
			<div
				role="radiogroup"
				aria-label={source.name}
				onKeyDown={(event) => radioKeys(event, (index) => pick(steps[index]))}
				className="grid min-w-0 flex-1 grid-cols-5 gap-1"
			>
				{steps.map((step) => {
					const on = step === value
					const lit = stepLit(step, value)
					const n = step ? counts?.[`${source.key}:${step}`] : undefined
					const label = step ? formatSourceStep(source.notation, step) : "Any"
					return (
						<button
							key={step}
							// biome-ignore lint/a11y/useSemanticElements: an "and up" scale; the buttons carry the radio role
							type="button"
							role="radio"
							aria-checked={on}
							aria-label={`${source.name} ${label}${n === undefined ? "" : `, ${n.toLocaleString("en")} titles`}`}
							tabIndex={on || (step === 0 && !steps.includes(value)) ? 0 : -1}
							onClick={() => pick(step)}
							className={`flex flex-col items-center justify-center rounded-md tabular-nums leading-none cursor-pointer ${FOCUS} ${phone ? "h-9" : "h-10"} ${on ? "font-bold" : ""} ${
								lit
									? ""
									: on
										? "bg-white font-semibold text-gray-950"
										: "bg-white/[0.05] text-gray-400 hover:bg-white/[0.1] hover:text-gray-200"
							}`}
							style={
								lit
									? {
											background: `color-mix(in srgb, ${look.hex} ${on ? 85 : 30}%, ${BASE})`,
											color: on ? look.ink : "#fff",
										}
									: undefined
							}
						>
							<span className="text-[12px]">{label}</span>
							{n !== undefined && !phone && (
								<span
									className={`mt-0.5 text-[10px] font-normal ${lit ? "opacity-70" : "text-gray-500"}`}
								>
									{compactCount(n)}
								</span>
							)}
						</button>
					)
				})}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Critics vs audiences

const CRITICS = "#f83309"
const AUDIENCES = "#f6c800"

/** Two bars: critics (red, like the Tomatometer) and audiences (yellow, like IMDb). */
function GapGlyph({ gap }: { gap: ScoreGap | "any" }) {
	const [critics, audiences] =
		gap === "critics"
			? [1, 0.45]
			: gap === "audience"
				? [0.45, 1]
				: gap === "agree"
					? [0.85, 0.85]
					: [0.6, 0.6]
	const bar = (height: number, color: string) => (
		<span
			className="w-[38%] rounded-[2px]"
			style={{
				height: `${height * 100}%`,
				background: gap === "any" ? "rgba(255,255,255,0.22)" : color,
			}}
		/>
	)
	return (
		<span
			aria-hidden
			className="flex h-5 w-5 shrink-0 items-end justify-center gap-[2px]"
		>
			{bar(critics, CRITICS)}
			{bar(audiences, AUDIENCES)}
		</span>
	)
}

function GapLegend() {
	return (
		<span className="flex items-center gap-3 text-[11px] text-gray-500">
			<span className="flex items-center gap-1">
				<span
					className="h-2 w-2 rounded-[2px]"
					style={{ background: CRITICS }}
				/>
				Critics
			</span>
			<span className="flex items-center gap-1">
				<span
					className="h-2 w-2 rounded-[2px]"
					style={{ background: AUDIENCES }}
				/>
				Audiences
			</span>
		</span>
	)
}

const GAPS: (ScoreGap | "any")[] = ["any", ...SCORE_GAPS]

function GapChoices({ view }: { view: SubTabView }) {
	const { phone } = view
	const value = view.filters.state.scoreGap
	const counts = view.counts?.optionCounts.scoreGap
	const set = (gap: ScoreGap | "any") =>
		view.filters.set({ scoreGap: gap === "any" ? undefined : gap })
	return (
		<div
			role="radiogroup"
			aria-label="Critics vs audiences"
			onKeyDown={(event) => radioKeys(event, (index) => set(GAPS[index]))}
			className={
				phone ? "grid grid-cols-2 gap-1.5" : "grid grid-cols-4 gap-1.5"
			}
		>
			{GAPS.map((gap) => {
				const on = gap === "any" ? !value : value === gap
				const n = gap === "any" ? undefined : counts?.[gap]
				return (
					<motion.button
						key={gap}
						// biome-ignore lint/a11y/useSemanticElements: one choice; the buttons carry the radio role
						type="button"
						role="radio"
						aria-checked={on}
						tabIndex={on ? 0 : -1}
						whileTap={TAP}
						onClick={() => set(gap)}
						className={`flex h-14 items-center gap-2.5 rounded-xl px-2.5 text-left cursor-pointer ${FOCUS} ${on ? "bg-white text-gray-950" : "bg-white/[0.05] text-gray-200 hover:bg-white/[0.09]"}`}
					>
						<span
							className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on ? "bg-gray-950" : "bg-black/30"}`}
						>
							<GapGlyph gap={gap} />
						</span>
						<span
							className={`min-w-0 text-[13px] leading-[1.2] ${on ? "font-semibold" : ""}`}
						>
							{gap === "any" ? "Any" : GAP_NAMES[gap]}
							{n !== undefined && !on && (
								<span className="ml-1.5 text-[11px] font-normal tabular-nums text-gray-500">
									{compactCount(n)}
								</span>
							)}
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function ScoresTab({ view }: { view: SubTabView }) {
	const { phone } = view
	const { state, set } = view.filters
	const sources = sourcesSet(state)
	const score = (
		<section aria-labelledby="discover-score-head">
			<BlockHead
				id="discover-score-head"
				icon={<GoodWatchMark score={state.minScore} />}
				note="Every source in one"
				right={
					<ClearLink
						show={state.minScore > 0}
						onClick={() => set({ minScore: 0 })}
					/>
				}
			>
				GoodWatch score
			</BlockHead>
			<ScoreTiles view={view} />
		</section>
	)
	const gap = (
		<section aria-labelledby="discover-gap-head">
			<BlockHead
				id="discover-gap-head"
				right={
					state.scoreGap ? (
						<ClearLink show onClick={() => set({ scoreGap: undefined })} />
					) : (
						<GapLegend />
					)
				}
			>
				Critics vs audiences
			</BlockHead>
			<GapChoices view={view} />
		</section>
	)
	const bySource = (
		<section aria-labelledby="discover-sources-head">
			<BlockHead
				id="discover-sources-head"
				note={sources ? `${sources} set · each must pass` : "Each must pass"}
				right={
					<ClearLink
						show={sources > 0}
						onClick={() => set({ sourceScores: undefined })}
					/>
				}
			>
				Scores by source
			</BlockHead>
			<div className="divide-y divide-white/[0.05]">
				{SCORE_SOURCES.map((source) => (
					<SourceRow key={source.key} view={view} source={source} />
				))}
			</div>
		</section>
	)
	if (phone)
		return (
			<div className={`space-y-6 ${tabPad(true)}`}>
				{score}
				{bySource}
				{gap}
			</div>
		)
	return (
		<div
			className={`grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-10 ${tabPad(false)}`}
		>
			<div className="flex min-w-0 flex-col gap-6">
				{score}
				{gap}
			</div>
			<div className="min-w-0 border-l border-white/[0.06] pl-10">
				{bySource}
			</div>
		</div>
	)
}
