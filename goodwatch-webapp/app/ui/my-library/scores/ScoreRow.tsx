// A row of Your scores: the tick box with the title as its label, the columns, the ten keys in the score control
// strip's colors, and the arrow that opens the row in place (synopsis, facts, the GoodWatch ring and the real score
// control). On a phone the score is one key in its color, and it opens the row too.
import { CheckIcon, ChevronDownIcon, MinusIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { memo } from "react"
import { type ScoredTitle, gapOf, versusOf } from "~/domain/my-scores"
import type { ScoredTitleDetails } from "~/server/my-scores.server"
import type { Score } from "~/server/scores.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { Poster } from "~/ui/my-pages/bits"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { titleToDashed } from "~/utils/helpers"
import { canonicalMediaTitle, mediaFieldLanguage } from "~/utils/media-presentation"
import { getVibeColorValue, goodwatchVibeIndex, scoreLabels } from "~/utils/ratings"
import { VERSUS_LABEL } from "./ScoreFilters"

export const titleHref = (t: ScoredTitle) => `/${t.mediaType}/${t.tmdbId}-${titleToDashed(canonicalMediaTitle(t))}`
const day = (iso: string | null) =>
	iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : null

/** The site's tick box (the episode list's), in brand amber, drawn inside a larger press target. */
export function TickBox({ on, mixed = false }: { on: boolean; mixed?: boolean }) {
	return (
		<span
			aria-hidden
			className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] ${
				on || mixed
					? "bg-amber-400 text-black"
					: "border-2 border-white/40 text-transparent group-hover:border-amber-400 group-hover:text-amber-400/60"
			}`}
		>
			{mixed && !on ? <MinusIcon className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
/** The hint on the chosen key where pressing it again clears the score. */
export const CLEAR_SCORE = "Clear score"

/**
 * The ten keys in the score control strip's colors: the score in its full color with a white ring, a dot under
 * GoodWatch's score. Hovering a key draws a subtle border; its number keeps its color.
 *
 * Deliberately not the shared word and number control (ui/scoring/ScoreChoices) the rest of the site uses: owner
 * decision, October 18, 2026. Your scores is for rescoring many titles in a row and is aimed at power users, so each
 * row and the selection bar keep one compact strip of exact scores, one press per change. The opened row keeps the
 * shared control. Don't swap this for ScoreChoices when the site's scoring changes again.
 */
export function ScoreKeys({
	score,
	gw,
	onPick,
	onClear,
	disabled = false,
	label,
}: {
	/** Null: none is lit (setting many titles at once). */
	score: number | null
	/** GoodWatch's score on the 1-10 scale: a dot under that key. */
	gw: number | null
	onPick: (n: number) => void
	/**
	 * Set where a score can be taken back (Quick list): pressing the chosen key again clears it, and its hint says so.
	 * Without it the chosen key gives the same score again (Your scores keeps every title scored).
	 */
	onClear?: () => void
	/** The keys don't take presses (a guest at the rating limit). */
	disabled?: boolean
	label: string
}) {
	return (
		<fieldset className="grid grid-cols-10 gap-1" disabled={disabled}>
			<legend className="sr-only">{label}</legend>
			{SCORES.map((n) => {
				const picked = score === n
				const clears = picked && onClear != null
				return (
					<button
						key={n}
						type="button"
						aria-pressed={score === null ? undefined : picked}
						aria-label={clears ? `${CLEAR_SCORE} (${n}, ${scoreLabels[n]})` : `${n}, ${scoreLabels[n]}`}
						title={clears ? CLEAR_SCORE : `${n} · ${scoreLabels[n]}`}
						onClick={() => (clears ? onClear() : onPick(n))}
						data-give={n}
						className={`relative flex h-7 cursor-pointer items-center justify-center rounded-md text-xs font-black tabular-nums transition focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${picked ? "scale-110 text-gray-950 ring-2 ring-white" : "text-white/75 hover:ring-1 hover:ring-white/40 disabled:hover:ring-0"}`}
						style={{ background: `${getVibeColorValue(n as Score)}${picked ? "" : "44"}` }}
					>
						{n}
						{gw === n && !picked && <span aria-hidden className="absolute -bottom-1 h-1 w-1 rounded-full bg-white/80" />}
					</button>
				)
			})}
		</fieldset>
	)
}

const gwOnTen = (t: ScoredTitle) => (t.gw == null ? null : Math.max(1, Math.round(t.gw / 10)))

function Opened({ t, score, onRate }: { t: ScoredTitle; score: number; onRate: (n: number) => void }) {
	const { data, isError } = useQuery({
		queryKey: ["my-scores-title", t.key],
		queryFn: async () => {
			const response = await fetch(`/api/my-scores/title?key=${t.key}`)
			if (!response.ok) throw new Error(`Title answered ${response.status}`)
			return (await response.json()) as ScoredTitleDetails | null
		},
		staleTime: Number.POSITIVE_INFINITY,
	})
	const versus = versusOf(t, score)
	return (
		<div className="grid gap-4 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5 md:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,26rem)] lg:p-4" data-opened={t.key}>
			<Link to={titleHref(t)} prefetch="intent" className="hidden w-28 shrink-0 md:block" tabIndex={-1} aria-hidden>
				<Poster path={t.poster_path} className="aspect-[2/3] w-full rounded-lg" />
			</Link>
			<div className="flex min-w-0 flex-col gap-2">
				{data?.tagline && <p className="text-sm italic text-gray-300">{data.tagline}</p>}
				<p className="line-clamp-4 text-sm text-gray-400">
					{isError ? "The synopsis couldn't load." : data === undefined ? "Loading…" : (data?.synopsis ?? "No synopsis yet.")}
				</p>
				{t.genres.length > 0 && (
					<ul className="flex flex-wrap gap-1.5" aria-label="Genres">
						{t.genres.map((g) => (
							<li key={g} className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs text-gray-300 ring-1 ring-white/10">
								{g}
							</li>
						))}
					</ul>
				)}
				<dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
					<dt className="text-gray-500">Rated</dt>
					<dd className="text-gray-300">{day(t.ratedAt) ?? "Date unknown"}</dd>
					<dt className="text-gray-500">Last watched</dt>
					<dd className="text-gray-300">{day(t.watchedAt) ?? "No date"}</dd>
					{versus && (
						<>
							<dt className="text-gray-500">Against GoodWatch</dt>
							<dd className="text-gray-300">{VERSUS_LABEL[versus]}</dd>
						</>
					)}
				</dl>
				<Link
					to={titleHref(t)}
					prefetch="intent"
					className="mt-1 self-start text-sm font-bold text-amber-300 underline decoration-amber-300/30 underline-offset-4 hover:text-amber-200"
				>
					Open the title page
				</Link>
			</div>
			<div className="flex flex-col gap-3 md:col-span-2 lg:col-span-1">
				<ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: t.gw } }} size={48} />
				<ScoreControl value={score as Score} onRate={onRate} fit="box" />
			</div>
		</div>
	)
}

export const ScoreRow = memo(function ScoreRow({
	t,
	score,
	changedFrom,
	checked,
	open,
	span,
	onCheck,
	onOpen,
	onPick,
}: {
	t: ScoredTitle
	score: number
	/** The score the title had when the page opened, when it changed since. */
	changedFrom: number | null
	checked: boolean
	open: boolean
	/** Columns shown at this width: the opened part spans them all. */
	span: number
	onCheck: (key: string) => void
	onOpen: (key: string) => void
	onPick: (t: ScoredTitle, n: number) => void
}) {
	const gap = gapOf(t, score)
	const tick = `tick-${t.key}`
	const kind = t.mediaType === "show" ? "Show" : "Movie"
	return (
		<>
			<tr
				data-row={t.key}
				className={`border-b border-white/5 ${checked ? "bg-amber-400/[0.06]" : open ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
			>
				<td className="py-1">
					{/* The title is the tick box's label: a press anywhere on it selects the row. */}
					<label htmlFor={tick} className="group flex min-w-0 cursor-pointer items-center gap-2.5 py-0.5 pl-1">
						<input id={tick} type="checkbox" checked={checked} onChange={() => onCheck(t.key)} className="peer sr-only" />
						<span className="rounded-md peer-focus-visible:ring-2 peer-focus-visible:ring-white">
							<TickBox on={checked} />
						</span>
						<Poster path={t.poster_path} className="h-9 w-6 shrink-0 rounded-sm" />
						<span className="min-w-0">
							<span className="block truncate text-sm text-white" lang={mediaFieldLanguage(t)}>
								{t.title}
							</span>
							<span className="block truncate text-xs text-gray-500 md:hidden">
								{[t.release_year, kind].filter(Boolean).join(" · ")}
								{changedFrom != null && <span className="font-semibold text-amber-300"> · was {changedFrom}</span>}
							</span>
						</span>
					</label>
				</td>
				<td className="hidden px-2 text-xs tabular-nums text-gray-400 md:table-cell">{t.release_year}</td>
				<td className="hidden px-2 text-xs text-gray-400 md:table-cell">{kind}</td>
				<td className="hidden truncate px-2 text-xs text-gray-400 xl:table-cell">{t.genres.slice(0, 2).join(", ")}</td>
				<td className="hidden px-2 text-right text-xs font-bold tabular-nums md:table-cell">
					{t.gw == null ? (
						<span className="text-gray-600">–</span>
					) : (
						<span style={{ color: `var(--color-vibe-${goodwatchVibeIndex(t.gw)})` }}>{t.gw}</span>
					)}
				</td>
				<td
					className={`hidden px-2 text-right text-xs font-bold tabular-nums md:table-cell ${gap == null ? "text-gray-600" : gap >= 1.5 ? "text-emerald-300" : gap <= -1.5 ? "text-rose-300" : "text-gray-500"}`}
				>
					{gap == null ? "" : `${gap > 0 ? "+" : ""}${gap.toFixed(1)}`}
				</td>
				<td className="hidden py-1 pl-3 pr-1 lg:table-cell">
					<ScoreKeys score={score} gw={gwOnTen(t)} label={`Your score for ${t.title}`} onPick={(n) => onPick(t, n)} />
				</td>
				<td className="py-1 pr-1 text-right lg:hidden">
					<button
						type="button"
						onClick={() => onOpen(t.key)}
						aria-label={`Your score for ${t.title}: ${score}. Change it`}
						// The exact score in its strip color, like the keys above (see ScoreKeys for why).
						className="h-9 w-10 cursor-pointer rounded-lg text-sm font-black tabular-nums text-gray-950 ring-2 ring-white/80"
						style={{ background: getVibeColorValue(score as Score) }}
					>
						{score}
					</button>
				</td>
				<td className="hidden px-1 text-right text-xs font-semibold text-amber-300 md:table-cell">
					{changedFrom != null ? `was ${changedFrom}` : ""}
				</td>
				<td className="py-1 pr-1 text-right">
					<button
						type="button"
						onClick={() => onOpen(t.key)}
						aria-expanded={open}
						aria-label={`${open ? "Close" : "Open"} ${t.title}`}
						className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white"
					>
						<ChevronDownIcon className={`h-5 w-5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
					</button>
				</td>
			</tr>
			{open && (
				<tr>
					<td colSpan={span} className="pb-3 pt-1">
						<Opened t={t} score={score} onRate={(n) => onPick(t, n)} />
					</td>
				</tr>
			)}
		</>
	)
})
