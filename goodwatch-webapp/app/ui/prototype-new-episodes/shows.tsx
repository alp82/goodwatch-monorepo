// PROTOTYPE - throwaway. My shows for /prototype/new-episodes: the page as it is built (ui/my-shows/MyShowsPage.tsx,
// copied, not imported, so that the real page stays untouched), with the two things this prototype adds. The
// "Waiting for episodes" group says when each show's next episode airs, soonest first, in three layouts. And the page
// says once what was new when the member arrived. Rows open the show's page in the real thing; here they do nothing.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import {
	ACTIVE_DAYS,
	activityWords,
	episodeCode,
	progressWords,
} from "~/domain/my-shows"
import {
	DISPLAY,
	Empty,
	MY_LIBRARY,
	MY_MOVIES,
	PageHead,
	Poster,
	WRAP,
	plural,
	tmdbImage,
} from "~/ui/my-pages/bits"
import {
	type Planned,
	type PlannedShow,
	STARTS,
	type Signal,
	type Upcoming,
	at,
	dateWords,
	evening,
	upcomingOf,
} from "./model"

export const ROWS = {
	line: "A · a line in the row",
	column: "B · a date column",
	chip: "C · the date leads",
} as const
export type RowKey = keyof typeof ROWS

const DAY_MS = 86_400_000

/** "Aired today", "Aired 3 days ago", "Aired 12 Sep 2026", as on the real page. */
function airedWords(airDate: string | null, today: string): string | null {
	if (!airDate) return null
	const days = Math.floor((evening(today) - at(airDate)) / DAY_MS)
	if (days <= 0) return "Aired today"
	if (days === 1) return "Aired yesterday"
	if (days < 7) return `Aired ${days} days ago`
	return `Aired ${dateWords(airDate, today)}`
}
const isNew = (airDate: string | null, today: string) =>
	airDate !== null && evening(today) - at(airDate) < 7 * DAY_MS

const TAG = {
	next: "bg-amber-400 text-black",
	seenNew: "bg-sky-400 text-black",
	start: "bg-emerald-400 text-black",
} as const
const Tag = ({
	kind,
	children,
}: { kind: keyof typeof TAG; children: ReactNode }) => (
	<span
		className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${TAG[kind]}`}
	>
		{children}
	</span>
)

interface RowWords {
	id: number
	title: string
	poster: string
	backdrop: string
	tag: keyof typeof TAG
	tagWord: string
	fresh: boolean
	/** It is one of the shows the signal was about when the member arrived. */
	arrived: boolean
	line: string
	meta: string
	why: string
}

function continueRow(
	{ row, show, facts }: PlannedShow,
	today: string,
	arrived: Signal,
): RowWords {
	const next = facts.next
	return {
		id: show.id,
		title: show.title,
		poster: show.poster,
		backdrop: show.backdrop,
		tag: row.kind === "seenNew" ? "seenNew" : "next",
		tagWord: row.kind === "seenNew" ? "New episodes" : "Next episode",
		fresh: row.kind === "next" && isNew(next?.airDate ?? null, today),
		arrived: arrived.shows.some((s) => s.show.id === show.id),
		line: next
			? [episodeCode(next), next.name].filter(Boolean).join(" · ")
			: `${plural(row.left, "episode")} to watch`,
		meta: [
			progressWords(row),
			`${show.runtime} min`,
			airedWords(next?.airDate ?? null, today),
		]
			.filter(Boolean)
			.join(" · "),
		why:
			row.kind === "seenNew"
				? `${row.left} new since you saw it`
				: activityWords(row.lastActivityAt, evening(today)),
	}
}

const startRows: RowWords[] = STARTS.map((show) => ({
	id: show.id,
	title: show.title,
	poster: show.poster,
	backdrop: show.backdrop,
	tag: "start",
	tagWord: "Start",
	fresh: false,
	arrived: false,
	line: show.cost,
	meta: show.meta,
	why: `${show.match}% taste match`,
}))

function Row({ row, n, big }: { row: RowWords; n: number; big: boolean }) {
	return (
		<li data-row={row.id} data-tag={row.tag}>
			<div
				className={`group flex items-stretch gap-3 overflow-hidden rounded-2xl ring-1 ring-white/10 transition-colors hover:bg-white/[0.09] hover:ring-white/25 md:gap-5 ${big ? "bg-white/[0.07]" : "bg-white/[0.04]"}`}
			>
				<span
					className={`${DISPLAY} flex w-8 shrink-0 items-center justify-center text-3xl text-white/25 md:w-14 md:text-5xl`}
					aria-hidden
				>
					{n}
				</span>
				<span
					className={`relative hidden shrink-0 self-stretch bg-white/5 sm:block ${big ? "w-64" : "w-44"}`}
				>
					<img
						src={tmdbImage(row.backdrop, "w500")}
						alt=""
						loading="lazy"
						className="absolute inset-0 h-full w-full object-cover"
					/>
				</span>
				<Poster
					path={row.poster}
					size="w185"
					className="my-3 h-24 w-16 shrink-0 rounded-md sm:hidden"
				/>
				<span
					className={`flex min-w-0 flex-1 flex-col justify-center ${big ? "py-5" : "py-3"}`}
				>
					<span className="flex min-w-0 items-center gap-1.5">
						<Tag kind={row.tag}>{row.tagWord}</Tag>
						{row.fresh && (
							<span className="rounded bg-white/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
								New
							</span>
						)}
						{row.arrived && (
							<span
								className="h-2 w-2 shrink-0 rounded-full bg-sky-400"
								title="New since your last visit"
								data-arrived
							/>
						)}
					</span>
					<span
						className={`mt-1 truncate font-bold text-white ${big ? `${DISPLAY} text-3xl md:text-4xl` : "text-lg"}`}
					>
						{row.title}
					</span>
					<span className="truncate text-sm text-gray-200">{row.line}</span>
					<span className="truncate text-xs text-gray-400">
						<b className="font-semibold text-gray-300 md:hidden">
							{row.why} ·{" "}
						</b>
						{row.meta}
					</span>
				</span>
				<span className="hidden w-40 shrink-0 items-center justify-end text-right text-sm font-semibold text-gray-300 md:flex">
					{row.why}
				</span>
				<span className="flex shrink-0 items-center pr-2 md:pr-4">
					<ChevronRightIcon
						className="h-5 w-5 text-gray-500 transition-colors group-hover:text-amber-300"
						aria-hidden
					/>
				</span>
			</div>
		</li>
	)
}

const GroupLabel = ({
	name,
	rule,
	count,
}: { name: string; rule: string; count: number }) => (
	<li className="flex items-baseline gap-2 px-1 pt-3 first:pt-0">
		<h3 className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
			{name}
		</h3>
		<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-300">
			{count}
		</span>
		<span className="truncate text-xs text-gray-400">{rule}</span>
	</li>
)

const Chevron = () => (
	<ChevronRightIcon
		className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300"
		aria-hidden
	/>
)

const QUIET_ROW =
	"group flex items-center gap-3 rounded-xl bg-white/[0.03] p-2 ring-1 ring-white/5 hover:bg-white/[0.07] hover:ring-white/20"

/** A show with nothing for tonight, as on the real page. */
function QuietRow({ item, fact }: { item: PlannedShow; fact: string }) {
	return (
		<li className={QUIET_ROW}>
			<Poster
				path={item.show.poster}
				className="h-[60px] w-10 shrink-0 rounded"
			/>
			<span className="min-w-0 flex-1">
				<b className="block truncate text-sm text-white">{item.show.title}</b>
				<span className="block truncate text-xs text-gray-400">
					{progressWords(item.row)}
				</span>
				<span className="block truncate text-xs text-gray-500">{fact}</span>
			</span>
			<Chevron />
		</li>
	)
}

const QuietHead = ({
	title,
	count,
	note,
}: { title: string; count: number; note?: string }) => (
	<>
		{title}
		<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums">
			{count}
		</span>
		{note && <span className="text-xs font-medium text-gray-500">{note}</span>}
	</>
)

function Closed({
	title,
	count,
	children,
}: { title: string; count: number; children: ReactNode }) {
	if (!count) return null
	return (
		<details className="group">
			<summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold text-gray-300 hover:text-white [&::-webkit-details-marker]:hidden">
				<ChevronRightIcon
					className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-90"
					aria-hidden
				/>
				<QuietHead title={title} count={count} />
			</summary>
			<div className="pt-1">{children}</div>
		</details>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Waiting for episodes, three ways

/** "Caught up" for a Seen show that is still running; "Up to date" for a Watching one. */
const label = (item: PlannedShow) =>
	item.show.status === "seen" ? "Caught up" : "Up to date"

type Waiting = PlannedShow & { up: Upcoming }

/** A: today's two columns of compact rows. The middle line becomes the sentence about the next episode. */
function WaitingLine({ rows }: { rows: Waiting[] }) {
	return (
		<ul className="grid gap-2 md:grid-cols-2">
			{rows.map((item) => (
				<li
					key={item.show.id}
					className={QUIET_ROW}
					data-waiting={item.show.key}
				>
					<Poster
						path={item.show.poster}
						className="h-[60px] w-10 shrink-0 rounded"
					/>
					<span className="min-w-0 flex-1">
						<b className="block truncate text-sm text-white">
							{item.show.title}
						</b>
						<span
							className={`block truncate text-xs ${item.up.when ? "font-semibold text-gray-200" : "text-gray-400"}`}
						>
							{item.up.sentence}
						</span>
						<span className="block truncate text-xs text-gray-500">
							{label(item)} · {progressWords(item.row)}
						</span>
					</span>
					<Chevron />
				</li>
			))}
		</ul>
	)
}

/** B: one column, one line a show, and the day in a column of its own at the end, as in a timetable. */
function WaitingColumn({ rows }: { rows: Waiting[] }) {
	return (
		<ul className="overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/5">
			{rows.map((item) => (
				<li
					key={item.show.id}
					data-waiting={item.show.key}
					className="group flex items-center gap-3 border-t border-white/5 px-2 py-2 first:border-t-0 hover:bg-white/[0.05] md:px-4"
				>
					<Poster
						path={item.show.poster}
						className="h-[54px] w-9 shrink-0 rounded"
					/>
					<span className="min-w-0 flex-1">
						<b className="block truncate text-sm text-white">
							{item.show.title}
						</b>
						<span className="block truncate text-xs text-gray-400">
							{item.up.code
								? [item.up.code, item.up.name].filter(Boolean).join(" · ")
								: "No new episodes announced"}
							<span className="text-gray-500"> · {label(item)}</span>
						</span>
					</span>
					<span className="w-[92px] shrink-0 text-right md:w-36">
						{item.up.when ? (
							<>
								<b
									className={`block text-sm first-letter:uppercase ${(item.up.days ?? 9) < 7 ? "text-white" : "text-gray-200"}`}
								>
									{item.up.when}
								</b>
								<span className="block text-xs text-gray-500">
									{(item.up.days ?? 0) < 7
										? item.up.date
										: `in ${plural(Math.round((item.up.days ?? 0) / 7), "week")}`}
								</span>
							</>
						) : (
							<span className="block text-xs text-gray-500">No date yet</span>
						)}
					</span>
					<Chevron />
				</li>
			))}
		</ul>
	)
}

/** C: the day leads the row as a tag, as the tags lead the rows of Continue; shows without a date are a closed group. */
function WaitingChip({ rows }: { rows: Waiting[] }) {
	const dated = rows.filter((r) => r.up.when)
	const undated = rows.filter((r) => !r.up.when)
	const card = (item: Waiting) => (
		<li key={item.show.id} className={QUIET_ROW} data-waiting={item.show.key}>
			<Poster
				path={item.show.poster}
				className="h-[60px] w-10 shrink-0 rounded"
			/>
			<span className="min-w-0 flex-1">
				{item.up.when && (
					<span
						className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${(item.up.days ?? 9) < 7 ? "bg-white/20 text-white" : "bg-white/[0.08] text-gray-300"}`}
					>
						{item.up.when}
					</span>
				)}
				<b className="mt-0.5 block truncate text-sm text-white">
					{item.show.title}
				</b>
				<span className="block truncate text-xs text-gray-400">
					{item.up.code ? `${item.up.code} · ` : ""}
					{item.up.when ? label(item) : item.up.sentence}
				</span>
			</span>
			<Chevron />
		</li>
	)
	return (
		<div className="flex flex-col gap-2">
			{dated.length > 0 && (
				<ul className="grid gap-2 md:grid-cols-2">{dated.map(card)}</ul>
			)}
			<Closed title="No date yet" count={undated.length}>
				<ul className="grid gap-2 md:grid-cols-2">{undated.map(card)}</ul>
			</Closed>
		</div>
	)
}

const WAITING = { line: WaitingLine, column: WaitingColumn, chip: WaitingChip }

// ---------------------------------------------------------------------------------------------------------

export function ShowsPage({
	plan,
	today,
	row,
	arrived,
}: {
	plan: Planned
	today: string
	row: RowKey
	/** What the signal held when the member opened the page. */
	arrived: Signal
}) {
	const continues = plan.continue.map((item) =>
		continueRow(item, today, arrived),
	)
	const total = continues.length + startRows.length
	const waiting: Waiting[] = plan.waiting.map((item) => ({
		...item,
		up: upcomingOf(item.facts, today),
	}))
	const Waiting = WAITING[row]
	const lastWatch = (item: PlannedShow) =>
		activityWords(item.row.lastActivityAt, evening(today))
	const names = arrived.shows.map((s) => s.show.title)
	return (
		<div className="overflow-x-clip pb-40 lg:pb-24" data-proto-shows>
			<PageHead
				name="My shows"
				line={[
					continues.length
						? `${continues.length} to continue`
						: "Nothing in progress",
					`${startRows.length} to start`,
				].join(" · ")}
				links={[
					{ label: "My movies", to: MY_MOVIES },
					{ label: "My library", to: MY_LIBRARY },
				]}
			/>
			<div className={`${WRAP} flex flex-col gap-10 pt-2`}>
				<section>
					<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>
						Tonight
					</h2>
					{names.length > 0 && (
						<p
							className="mt-2 flex max-w-3xl items-baseline gap-2 text-sm text-sky-200"
							data-arrival
						>
							<span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full bg-sky-400" />
							<span>
								<b className="font-bold">
									New since {dateWords(arrived.since, today)}:
								</b>{" "}
								{names.slice(0, 3).join(", ")}
								{names.length > 3 && ` and ${names.length - 3} more`}
							</span>
						</p>
					)}
					<p className="mb-4 mt-1 max-w-3xl text-sm text-gray-400">
						{continues.length > 0 &&
							"Continue comes first, the show you watched last on top. "}
						Then Start: the shows you want to see, best taste match first. A row
						opens the show.
					</p>
					{total === 0 ? (
						<Empty title="No show for tonight">Nothing here.</Empty>
					) : (
						<ol className="flex flex-col gap-2.5">
							{continues.length > 0 && (
								<GroupLabel
									name="Continue"
									rule="last watched first"
									count={continues.length}
								/>
							)}
							{continues.map((r, i) => (
								<Row key={r.id} row={r} n={i + 1} big={i === 0} />
							))}
							<GroupLabel
								name="Start"
								rule="best taste match first"
								count={startRows.length}
							/>
							{startRows.map((r, i) => (
								<Row
									key={r.id}
									row={r}
									n={continues.length + i + 1}
									big={!continues.length && i === 0}
								/>
							))}
						</ol>
					)}
				</section>
				<section
					className="flex flex-col gap-4 border-t border-white/5 pt-6"
					aria-label="Shows with nothing for tonight"
				>
					<Closed
						title={`Not watched for ${ACTIVE_DAYS} days`}
						count={plan.older.length}
					>
						<ul className="grid gap-2 md:grid-cols-2">
							{plan.older.map((item) => (
								<QuietRow
									key={item.show.id}
									item={item}
									fact={lastWatch(item)}
								/>
							))}
						</ul>
					</Closed>
					{waiting.length > 0 && (
						<div data-group="waiting" data-row-variant={row}>
							<h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-300">
								<QuietHead
									title="Waiting for episodes"
									count={waiting.length}
									note="soonest first"
								/>
							</h3>
							<Waiting rows={waiting} />
						</div>
					)}
					<Closed title="On hold" count={plan.onHold.length}>
						<ul className="grid gap-2 md:grid-cols-2">
							{plan.onHold.map((item) => (
								<QuietRow
									key={item.show.id}
									item={item}
									fact={lastWatch(item)}
								/>
							))}
						</ul>
					</Closed>
					<Closed title="Dropped" count={plan.dropped.length}>
						<ul className="grid gap-2 md:grid-cols-2">
							{plan.dropped.map((item) => (
								<QuietRow
									key={item.show.id}
									item={item}
									fact={lastWatch(item)}
								/>
							))}
						</ul>
					</Closed>
				</section>
			</div>
		</div>
	)
}
