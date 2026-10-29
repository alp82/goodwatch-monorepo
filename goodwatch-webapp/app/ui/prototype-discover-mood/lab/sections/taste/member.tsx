// PROTOTYPE - throwaway. Your taste, round 7: what the member view needs (simulated ratings, a Taste match scale with
// plausible counts) and the steer wells: picked titles as removable filter chips in a tinted well, so a thumb here
// reads as "steer this list" and not as a rating saved to the profile. Round 9: an empty well shows a few titles to
// tap in (quiet chips), never empty slots.
import { HandThumbDownIcon, HandThumbUpIcon, StarIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { MIN_MATCHES, type MinMatch } from "~/domain/filter-state"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { useTitleNames } from "~/ui/filter-bar/useFilterData"
import { type TitleKey, titleKey } from "~/utils/title-key"
import type { ProtoDiscover } from "../../../kit"
import { type Steer, type SteerApi, SteerButtons, type SteerTitle, Thumb } from "./parts"

// ---------------------------------------------------------------------------------------------------------------
// A simulated member: a few scored titles (ids checked against /api/similar-media 2026-10-28)

const RATED: { key: TitleKey; score: number }[] = [
	{ key: titleKey("show", 95396), score: 10 }, // Severance
	{ key: titleKey("movie", 129), score: 10 }, // Spirited Away
	{ key: titleKey("movie", 329865), score: 9 }, // Arrival
	{ key: titleKey("show", 136315), score: 9 }, // The Bear
	{ key: titleKey("movie", 666277), score: 9 }, // Past Lives
	{ key: titleKey("movie", 496243), score: 8 }, // Parasite
	{ key: titleKey("movie", 385687), score: 4 }, // Fast X
	{ key: titleKey("show", 100757), score: 4 }, // Outer Banks
	{ key: titleKey("movie", 91314), score: 3 }, // Transformers: Age of Extinction
]
export const MEMBER_RATINGS = 214

export interface RatedTitle extends SteerTitle {
	score: number
}

/** The member's scored titles, best first. */
export function useRated(): RatedTitle[] {
	const names = useTitleNames(
		RATED.map((r) => r.key),
		"",
	)
	return RATED.flatMap((r) => {
		const n = names.byKey.get(r.key)
		return n ? [{ key: r.key, title: n.title, year: String(n.year ?? ""), poster: n.poster, score: r.score }] : []
	})
}

export function ScoreBadge({ score }: { score: number }) {
	return (
		<span
			className={`inline-flex h-5 shrink-0 items-center gap-0.5 rounded px-1.5 text-[11px] font-bold tabular-nums ${
				score >= 7 ? "bg-white/[0.08] text-gray-100" : "bg-white/[0.05] text-gray-400"
			}`}
		>
			<StarIcon className="h-3 w-3 text-amber-400/80" aria-hidden />
			{score}
		</span>
	)
}

/** A rated title: poster, name, the member's score (kept), and the steer thumbs (this list only). */
export function RatedRow({ steer, t }: { steer: SteerApi; t: RatedTitle }) {
	return (
		<div className="flex h-[58px] min-w-0 items-center gap-3 rounded-xl px-2 hover:bg-white/[0.04]">
			<Thumb t={t} />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-[14px] font-semibold text-gray-100">{t.title}</span>
				<span className="mt-0.5 flex items-center gap-2 text-[12px] text-gray-500">
					<ScoreBadge score={t.score} />
					{t.year}
				</span>
			</span>
			<SteerButtons steer={steer} t={t} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Taste match for a member

const STEPS = MIN_MATCHES as readonly MinMatch[]
const SHARE: Record<number, number> = { 0: 1, 70: 0.46, 80: 0.21, 90: 0.06 }

/** The "and up" scale. Counts come from the live counts when present, else a plausible share of the list. */
export function MemberMatch({ d, compact = false }: { d: ProtoDiscover; compact?: boolean }) {
	const value = d.filters.state.minMatch
	const total = d.total ?? 0
	return (
		<div role="radiogroup" aria-label="Taste match" className="grid grid-cols-4 gap-1.5">
			{STEPS.map((v, i) => {
				const on = v === value
				const lit = value !== 0 && v >= value
				const n = d.counts?.optionCounts.minMatch?.[String(v)] ?? (total ? Math.round(total * (SHARE[v] ?? 1)) : null)
				return (
					<motion.button
						key={v}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: an "and up" scale; the buttons carry the radio role
						role="radio"
						aria-checked={on}
						whileTap={TAP}
						onClick={() => d.filters.set({ minMatch: v })}
						className={`relative flex flex-col items-start justify-between overflow-hidden rounded-xl px-3 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${compact ? "h-14 py-2" : "h-[76px] py-2.5"} ${
							on ? "ring-2 ring-inset ring-amber-200" : ""
						} ${lit ? (on ? "bg-amber-500/55" : "bg-amber-500/25") : on ? "bg-white/[0.1]" : "bg-white/[0.05] hover:bg-white/[0.09]"}`}
					>
						<span className={`font-bold tabular-nums leading-none ${compact ? "text-[16px]" : "text-[22px]"} ${lit || on ? "text-white" : "text-gray-300"}`}>
							{v ? `${v}%+` : "Any"}
						</span>
						{n != null && <span className={`text-[11px] tabular-nums ${lit || on ? "text-amber-50/80" : "text-gray-500"}`}>{compactCount(n)}</span>}
						<span
							aria-hidden
							className="absolute right-0 bottom-0 left-0 h-1 bg-amber-400"
							style={{ opacity: v === 0 ? 0 : 0.15 + (0.6 * i) / 3 }}
						/>
					</motion.button>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Steer wells: picked titles as filter chips

const TONE: Record<Steer, { chip: string; x: string; icon: string; well: string }> = {
	loved: {
		chip: "bg-emerald-500/[0.12] ring-emerald-400/45",
		x: "text-emerald-200/70 hover:text-white",
		icon: "bg-emerald-500 text-white",
		well: "bg-emerald-500/[0.04] ring-emerald-400/20",
	},
	disliked: {
		chip: "bg-rose-500/[0.12] ring-rose-400/45",
		x: "text-rose-200/70 hover:text-white",
		icon: "bg-rose-500 text-white",
		well: "bg-rose-500/[0.04] ring-rose-400/20",
	},
}

export function SteerChip({ steer, group, k }: { steer: SteerApi; group: Steer; k: TitleKey }) {
	const t = steer.known(k)
	const tone = TONE[group]
	return (
		<motion.span
			layout="position"
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.9 }}
			className={`inline-flex h-9 max-w-[220px] shrink-0 items-center rounded-full pl-1 text-[13px] font-semibold text-white ring-1 ring-inset ${tone.chip}`}
		>
			<Thumb t={t} className="h-7 w-[19px] rounded-[5px]" />
			<span className="truncate pl-2">{t?.title ?? "…"}</span>
			<button
				type="button"
				onClick={() => t && steer.set(t, null)}
				aria-label={`Remove ${t?.title ?? ""}`}
				className={`grid h-full w-8 shrink-0 place-items-center rounded-r-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${tone.x}`}
			>
				<XMarkIcon className="h-3.5 w-3.5" aria-hidden />
			</button>
		</motion.span>
	)
}

/** One side as a well of chips. Empty: up to `slots` of `suggest` as quiet chips, one tap puts a title in. */
export function SteerWell({
	steer,
	group,
	slots = 3,
	onClear,
	suggest = [],
}: { steer: SteerApi; group: Steer; slots?: number; onClear?: () => void; suggest?: SteerTitle[] }) {
	const keys = group === "loved" ? steer.loved : steer.disliked
	const tone = TONE[group]
	const Icon = group === "loved" ? HandThumbUpIcon : HandThumbDownIcon
	const free = keys.length ? [] : suggest.filter((t) => !steer.stateOf(t.key)).slice(0, slots)
	return (
		<div className={`rounded-2xl p-2.5 ring-1 ring-inset ${tone.well}`}>
			<div className="mb-2 flex h-6 items-center gap-2 px-0.5">
				<span className={`grid h-6 w-6 place-items-center rounded-full ${tone.icon}`}>
					<Icon className="h-3.5 w-3.5" aria-hidden />
				</span>
				<span className="text-[13px] font-semibold text-gray-100">{group === "loved" ? "More like" : "Less like"}</span>
				{keys.length > 0 && onClear && (
					<button
						type="button"
						onClick={onClear}
						className="ml-auto rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
			</div>
			<div className="flex min-h-9 max-h-[84px] flex-wrap gap-1.5 overflow-hidden">
				<AnimatePresence initial={false}>
					{keys.map((k) => (
						<SteerChip key={k} steer={steer} group={group} k={k} />
					))}
				</AnimatePresence>
				{free.map((t) => (
					<GhostChip key={t.key} t={t} group={group} onClick={() => steer.set(t, group)} />
				))}
			</div>
		</div>
	)
}

/** A title this side could take: quiet chip, the side's thumb, tap to put it in. */
export function GhostChip({ t, group, onClick }: { t: SteerTitle; group: Steer; onClick: () => void }) {
	const Icon = group === "loved" ? HandThumbUpIcon : HandThumbDownIcon
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			title={`${group === "loved" ? "More like" : "Less like"} ${t.title}`}
			className="inline-flex h-9 max-w-[200px] shrink-0 items-center gap-1.5 rounded-full bg-white/[0.03] pr-3 pl-1 text-[13px] text-gray-400 ring-1 ring-inset ring-white/[0.07] cursor-pointer outline-none transition-colors hover:bg-white/[0.08] hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<Thumb t={t} className="h-7 w-[19px] rounded-[5px] opacity-80" />
			<Icon className={`h-3.5 w-3.5 shrink-0 ${group === "loved" ? "text-emerald-300/70" : "text-rose-300/70"}`} aria-hidden />
			<span className="truncate">{t.title}</span>
		</motion.button>
	)
}
