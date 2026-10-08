// My shows (#385): one list for tonight. Continue comes first, the show watched last on top and the Seen shows with
// new episodes after it; then Start, the Want to See shows not started, best taste match first. The page states that
// rule, each group has a label, and each row shows the one fact that places it. The whole row opens the show's page:
// there is no Watched button and no tick in the list. Under the list are the shows with nothing for tonight.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link, useLocation } from "@remix-run/react"
import { type ReactNode, useEffect, useState } from "react"
import {
	ACTIVE_DAYS,
	activityWords,
	costWords,
	episodeCode,
	progressWords,
} from "~/domain/my-shows"
import type {
	MyShows,
	MyShowsRow,
	MyShowsStart,
} from "~/server/my-shows.server"
import {
	Empty,
	MY_LIBRARY,
	MY_MOVIES,
	PageHead,
	Poster,
	plural,
} from "~/ui/my-pages/bits"
import { DISPLAY, WRAP, backdropUrl } from "~/ui/watch-next/style"
import { titleToDashed } from "~/utils/helpers"

/** How many shows to start are drawn before "Show more". */
const START_STEP = 30
const DAY_MS = 86_400_000

const showHref = (show: { id: number; title: string }) =>
	`/show/${show.id}-${titleToDashed(show.title)}`

const DMY = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	year: "numeric",
	timeZone: "UTC",
})
/** "Aired today", "Aired 3 days ago", "Aired 12 Sep 2026". */
function airedWords(airDate: string | null, now: number): string | null {
	if (!airDate) return null
	const at = Date.parse(`${airDate}T00:00:00Z`)
	const days = Math.floor((now - at) / DAY_MS)
	if (days <= 0) return "Aired today"
	if (days === 1) return "Aired yesterday"
	if (days < 7) return `Aired ${days} days ago`
	return `Aired ${DMY.format(at)}`
}
const isNew = (airDate: string | null, now: number) =>
	airDate !== null && now - Date.parse(`${airDate}T00:00:00Z`) < 7 * DAY_MS

const TAG = {
	next: "bg-amber-400 text-black",
	seenNew: "bg-sky-400 text-black",
	start: "bg-emerald-400 text-black",
} as const
const Tag = ({ kind, children }: { kind: keyof typeof TAG; children: ReactNode }) => (
	<span
		className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${TAG[kind]}`}
	>
		{children}
	</span>
)

interface RowWords {
	id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
	tag: keyof typeof TAG
	tagWord: string
	fresh: boolean
	/** The Next episode, or what starting the show costs. */
	line: string
	meta: string
	/** The one fact that places the row in its group. */
	why: string
}

const continueRow = (row: MyShowsRow, now: number): RowWords => ({
	id: row.id,
	title: row.title,
	poster_path: row.poster_path,
	backdrop_path: row.backdrop_path,
	tag: row.kind === "seenNew" ? "seenNew" : "next",
	tagWord: row.kind === "seenNew" ? "New episodes" : "Next episode",
	fresh: row.kind === "next" && isNew(row.next?.airDate ?? null, now),
	line: row.next
		? [episodeCode(row.next), row.next.name].filter(Boolean).join(" · ")
		: row.kind === "seenNew"
			? plural(row.left, "new episode")
			: `${plural(row.left, "episode")} to watch`,
	meta: [
		airedWords(row.next?.airDate ?? null, now),
		row.next?.runtime ? `${row.next.runtime} min` : null,
		progressWords(row),
	]
		.filter(Boolean)
		.join(" · "),
	why:
		row.kind === "seenNew"
			? `${row.left} new since you saw it`
			: activityWords(row.lastActivityAt, now),
})

const startRow = (row: MyShowsStart): RowWords => ({
	id: row.id,
	title: row.title,
	poster_path: row.poster_path,
	backdrop_path: row.backdrop_path,
	tag: "start",
	tagWord: "Start",
	fresh: false,
	line: costWords(row) || "A show you want to see",
	meta: [
		row.running ? "Still running" : "Has ended",
		row.service ? `on ${row.service}` : null,
	]
		.filter(Boolean)
		.join(" · "),
	why: row.match ? `${row.match}% taste match` : "No taste match yet",
})

/** A row of the list. The whole row is the link to the show's page. */
function Row({ row, n, big }: { row: RowWords; n: number; big: boolean }) {
	return (
		<li data-row={row.id} data-tag={row.tag}>
			<Link
				to={showHref(row)}
				prefetch="intent"
				className={`group flex items-stretch gap-3 overflow-hidden rounded-2xl ring-1 ring-white/10 transition-colors hover:bg-white/[0.09] hover:ring-white/25 focus-visible:outline-2 focus-visible:outline-amber-300 md:gap-5 ${big ? "bg-white/[0.07]" : "bg-white/[0.04]"}`}
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
					{row.backdrop_path && (
						<img
							src={backdropUrl(row.backdrop_path, "w500")}
							alt=""
							loading="lazy"
							className="absolute inset-0 h-full w-full object-cover"
						/>
					)}
				</span>
				<Poster
					path={row.poster_path}
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
						<span
							className="truncate text-xs font-semibold text-gray-300 md:hidden"
							data-why
						>
							{row.why}
						</span>
					</span>
					<span
						className={`mt-1 truncate font-bold text-white ${big ? `${DISPLAY} text-3xl md:text-4xl` : "text-lg"}`}
					>
						{row.title}
					</span>
					<span className="truncate text-sm text-gray-200">{row.line}</span>
					<span className="truncate text-xs text-gray-400">{row.meta}</span>
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
			</Link>
		</li>
	)
}

const GroupLabel = ({
	id,
	name,
	rule,
	count,
}: { id: string; name: string; rule: string; count: number }) => (
	<li
		className="flex scroll-mt-24 items-baseline gap-2 px-1 pt-3 first:pt-0"
		id={id}
		data-group-label={id}
	>
		<h3 className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
			{name}
		</h3>
		<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-300">
			{count}
		</span>
		<span className="truncate text-xs text-gray-400">{rule}</span>
	</li>
)

/** A show with nothing for tonight: a compact row that opens the show. */
function QuietRow({ row, fact }: { row: MyShowsRow; fact: string }) {
	return (
		<li data-quiet-row={row.id}>
			<Link
				to={showHref(row)}
				prefetch="intent"
				className="group flex items-center gap-3 rounded-xl bg-white/[0.03] p-2 ring-1 ring-white/5 hover:bg-white/[0.07] hover:ring-white/20"
			>
				<Poster path={row.poster_path} className="h-[60px] w-10 shrink-0 rounded" />
				<span className="min-w-0 flex-1">
					<b className="block truncate text-sm text-white">{row.title}</b>
					<span className="block truncate text-xs text-gray-400">
						{progressWords(row)}
					</span>
					<span className="block truncate text-xs text-gray-500">{fact}</span>
				</span>
				<ChevronRightIcon
					className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300"
					aria-hidden
				/>
			</Link>
		</li>
	)
}

function QuietGroup({
	id,
	title,
	rows,
	fact,
	closed,
}: {
	id: string
	title: string
	rows: MyShowsRow[]
	fact: (row: MyShowsRow) => string
	closed?: boolean
}) {
	if (!rows.length) return null
	const list = (
		<ul className="grid gap-2 md:grid-cols-2">
			{rows.map((row) => (
				<QuietRow key={row.id} row={row} fact={fact(row)} />
			))}
		</ul>
	)
	const head = (
		<>
			{title}
			<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums">
				{rows.length}
			</span>
		</>
	)
	if (!closed)
		return (
			<div data-group={id}>
				<h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-300">
					{head}
				</h3>
				{list}
			</div>
		)
	return (
		<details className="group" data-group={id}>
			<summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold text-gray-300 hover:text-white [&::-webkit-details-marker]:hidden">
				<ChevronRightIcon
					className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-90"
					aria-hidden
				/>
				{head}
			</summary>
			<div className="pt-1">{list}</div>
		</details>
	)
}

export function MyShowsPage({ data, now }: { data: MyShows; now: number }) {
	const { hash } = useLocation()
	// Home's Start door lands on the Start group.
	useEffect(() => {
		if (hash === "#start" || hash === "#continue")
			document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" })
	}, [hash])
	const [shown, setShown] = useState(START_STEP)
	const continues = data.continue.map((row) => continueRow(row, now))
	const starts = data.start.slice(0, shown).map(startRow)
	const total = data.continue.length + data.start.length
	const jump = (id: string, label: string) => (
		<a
			href={`#${id}`}
			className="font-bold text-gray-200 underline decoration-white/30 underline-offset-4 hover:text-white"
		>
			{label}
		</a>
	)
	const lastWatch = (row: MyShowsRow) => activityWords(row.lastActivityAt, now)
	const quiet =
		data.older.length +
		data.waiting.length +
		data.onHold.length +
		data.dropped.length
	return (
		<div className="overflow-x-clip pb-24" data-my-shows>
			<PageHead
				name="My shows"
				line={[
					data.continue.length
						? `${data.continue.length} to continue`
						: "Nothing in progress",
					`${data.start.length} to start`,
				].join(" · ")}
				links={[
					{ label: "My movies", to: MY_MOVIES },
					{ label: "My library", to: MY_LIBRARY },
				]}
			/>
			<div className={`${WRAP} flex flex-col gap-10 pt-2`}>
				<section data-section="tonight">
					<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>Tonight</h2>
					<p className="mb-4 mt-1 max-w-3xl text-sm text-gray-400" data-order-rule>
						{continues.length > 0 && (
							<>
								{jump("continue", "Continue")} comes first, the show you watched
								last on top.{" "}
							</>
						)}
						{data.start.length > 0 && (
							<>
								{continues.length ? "Then " : "Shows to "}
								{jump("start", continues.length ? "Start" : "start")}: the shows
								you want to see, best taste match first.{" "}
							</>
						)}
						{total > 0 && "A row opens the show."}
					</p>
					{total === 0 ? (
						<Empty title="No show for tonight">
							Want to See on a show puts it here to start, with how long it is and
							where it streams. Once you mark an episode watched on a show's page,
							its next episode leads this list.
						</Empty>
					) : (
						<ol className="flex flex-col gap-2.5">
							{continues.length > 0 && (
								<GroupLabel
									id="continue"
									name="Continue"
									rule="last watched first"
									count={continues.length}
								/>
							)}
							{continues.map((row, i) => (
								<Row key={row.id} row={row} n={i + 1} big={i === 0} />
							))}
							{data.start.length > 0 && (
								<GroupLabel
									id="start"
									name="Start"
									rule="best taste match first"
									count={data.start.length}
								/>
							)}
							{starts.map((row, i) => (
								<Row
									key={row.id}
									row={row}
									n={continues.length + i + 1}
									big={!continues.length && i === 0}
								/>
							))}
						</ol>
					)}
					{data.start.length > shown && (
						<button
							type="button"
							data-more
							onClick={() => setShown(shown + START_STEP * 2)}
							className="mt-4 h-11 cursor-pointer rounded-lg bg-white/5 px-4 text-sm font-bold text-gray-300 hover:bg-white/10"
						>
							Show {Math.min(data.start.length - shown, START_STEP * 2)} more{" "}
							<span className="font-medium text-gray-500">
								· {data.start.length - shown} left
							</span>
						</button>
					)}
				</section>
				{quiet > 0 && (
					<section
						className="flex flex-col gap-4 border-t border-white/5 pt-6"
						aria-label="Shows with nothing for tonight"
						data-quiet
					>
						<QuietGroup
							id="older"
							title={`Not watched for ${ACTIVE_DAYS} days`}
							rows={data.older}
							fact={lastWatch}
							closed
						/>
						<QuietGroup
							id="waiting"
							title="Waiting for episodes"
							rows={data.waiting}
							fact={(row) =>
								row.state === "seen" ? "Caught up" : "Up to date"
							}
						/>
						<QuietGroup
							id="on-hold"
							title="On hold"
							rows={data.onHold}
							fact={lastWatch}
							closed
						/>
						<QuietGroup
							id="dropped"
							title="Dropped"
							rows={data.dropped}
							fact={lastWatch}
							closed
						/>
					</section>
				)}
			</div>
		</div>
	)
}
