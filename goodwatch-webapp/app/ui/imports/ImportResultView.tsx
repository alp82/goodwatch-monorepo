// What an import changed, or what its Undo changed back, title by title: one list per kind of change, each title
// linked to its page. The Done step shows these lists in its folds; every source draws them with this.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import type {
	ImportResultChange,
	ImportResultKind,
	ImportResultList,
	ImportResultRow,
	ImportResultSection,
	ImportResultSectionKey,
	ImportResultStatusChange,
	ImportResultTitle,
	ImportResultWatches,
} from "~/domain/import-result"
import { STATE_LABEL, type State } from "~/domain/tracking/machine"
import { titlePath } from "~/utils/helpers"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { formatCount } from "./shared"

/** A list choice the import took away and Undo could not put back, for a put-back button. */
export interface PutBack {
	title: ImportResultTitle
	list: "want_to_see" | "not_interested"
}

export const LIST_LABEL: Record<ImportResultList, string> = {
	want_to_see: "Want to See",
	not_interested: "Not interested",
	favorites: "favorites",
}

const HEADINGS: Record<ImportResultSectionKey, string> = {
	ratings_added: "Ratings added",
	ratings_replaced: "Ratings replaced",
	episode_ratings_added: "Season and episode scores",
	reviews: "Reviews",
	watches_added: "Watches added",
	statuses_set: "Show statuses set",
	want_added: "Added to Want to See",
	favorites_added: "Added to favorites",
	lists_cleared: "Taken off your lists",
	kept: "Kept as it was",
	skipped: "Not imported",
	not_restored: "Not put back",
	ratings_removed: "Ratings removed",
	ratings_restored: "Ratings put back",
	episode_ratings_removed: "Season and episode scores taken back",
	reviews_reverted: "Reviews taken back",
	watches_removed: "Watches removed",
	statuses_restored: "Show statuses put back",
	want_removed: "Removed from Want to See",
	favorites_removed: "Removed from favorites",
	lists_restored: "Back on your lists",
	left: "Left as you changed it",
}
const ATTENTION: ImportResultSectionKey[] = ["lists_cleared", "not_restored"]

const KINDS: Record<ImportResultKind, string> = {
	rating: "Rating",
	episode_rating: "Season or episode score",
	review: "Review",
	watch: "Watch",
	want: "Want to See",
	favorite: "Favorite",
	show_status: "Show status",
	unsupported: "Other data",
}
const LEFT: Record<ImportResultKind, string> = {
	rating: "Your rating",
	episode_rating: "Your season or episode score",
	review: "Your review",
	watch: "Your watch",
	want: "Want to See",
	favorite: "Your favorite",
	show_status: "Your show status",
	unsupported: "Your data",
}
const BECAUSE = {
	watched: "you watched it",
	status: "of its new show status",
	want: "you added it to Want to See",
} as const

export const plural = (n: number, one: string, many = `${one}s`) =>
	`${formatCount(n)} ${n === 1 ? one : many}`
const state = (value: State | null) => STATE_LABEL[value ?? "not_started"]
// Days are UTC calendar days; noon keeps them on their day in every time zone's formatting.
// formatRange is in every supported browser; the project's TypeScript lib predates it.
const DAYS = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeZone: "UTC",
}) as Intl.DateTimeFormat & { formatRange(start: Date, end: Date): string }
const noon = (day: string) => new Date(`${day}T12:00:00Z`)

function dayRange(watches: ImportResultWatches) {
	if (!watches.firstDay || !watches.lastDay)
		return watches.undated ? "Date unknown" : null
	const range =
		watches.firstDay === watches.lastDay
			? DAYS.format(noon(watches.firstDay))
			: DAYS.formatRange(noon(watches.firstDay), noon(watches.lastDay))
	return watches.undated
		? `${range} · ${formatCount(watches.undated)} without a date`
		: range
}

function episodeRange(watches: ImportResultWatches) {
	const { first, last } = watches
	if (!first || !last) return null
	const start = `S${first.season} E${first.episode}`
	if (first.season === last.season && first.episode === last.episode)
		return start
	return first.season === last.season
		? `${start}–E${last.episode}`
		: `${start}–S${last.season} E${last.episode}`
}

/** "3 episodes (S1 E1–E3) · Jun 23 – Jun 24, 2023", or "Mar 9, 2024" for one movie watch. */
function watchLine(watches: ImportResultWatches) {
	const episodes = episodeRange(watches)
	return [
		episodes
			? `${plural(watches.count, "episode")} (${episodes})`
			: watches.count > 1
				? plural(watches.count, "watch", "watches")
				: null,
		dayRange(watches),
	]
		.filter(Boolean)
		.join(" · ")
}

function Score({ n, muted = false }: { n: number; muted?: boolean }) {
	return (
		<span
			className={`font-bold tabular-nums ${muted ? "text-gray-400 line-through decoration-1" : "text-amber-300"}`}
		>
			{n}
		</span>
	)
}

function statusLine(status: ImportResultStatusChange | null, back: boolean) {
	if (!status) return ""
	return back ? ` · back to ${state(status.to)}` : ` · now ${state(status.to)}`
}

/** One sentence per change. */
function changeLine(change: ImportResultChange): ReactNode {
	switch (change.type) {
		case "rating-added":
			return (
				<>
					Rated <Score n={change.score} />
				</>
			)
		case "rating-replaced":
			return (
				<>
					Your <Score n={change.from} muted /> is now <Score n={change.to} />
				</>
			)
		case "episode-rating-added":
			return change.from === null ? (
				<>
					{change.part}: scored <Score n={change.score} />
				</>
			) : (
				<>
					{change.part}: your <Score n={change.from} muted /> is now{" "}
					<Score n={change.score} />
				</>
			)
		case "episode-rating-removed":
			return change.restored === null ? (
				<>
					{change.part}: your <Score n={change.score} muted /> is gone
				</>
			) : (
				<>
					{change.part}: back to <Score n={change.restored} /> (the import set{" "}
					<Score n={change.score} muted />)
				</>
			)
		case "review-added":
			return "Review added"
		case "review-replaced":
			return "Review replaced"
		case "watches-added":
			return `${watchLine(change.watches)}${statusLine(change.status, false)}`
		case "status-set":
			return change.status.from
				? `Now ${state(change.status.to)} (was ${state(change.status.from)})`
				: `Now ${state(change.status.to)}`
		case "list-added":
			return `Added to ${LIST_LABEL[change.list]}`
		case "list-cleared":
			return `Off ${LIST_LABEL[change.list]}, because ${BECAUSE[change.because]}. ${change.undoRestores ? "Undo puts it back." : "Undo won't put it back."}`
		case "kept":
			return `${KINDS[change.kind]}: ${change.reason}`
		case "skipped":
			return change.reason
		case "rating-removed":
			return (
				<>
					Your <Score n={change.score} muted /> is gone
				</>
			)
		case "rating-restored":
			return (
				<>
					Back to <Score n={change.to} /> (the import set{" "}
					<Score n={change.from} muted />)
				</>
			)
		case "review-removed":
			return "Review removed"
		case "review-restored":
			return "Your earlier review is back"
		case "watches-removed":
			return `${watchLine(change.watches)}${statusLine(change.status, true)}`
		case "status-restored":
			return `Back to ${state(change.status.to)} (was ${state(change.status.from)})`
		case "list-removed":
			return `Removed from ${LIST_LABEL[change.list]}`
		case "list-restored":
			return `Back on ${LIST_LABEL[change.list]}`
		case "not-restored":
			return `Was on ${LIST_LABEL[change.list]} before the import`
		case "not-reverted":
			return `Undo couldn't put your earlier ${KINDS[change.kind].toLowerCase()} back, so the import's stays.`
		case "left":
			return `${LEFT[change.kind]} stays: you changed it after the import.`
	}
}

function Poster({ title }: { title: ImportResultTitle }) {
	return title.posterPath ? (
		<img
			src={tmdbImageUrl(title.posterPath, "w92")}
			alt=""
			className="h-12 w-8 shrink-0 rounded object-cover"
			loading="lazy"
		/>
	) : (
		<span className="h-12 w-8 shrink-0 rounded bg-slate-800" aria-hidden />
	)
}

export const resultList =
	"divide-y divide-slate-800 rounded-lg border bg-slate-900/60"

/** The rows of a section: poster, linked title, and one line per change. */
export function ResultRows({
	rows,
	putBack,
}: {
	rows: ImportResultRow[]
	putBack?: (put: PutBack) => ReactNode
}) {
	return rows.map((row) => {
		const skipped = row.changes.find((change) => change.type === "skipped")
		return (
			<li
				key={row.key}
				className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5"
			>
				{row.title ? (
					<Poster title={row.title} />
				) : (
					<span className="h-12 w-8 shrink-0" aria-hidden />
				)}
				<div className="min-w-0 flex-1">
					{row.title ? (
						<p className="truncate">
							<Link
								to={titlePath(
									row.title.mediaType,
									row.title.tmdbId,
									row.title.title,
								)}
								className="font-semibold text-gray-100 underline-offset-4 hover:text-indigo-200 hover:underline"
							>
								{row.title.title}
							</Link>
							<span className="text-gray-400">
								{row.title.year ? ` · ${row.title.year}` : ""}
								{row.title.mediaType === "show" ? " · Show" : ""}
							</span>
						</p>
					) : (
						skipped && (
							<p>
								<span className="font-semibold text-gray-100">
									{skipped.label}
								</span>
								<span className="text-gray-400">
									{" "}
									· {KINDS[skipped.kind]} · row {formatCount(skipped.row)}
								</span>
							</p>
						)
					)}
					{row.changes.map((change, index) => (
						<p
							// biome-ignore lint/suspicious/noArrayIndexKey: a row's changes keep their order
							key={index}
							className={`text-sm ${change.type === "skipped" ? "text-gray-400" : "text-gray-300"}`}
						>
							{changeLine(change)}
						</p>
					))}
				</div>
				{putBack &&
					row.title &&
					row.changes.map((change) =>
						change.type === "not-restored" && row.title ? (
							<div key={change.list} className="w-full pl-11 sm:w-auto sm:pl-0">
								{putBack({ title: row.title, list: change.list })}
							</div>
						) : null,
					)}
			</li>
		)
	})
}

export function ResultSection({
	section,
	putBack,
	more,
}: {
	section: ImportResultSection
	putBack?: (put: PutBack) => ReactNode
	more: (section: ImportResultSection) => ReactNode
}) {
	const attention = ATTENTION.includes(section.key)
	return (
		<div data-result-section={section.key}>
			<h4 className="mb-2 flex items-baseline justify-between gap-3 font-semibold text-gray-100">
				<span>{HEADINGS[section.key]}</span>
				<span className="tabular-nums text-gray-400">
					{formatCount(section.count)}
				</span>
			</h4>
			<ul
				className={`${resultList} ${attention ? "border-amber-800" : "border-slate-700"}`}
			>
				<ResultRows
					rows={section.rows}
					putBack={section.key === "not_restored" ? putBack : undefined}
				/>
			</ul>
			{section.total > section.rows.length && more(section)}
		</div>
	)
}
