// PROTOTYPE - throwaway. My shows for /prototype/arrival-mark: the list as it is built (ui/my-shows/MyShowsPage.tsx,
// copied, not imported, so that the real page stays untouched) without the waiting row and the shows set aside, and
// with what each variation adds. A row opens the show's page in the real thing; here it only counts as opened.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import { LandedNote } from "~/ui/my-pages/LandedNote"
import {
	DISPLAY,
	MY_LIBRARY,
	MY_MOVIES,
	PageHead,
	Poster,
	WRAP,
	tmdbImage,
} from "~/ui/my-pages/bits"
import { type Mark, SERVICES, SHOWS, type Show, lineOf } from "./model"
import {
	Chip,
	type Ctx,
	DotD,
	LineC,
	LogRow,
	Shelf,
	StickerB,
	TagA,
	opens,
} from "./parts"

const TAG = {
	next: "bg-amber-400 text-black",
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

const airedWords = (days: number) =>
	days <= 0
		? "Aired today"
		: days === 1
			? "Aired yesterday"
			: days < 7
				? `Aired ${days} days ago`
				: null

/** Whether the show's Next episode is new, as the real page's "New" beside the tag. */
const freshEpisode = (show: Show, day: number) =>
	show.next !== undefined && show.next.aired + day < 7

function Row({
	show,
	n,
	big,
	ctx,
}: { show: Show; n: number; big: boolean; ctx: Ctx }) {
	const { variant } = ctx
	const mark: Mark | undefined = ctx.marks.get(show.key)
	const fresh = freshEpisode(show, ctx.day)
	const service = show.on[0]
	const starts = show.group === "start"
	const line = starts ? show.cost : `${show.next?.code} · ${show.next?.name}`
	const meta = starts
		? [
				show.running ? "Still running" : "Has ended",
				service ? `on ${SERVICES[service].name}` : null,
			]
		: [
				show.progress,
				"48 min",
				show.next ? airedWords(show.next.aired + ctx.day) : null,
			]
	const why = starts ? `${show.match}% taste match` : (show.lastWatch ?? "")
	// C: the landing is the fact that places the row while it is fresh, and one more fact in its last line after.
	const fact =
		mark && variant === "C" && mark.state === "fresh" ? (
			<LineC mark={mark} />
		) : (
			why
		)
	return (
		<li data-row={show.key}>
			<a
				href="#title"
				{...opens(ctx, show.key)}
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
						src={tmdbImage(show.backdrop, "w500")}
						alt=""
						loading="lazy"
						className="absolute inset-0 h-full w-full object-cover"
					/>
					{mark && variant === "B" && (
						<StickerB mark={mark} className="absolute left-2 top-2" />
					)}
				</span>
				<span className="relative my-3 shrink-0 sm:hidden">
					<Poster
						path={show.poster}
						size="w185"
						className="h-24 w-16 rounded-md"
					/>
					{mark && variant === "B" && (
						<StickerB
							mark={mark}
							small
							className="absolute -left-1.5 -top-1.5"
						/>
					)}
				</span>
				<span
					className={`flex min-w-0 flex-1 flex-col justify-center ${big ? "py-5" : "py-3"}`}
				>
					<span className="flex min-w-0 flex-wrap items-center gap-1.5">
						<Tag kind={starts ? "start" : "next"}>
							{starts ? "Start" : "Next episode"}
						</Tag>
						{fresh && (
							<span className="rounded bg-white/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
								New
							</span>
						)}
						{mark && variant === "A" && <TagA mark={mark} />}
					</span>
					<span
						className={`mt-1 flex min-w-0 items-center gap-2 font-bold text-white ${big ? `${DISPLAY} text-3xl md:text-4xl` : "text-lg"}`}
					>
						{mark && variant === "D" && <DotD mark={mark} />}
						<span className="truncate">{show.title}</span>
					</span>
					<span className="truncate text-sm text-gray-200">{line}</span>
					<span className="truncate text-xs text-gray-400">
						<b className="font-semibold text-gray-300 md:hidden">{fact} · </b>
						{meta.filter(Boolean).join(" · ")}
						{mark && variant === "C" && mark.state === "quiet" && (
							<> · {lineOf(mark)}</>
						)}
					</span>
				</span>
				<span className="hidden w-44 shrink-0 items-center justify-end text-right text-sm font-semibold text-gray-300 md:flex">
					{fact}
				</span>
				<span className="flex shrink-0 items-center pr-2 md:pr-4">
					<ChevronRightIcon
						className="h-5 w-5 text-gray-500 transition-colors group-hover:text-amber-300"
						aria-hidden
					/>
				</span>
			</a>
		</li>
	)
}

const GroupLabel = ({
	name,
	rule,
	count,
	sky,
}: { name: string; rule: string; count: number; sky?: boolean }) => (
	<li
		className="flex items-baseline gap-2 px-1 pt-3 first:pt-0"
		data-group-label={name}
	>
		<h3
			className={`text-xs font-black uppercase tracking-[0.18em] ${sky ? "text-sky-300" : "text-amber-300"}`}
		>
			{name}
		</h3>
		<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-300">
			{count}
		</span>
		<span className="truncate text-xs text-gray-400">{rule}</span>
	</li>
)

export function ShowsPage({ ctx }: { ctx: Ctx }) {
	const { variant, marks } = ctx
	const marked = (show: Show) => marks.has(show.key)
	const shown = variant === "B" && ctx.only ? SHOWS.filter(marked) : SHOWS
	// C: a show to start that landed leads the list while its landing is fresh. A show in progress keeps its place.
	const justArrived =
		variant === "C"
			? shown
					.filter(
						(show) =>
							show.group === "start" && marks.get(show.key)?.state === "fresh",
					)
					.sort(
						(a, b) =>
							(marks.get(a.key)?.age ?? 0) - (marks.get(b.key)?.age ?? 0),
					)
			: []
	const continues = shown.filter((show) => show.group === "continue")
	const starts = shown
		.filter((show) => show.group === "start" && !justArrived.includes(show))
		.sort((a, b) => b.match - a.match)
	const episodeOf = (key: string) => {
		const show = SHOWS.find((s) => s.key === key)
		return show && freshEpisode(show, ctx.day)
			? (show.next?.code ?? null)
			: null
	}
	const landed = [...marks.values()].filter((m) => m.title.kind === "show")
	let n = 0
	return (
		<div className="overflow-x-clip pb-40" data-my-shows>
			<PageHead
				name="My shows"
				line={`${SHOWS.filter((s) => s.group === "continue").length} to continue · ${SHOWS.filter((s) => s.group === "start").length} to start`}
				links={[
					{ label: "My movies", to: MY_MOVIES },
					{ label: "My library", to: MY_LIBRARY },
				]}
			/>
			<div className={`${WRAP} flex flex-col gap-8 pt-2`}>
				{variant === "A" && (
					<Shelf ctx={ctx} kind="show" episodeOf={episodeOf} />
				)}
				<section>
					<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>
						Tonight
					</h2>
					{ctx.firstVisit && (
						<LandedNote
							kind="show"
							landed={
								landed.length
									? {
											count: landed.length,
											titles: landed
												.slice(0, 3)
												.map((mark) => mark.title.title),
											service: SERVICES[landed[0].on[0]].name,
										}
									: null
							}
							className="mt-2"
						/>
					)}
					<p className="mb-4 mt-1 max-w-3xl text-sm text-gray-400">
						{justArrived.length > 0 && (
							<>
								<b className="font-bold text-sky-200">Just arrived</b> comes
								first: shows you want to see that are new on your services. Then{" "}
							</>
						)}
						<b className="font-bold text-gray-200">Continue</b>
						{justArrived.length ? ", " : " comes first, "}the show you watched
						last on top. Then <b className="font-bold text-gray-200">Start</b>:
						the shows you want to see, best taste match first. A row opens the
						show.
					</p>
					{variant === "B" && landed.length > 0 && (
						<div className="mb-4 flex items-center gap-3">
							<Chip ctx={ctx} kind="show" />
							{ctx.only && (
								<button
									type="button"
									onClick={() => ctx.setOnly(false)}
									className="cursor-pointer text-sm font-bold text-gray-300 underline decoration-white/30 underline-offset-4"
								>
									Show all {SHOWS.length}
								</button>
							)}
						</div>
					)}
					<ol className="flex flex-col gap-2.5">
						{variant === "D" && landed.length > 0 && (
							<li>
								<LogRow
									ctx={ctx}
									kind="show"
									note={(key) =>
										episodeOf(key) ? " · also a new episode" : null
									}
								/>
							</li>
						)}
						{justArrived.length > 0 && (
							<GroupLabel
								name="Just arrived"
								rule="new on your services, latest first"
								count={justArrived.length}
								sky
							/>
						)}
						{justArrived.map((show) => (
							<Row key={show.key} show={show} n={++n} big={n === 1} ctx={ctx} />
						))}
						{continues.length > 0 && (
							<GroupLabel
								name="Continue"
								rule="last watched first"
								count={continues.length}
							/>
						)}
						{continues.map((show) => (
							<Row key={show.key} show={show} n={++n} big={n === 1} ctx={ctx} />
						))}
						{starts.length > 0 && (
							<GroupLabel
								name="Start"
								rule="best taste match first"
								count={starts.length}
							/>
						)}
						{starts.map((show) => (
							<Row key={show.key} show={show} n={++n} big={n === 1} ctx={ctx} />
						))}
					</ol>
				</section>
			</div>
		</div>
	)
}
