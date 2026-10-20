import { mediaFieldLanguage } from "~/utils/media-presentation"
import { canonicalMediaTitle } from "~/utils/media-presentation"
// My shows (#385): one list for tonight. Continue comes first, the show the member was last active on on top and the
// Seen shows with new episodes after it; then Pick up, the Watching shows without activity for 90 days; then Start,
// the Want to See shows not started, best taste match first. The page states that rule, each group has a label, and
// each row shows the one fact that places it. The whole row opens the show's page: there is no Watched button and no
// tick in the list. Under the list are the shows the member set aside: On hold and Dropped.
// The waiting shows are one row between Continue and Pick up, which names the show that returns first and opens to
// all of them with the day each returns, soonest first, by the member's day (#442). Opening the page is the visit
// that clears the signal outside it, and the page says once what was new.
// The shows that landed on the member's services in the last 14 days are one row above the list, which names the
// latest and opens to all of them with their days, and each of them carries the service's logo on its row (#489).
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link, useLocation } from "@remix-run/react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import {
	ACTIVE_DAYS,
	activityWords,
	costWords,
	episodeCode,
	placedWords,
	progressWords,
} from "~/domain/my-shows"
import {
	type Arrival,
	arrivalWords,
	deviceDay,
	upcomingWords,
	waitingWords,
} from "~/domain/new-episodes"
import type { LandedTitle, NewOn } from "~/domain/newly-available-words"
import type {
	MyShows,
	MyShowsRow,
	MyShowsStart,
} from "~/server/my-shows.server"
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
	LandedRow,
	NewOnSticker,
	NewOnWords,
} from "~/ui/my-pages/LandedRow"
import { useMyShowsVisit } from "~/ui/navigation/useNewEpisodes"
import { titleToDashed } from "~/utils/helpers"

/** How many shows to start are drawn before "Show more". */
const START_STEP = 30
/** How many shows to pick up are drawn before "Show more", so that Start stays within reach. */
const PICK_UP_STEP = 5
const DAY_MS = 86_400_000

const showHref = (show: { id: number; title: string }) =>
	`/show/${show.id}-${titleToDashed(canonicalMediaTitle(show))}`

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
		progressWords(row),
		row.next?.runtime ? `${row.next.runtime} min` : null,
		airedWords(row.next?.airDate ?? null, now),
	]
		.filter(Boolean)
		.join(" · "),
	why:
		row.kind === "seenNew"
			? `${row.left} new since you saw it`
			: placedWords(row, now),
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
function Row({
	row,
	n,
	big,
	newOn,
}: {
	row: RowWords
	n: number
	big: boolean
	/** The service the show is new on, when it landed in the last 14 days (#489). */
	newOn?: NewOn
}) {
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
							src={tmdbImage(row.backdrop_path, "w500")}
							alt=""
							loading="lazy"
							className="absolute inset-0 h-full w-full object-cover"
						/>
					)}
					{newOn && (
						<NewOnSticker service={newOn} className="absolute left-2 top-2" />
					)}
				</span>
				<span className="relative my-3 shrink-0 sm:hidden">
					<Poster
						path={row.poster_path}
						size="w185"
						className="h-24 w-16 rounded-md"
					/>
					{newOn && (
						<NewOnSticker
							service={newOn}
							small
							className="absolute left-1 top-1"
						/>
					)}
				</span>
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
					</span>
					<span
						className={`mt-1 truncate font-bold text-white ${big ? `${DISPLAY} text-3xl md:text-4xl` : "text-lg"}`}
					>
						<span lang={mediaFieldLanguage(row)}>{row.title}</span>
					</span>
					<span className="truncate text-sm text-gray-200">{row.line}</span>
					{/* On a phone the fact that places the row leads its last line; wider, it has a column of its own. */}
					<span className="truncate text-xs text-gray-400">
						<b className="font-semibold text-gray-300 md:hidden" data-why>
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
function QuietRow({
	row,
	fact,
	newOn,
}: { row: MyShowsRow; fact: string; newOn?: NewOn }) {
	return (
		<li data-quiet-row={row.id}>
			<Link
				to={showHref(row)}
				prefetch="intent"
				className="group flex items-center gap-3 rounded-xl bg-white/[0.03] p-2 ring-1 ring-white/5 hover:bg-white/[0.07] hover:ring-white/20"
			>
				<Poster
					path={row.poster_path}
					className="h-[60px] w-10 shrink-0 rounded"
				/>
				<span className="min-w-0 flex-1">
					<b className="block truncate text-sm text-white">{row.title}</b>
					<span className="block truncate text-xs text-gray-400">
						{progressWords(row)}
					</span>
					{/* The poster is too small for the logo: the words carry it. */}
					<span className="block truncate text-xs text-gray-500">
						{newOn && (
							<>
								<NewOnWords service={newOn} /> ·{" "}
							</>
						)}
						{fact}
					</span>
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
	newOn,
	closed,
}: {
	id: string
	title: string
	rows: MyShowsRow[]
	fact: (row: MyShowsRow) => string
	newOn?: ReadonlyMap<number, NewOn>
	closed?: boolean
}) {
	if (!rows.length) return null
	const list = (
		<ul className="grid gap-2 md:grid-cols-2">
			{rows.map((row) => (
				<QuietRow
					key={row.id}
					row={row}
					fact={fact(row)}
					newOn={newOn?.get(row.id)}
				/>
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

// Drawn here and not taken from the icon set: an icon nothing else uses would join the scripts of every page.
const CalendarIcon = () => (
	<svg
		viewBox="0 0 20 20"
		fill="currentColor"
		className="h-5 w-5 shrink-0 text-sky-300"
		aria-hidden="true"
	>
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
		/>
	</svg>
)

/**
 * The shows waiting for episodes, as one row between Continue and Pick up: it names the show that returns first and
 * counts the others, and opens to all of them. Opened: one show a line, and the day its next episode airs in a
 * column of its own at the end. On a phone the episode's name is left out, so that "Caught up" is never cut off.
 */
function WaitingRow({ rows, today }: { rows: MyShowsRow[]; today: string }) {
	const words = waitingWords(rows, today)
	if (!words) return null
	return (
		<li data-waiting>
			<details
				className="group/waiting overflow-hidden rounded-2xl bg-sky-400/[0.07] ring-1 ring-sky-300/20 open:bg-white/[0.03] open:ring-white/10"
				data-group="waiting"
			>
				<summary
					className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-amber-300 md:gap-4 md:px-5 [&::-webkit-details-marker]:hidden"
					data-waiting-summary
				>
					<CalendarIcon />
					<span className="min-w-0 flex-1 text-sm md:flex md:items-baseline md:gap-2">
						<span className="block truncate text-sky-100" data-waiting-says>
							{words.title && (
								<b className="font-bold text-white">{words.title} </b>
							)}
							{words.says}
						</span>
						{words.more && (
							<span
								className="block truncate text-xs text-gray-400 md:text-sm"
								data-waiting-more
							>
								<span className="hidden md:inline" aria-hidden>
									·{" "}
								</span>
								{words.more}
							</span>
						)}
					</span>
					<span className="hidden shrink-0 text-xs font-black uppercase tracking-[0.18em] text-sky-300/80 lg:inline">
						Waiting for episodes
					</span>
					<span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-300">
						{rows.length}
					</span>
					<ChevronRightIcon
						className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open/waiting:rotate-90"
						aria-hidden
					/>
				</summary>
				<ul className="border-t border-white/10">
					{rows.map((row) => {
						const { when, detail } = upcomingWords(row.upcoming, today)
						return (
							<li
								key={row.id}
								data-waiting-row={row.id}
								className="border-t border-white/5 first:border-t-0"
							>
								<Link
									to={showHref(row)}
									prefetch="intent"
									className="group flex items-center gap-3 px-3 py-2 hover:bg-white/[0.05] md:px-5"
								>
									<Poster
										path={row.poster_path}
										className="h-[54px] w-9 shrink-0 rounded"
									/>
									<span className="min-w-0 flex-1">
										<b className="block truncate text-sm text-white">
											<span lang={mediaFieldLanguage(row)}>{row.title}</span>
										</b>
										<span className="block truncate text-xs text-gray-400">
											{row.upcoming && (
												<>
													{episodeCode(row.upcoming)}
													{row.upcoming.name && (
														<span className="hidden sm:inline">
															{" "}
															· <span lang={row.upcoming.textPresentation?.name.language ?? "en"}>{row.upcoming.name}</span>
														</span>
													)}
													{" · "}
												</>
											)}
											<span className="text-gray-500" data-waiting-label>
												{row.state === "seen" ? "Caught up" : "Up to date"}
											</span>
										</span>
									</span>
									<span
										className="w-[92px] shrink-0 text-right md:w-36"
										data-waiting-day
									>
										{when && <b className="block text-sm text-white">{when}</b>}
										<span className="block text-xs text-gray-500">{detail}</span>
									</span>
									<ChevronRightIcon
										className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300"
										aria-hidden
									/>
								</Link>
							</li>
						)
					})}
				</ul>
			</details>
		</li>
	)
}

const NOTHING_LANDED: LandedTitle[] = []

export function MyShowsPage({
	data,
	now,
	arrival = null,
	landed = NOTHING_LANDED,
}: {
	data: MyShows
	now: number
	/** What was new when the member arrived; null where nothing recorded it. */
	arrival?: Arrival | null
	/** The shows that landed on the member's services in the last 14 days, the latest first (#489). */
	landed?: LandedTitle[]
}) {
	useMyShowsVisit()
	// The server's day first, so that the page hydrates as it was sent; then the member's.
	const [today, setToday] = useState(() =>
		new Date(now).toISOString().slice(0, 10),
	)
	useEffect(() => setToday(deviceDay()), [])
	// The line stays for the visit, also when the page's data is read again.
	const [arrived] = useState(arrival)
	const fresh = arrived && arrivalWords(arrived.since, arrived.titles, today)
	const { hash } = useLocation()
	// Home's Start door lands on the Start group.
	useEffect(() => {
		if (hash === "#start" || hash === "#continue" || hash === "#pick-up")
			document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" })
	}, [hash])
	const [shown, setShown] = useState(START_STEP)
	const [pickUpShown, setPickUpShown] = useState(PICK_UP_STEP)
	const continues = data.continue.map((row) => continueRow(row, now))
	const pickUps = data.pickUp
		.slice(0, pickUpShown)
		.map((row) => continueRow(row, now))
	const starts = data.start.slice(0, shown).map(startRow)
	const total = data.continue.length + data.pickUp.length + data.start.length
	const pickUpLeft = data.pickUp.length - pickUps.length
	const jump = (id: string, label: string) => (
		<a
			href={`#${id}`}
			className="font-bold text-gray-200 underline decoration-white/30 underline-offset-4 hover:text-white"
		>
			{label}
		</a>
	)
	const lastWatch = (row: MyShowsRow) => activityWords(row.lastActivityAt, now)
	const newOn = useMemo(
		() =>
			new Map(
				landed.flatMap(({ tmdbId, service }) =>
					service ? [[tmdbId, service] as const] : [],
				),
			),
		[landed],
	)
	// A show that landed and has a new episode says both: the row names where it is new, its line here the episode.
	const withNewEpisode = new Set(
		data.continue
			.filter(
				(row) =>
					row.kind === "seenNew" || isNew(row.next?.airDate ?? null, now),
			)
			.map((row) => row.id),
	)
	const quiet = data.onHold.length + data.dropped.length
	return (
		<div className="overflow-x-clip pb-24" data-my-shows>
			<PageHead
				name="My shows"
				line={[
					data.continue.length
						? `${data.continue.length} to continue`
						: data.pickUp.length
							? null
							: "Nothing in progress",
					data.pickUp.length ? `${data.pickUp.length} to pick up` : null,
					`${data.start.length} to start`,
				]
					.filter(Boolean)
					.join(" · ")}
				links={[
					{ label: "My movies", to: MY_MOVIES },
					{ label: "My library", to: MY_LIBRARY },
				]}
			/>
			<div className={`${WRAP} flex flex-col gap-10 pt-2`}>
				<section data-section="tonight">
					<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>
						Watch next
					</h2>
					{fresh && (
						<p
							className="mt-2 flex max-w-3xl items-baseline gap-2 text-sm text-sky-200"
							data-arrival
						>
							<span
								className="h-2 w-2 shrink-0 -translate-y-px rounded-full bg-sky-400"
								aria-hidden
							/>
							<span>
								<b className="font-bold">{fresh.lead}</b> {fresh.names}
							</span>
						</p>
					)}
					<p
						className="mb-4 mt-1 max-w-3xl text-sm text-gray-400"
						data-order-rule
					>
						{continues.length > 0 && (
							<>
								{jump("continue", "Continue")} comes first, the show you watched
								last on top.{" "}
							</>
						)}
						{pickUps.length > 0 && (
							<>
								{continues.length ? "Then " : "Shows to "}
								{jump("pick-up", continues.length ? "Pick up" : "pick up")}:
								shows you started and have not watched for {ACTIVE_DAYS} days.{" "}
							</>
						)}
						{data.start.length > 0 && (
							<>
								{continues.length || pickUps.length ? "Then " : "Shows to "}
								{jump(
									"start",
									continues.length || pickUps.length ? "Start" : "start",
								)}
								: the shows you want to see, best taste match first.{" "}
							</>
						)}
						{total > 0 && "A row opens the show."}
					</p>
					<LandedRow
						landed={landed}
						note={(show) =>
							withNewEpisode.has(show.tmdbId) ? "also a new episode" : null
						}
						className="mb-4"
					/>
					{total === 0 && (
						<Empty title="No show to watch next">
							Want to See on a show puts it here to start, with how long it is
							and where it streams. Once you mark an episode watched on a show's
							page, its next episode leads this list.
						</Empty>
					)}
					{total + data.waiting.length > 0 && (
						<ol
							className={`flex flex-col gap-2.5 ${total === 0 ? "mt-4" : ""}`}
						>
							{continues.length > 0 && (
								<GroupLabel
									id="continue"
									name="Continue"
									rule="last watched first"
									count={continues.length}
								/>
							)}
							{continues.map((row, i) => (
								<Row
									key={row.id}
									row={row}
									n={i + 1}
									big={i === 0}
									newOn={newOn.get(row.id)}
								/>
							))}
							<WaitingRow rows={data.waiting} today={today} />
							{pickUps.length > 0 && (
								<GroupLabel
									id="pick-up"
									name="Pick up"
									rule={`not watched for ${ACTIVE_DAYS} days`}
									count={data.pickUp.length}
								/>
							)}
							{pickUps.map((row, i) => (
								<Row
									key={row.id}
									row={row}
									n={continues.length + i + 1}
									big={!continues.length && i === 0}
									newOn={newOn.get(row.id)}
								/>
							))}
							{pickUpLeft > 0 && (
								<li>
									<button
										type="button"
										data-more-pick-up
										onClick={() => setPickUpShown(pickUpShown + START_STEP)}
										className="h-11 cursor-pointer rounded-lg bg-white/5 px-4 text-sm font-bold text-gray-300 hover:bg-white/10"
									>
										Show {Math.min(pickUpLeft, START_STEP)} more{" "}
										<span className="font-medium text-gray-500">
											· {pickUpLeft} left
										</span>
									</button>
								</li>
							)}
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
									n={continues.length + pickUps.length + i + 1}
									big={!continues.length && !pickUps.length && i === 0}
									newOn={newOn.get(row.id)}
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
						aria-label="Shows you set aside"
						data-quiet
					>
						<QuietGroup
							id="on-hold"
							title="On hold"
							rows={data.onHold}
							fact={lastWatch}
							newOn={newOn}
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
