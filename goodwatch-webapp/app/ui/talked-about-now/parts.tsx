// Small pieces shared by the start page's row (start-row/StartRow.tsx) and the Hot on socials page
// (hot-page/HotPage.tsx): image URLs, a title's link, the reason's icon, the move since the day before, and the
// second line of a ranking row. Styles are in start-row/start-row.css.
import {
	type TalkedReason,
	type TalkedRow,
	type TalkedTitle,
	compact,
	liftLabel,
	reasonLabel,
} from "~/domain/talked-about-now"
import { startTitleHref } from "~/ui/living-room/BelowRoom"
import { canonicalMediaTitle } from "~/utils/media-presentation"
import { dateLabel } from "./start-row/Spark"

export const tmdb = (path: string, size: string) =>
	`https://image.tmdb.org/t/p/${size}${path}`

export const hrefOf = (title: TalkedTitle) =>
	startTitleHref({
		media_type: title.mediaType,
		tmdb_id: title.tmdbId,
		title: canonicalMediaTitle(title),
	})

const REASON_ICON: Record<TalkedReason["kind"], string> = {
	trailer: "M5 3.5v9l7-4.5z",
	new_season: "M3 6h10M3 9.5h10M3 13h10M5 3h6",
	new_release: "M2.5 5.5h11v2a1.5 1.5 0 000 3v2h-11v-2a1.5 1.5 0 000-3z",
	netflix_top10: "M4 13V3l8 10V3",
}

export function ReasonIcon({ kind }: { kind: TalkedReason["kind"] }) {
	return (
		<svg viewBox="0 0 16 16" className="tn-icon" aria-hidden="true">
			<path
				d={REASON_ICON[kind]}
				fill={kind === "trailer" ? "currentColor" : "none"}
				stroke={kind === "trailer" ? "none" : "currentColor"}
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

/** Up, down or new since the day before. Color is never alone: an arrow or the word says it too. */
export function Move({ move }: { move: TalkedTitle["move"] }) {
	if (move === null) return null
	if (move === "new") return <span className="tn-new">NEW</span>
	if (move === 0)
		return (
			<span className="tn-move" title="Same place as the day before">
				=
			</span>
		)
	const up = move > 0
	return (
		<span
			className={`tn-move${up ? " tn-up" : ""}`}
			title={`${up ? "Up" : "Down"} ${Math.abs(move)} since the day before`}
		>
			{up ? "▲" : "▼"}
			{Math.abs(move)}
		</span>
	)
}

/** The board row's second line: the reason and its day, or how many read about it. */
export function why(title: TalkedTitle) {
	if (title.reason)
		return `${reasonLabel(title.reason, title.mediaType)} · ${dateLabel(title.reason.day)}`
	const signal = title.signal
	if (!signal) return `${compact(title.views)} Wikipedia reads in a day`
	if (signal.trakt_watchers) return `${compact(signal.trakt_watchers)} watching on Trakt`
	if (signal.justwatch_rank) return `#${signal.justwatch_rank} on JustWatch${signal.justwatch_country ? ` ${signal.justwatch_country}` : ""}`
	return "Rising on TMDB"
}

/**
 * How hot, in a few characters. A Wikipedia row says "×9.7" against its usual. A backup row's own score is a merged
 * rank, not a multiple, so it says what was measured: TMDB's "×N" when it rose, else the JustWatch chart place, else
 * how many watch on Trakt.
 */
export function buzzLabel(title: TalkedTitle): string {
	const signal = title.signal
	if (!signal) return liftLabel(title.lift)
	if (signal.tmdb_lift && signal.tmdb_lift >= 1.1) return liftLabel(signal.tmdb_lift)
	if (signal.justwatch_rank) return `#${signal.justwatch_rank}`
	if (signal.trakt_watchers) return compact(signal.trakt_watchers)
	return "–"
}

/** Whether buzzLabel is a multiple of the title's usual ("×N its usual"). */
export const isMultiple = (title: TalkedTitle) =>
	!title.signal || Boolean(title.signal.tmdb_lift && title.signal.tmdb_lift >= 1.1)

/** A list made while Wikipedia's numbers are late: from Trakt, JustWatch and TMDB instead. */
export const isBackup = (row: Pick<TalkedRow, "source">) => row.source === "backup_signals"

const SOURCE_NAMES: Record<string, string> = {
	trakt_trending: "Trakt",
	trakt_watched_daily: "Trakt",
	justwatch_chart: "JustWatch",
	tmdb_popularity: "TMDB",
}

/** "Trakt, JustWatch and TMDB": the sources a backup list used. */
export function backupSources(row: Pick<TalkedRow, "sources_used">): string {
	const names = [...new Set((row.sources_used ?? []).map((s) => SOURCE_NAMES[s]).filter(Boolean))]
	if (!names.length) return "Trakt, JustWatch and TMDB"
	return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}

