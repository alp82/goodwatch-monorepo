// PROTOTYPE - throwaway. My shows under each shows variant of /prototype/watching-2 (#371): one page for the two
// things a person comes to a show for, to continue one or to start one.
//   A lead:   Continue leads as a hero with the other Next episodes beside it; Start a show follows as cards.
//   B switch: a Continue | Start switch at the top. Continue is a list, Start is a hero and a table of what each costs.
//   C ranked: one numbered list for tonight that mixes Next episodes and shows to start, each with a tag.
// Every variant ends with the same quiet groups: not watched for 30 days, Waiting for episodes, On hold.
import { type ReactNode, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Collapsed, NewBadge, Progress, QuietRow, WatchedButton, episodeFacts } from "~/ui/prototype-watching/kit"
import { type Entry, QUIET_DAYS, type Store, ago, aired, code, img, isNew } from "~/ui/prototype-watching/model"
import { DISPLAY, EASE, WRAP } from "~/ui/watch-next/style"
import { Cost, Empty, Ended, MoodDots, PageHead, Segmented, ServiceLine, ServiceTile, SortSelect, Tag, WatchOn } from "./bits"
import { type Choice, type Facts, type Go, START_SORTS, type StartSort, continueOf, costLine, plural, startsOf } from "./model"

type Props = { store: Store; facts: Record<string, Facts>; choice: Choice; go: Go; mode: "continue" | "start"; setMode: (mode: "continue" | "start") => void }

/** The backdrop frame the heroes share, after ui/watch-next/WatchNextHero. */
function Stage({ backdrop, id, children, aside, top }: { backdrop: string | null; id: string; children: ReactNode; aside?: ReactNode; top?: ReactNode }) {
	return (
		<section className="relative isolate overflow-hidden" data-hero={id}>
			<AnimatePresence mode="popLayout" initial={false}>
				{backdrop && (
					<motion.img
						key={backdrop}
						src={img(backdrop, "w1280")}
						alt=""
						initial={{ opacity: 0, scale: 1.05 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.8, ease: EASE }}
						className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]"
					/>
				)}
			</AnimatePresence>
			<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-900 via-gray-900/70 to-gray-900/10 md:bg-linear-to-r md:from-gray-900 md:via-gray-900/75 md:to-transparent" />
			<div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-t from-gray-900 to-transparent" />
			<div className="absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-b from-gray-900 to-transparent" />
			{top && <div className={`${WRAP} relative z-20 pt-2`}>{top}</div>}
			<div className={`${WRAP} grid min-h-[26rem] items-end gap-6 pb-8 pt-20 md:min-h-[30rem] md:grid-cols-[1fr_auto] md:items-center md:gap-10 md:pt-8`}>
				<div className="min-w-0 max-w-2xl">{children}</div>
				{aside}
			</div>
		</section>
	)
}

const titleSize = (title: string) => (title.length > 22 ? "text-4xl md:text-6xl" : title.length > 12 ? "text-5xl md:text-7xl" : "text-5xl md:text-7xl lg:text-8xl")
const ghost = "inline-flex h-12 cursor-pointer items-center rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10"

/** The Next episode, large. */
function EpisodeHero({ entry, store, eyebrow, aside, top }: { entry: Entry; store: Store; eyebrow: string; aside?: ReactNode; top?: ReactNode }) {
	const { show, next } = entry
	if (!next) return null
	return (
		<Stage backdrop={show.backdrop} id={show.key} aside={aside} top={top}>
			<motion.div key={`${show.key}:${entry.track.watched}`} initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: EASE }}>
				<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
					<span className="text-amber-300">{eyebrow}</span>
					<span className="text-gray-300">{entry.kind === "seenNew" ? `${entry.left} new since you saw it` : `last watched ${ago(entry.track.lastWatch)}`}</span>
				</p>
				<h2 className={`${DISPLAY} mt-1 leading-[0.9] text-white ${titleSize(show.title)}`}>{show.title}</h2>
				<p className="mt-3 flex flex-wrap items-center gap-2 text-xl font-bold text-white md:text-2xl" data-episode>
					{code(next)} · {next.name}
					{isNew(store.today, next) && <NewBadge />}
				</p>
				<p className="mt-1 text-sm text-gray-400">{[aired(store.today, next), show.runtime ? `${show.runtime} min` : null, `${entry.done} of ${show.total} episodes watched`].filter(Boolean).join(" · ")}</p>
				<Progress entry={entry} className="mt-3 max-w-xs" />
				<div className="mt-5">
					<ServiceTile title={show} />
				</div>
				<div className="mt-6 flex flex-wrap items-center gap-2">
					<WatchOn title={show} />
					<WatchedButton entry={entry} store={store} className="!h-12 !px-4 !text-base backdrop-blur" />
					<button type="button" onClick={() => store.pass(show.key)} className={ghost} data-pass>
						Not tonight
					</button>
				</div>
			</motion.div>
		</Stage>
	)
}

/** A show to start, large: what it is and what it costs. */
function StartHero({ entry, store, facts, eyebrow, aside, top }: { entry: Entry; store: Store; facts: Record<string, Facts>; eyebrow: string; aside?: ReactNode; top?: ReactNode }) {
	const { show } = entry
	const f = facts[show.key]
	return (
		<Stage backdrop={show.backdrop} id={show.key} aside={aside} top={top}>
			<motion.div key={show.key} initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: EASE }}>
				<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
					<span className="text-amber-300">{eyebrow}</span>
					<span className="text-gray-300">{show.match}% taste match</span>
				</p>
				<h2 className={`${DISPLAY} mt-1 leading-[0.9] text-white ${titleSize(show.title)}`}>{show.title}</h2>
				{show.tagline && <p className="mt-3 text-base text-gray-200 md:text-lg">{show.tagline}</p>}
				<div className="mt-5">
					<Cost facts={f} runtime={show.runtime} size="lg" />
				</div>
				<div className="mt-5 flex flex-wrap items-center gap-3">
					<ServiceTile title={show} mine={f?.mine} />
					{f && <MoodDots moods={f.moods} className="text-sm text-gray-300" />}
				</div>
				<div className="mt-6 flex flex-wrap items-center gap-2">
					<WatchOn title={show} />
					<WatchedButton entry={entry} store={store} className="!h-12 !px-4 !text-base backdrop-blur" />
					<button type="button" onClick={() => store.pass(show.key)} className={ghost} data-pass>
						Not tonight
					</button>
				</div>
			</motion.div>
		</Stage>
	)
}

/** The column beside a hero: the next few, each one tap from watched. */
function Beside({ title, entries, store, facts }: { title: string; entries: Entry[]; store: Store; facts: Record<string, Facts> }) {
	if (!entries.length) return null
	return (
		<div className="min-w-0" data-beside>
			<p className="mb-2 text-sm font-semibold text-gray-300">{title}</p>
			<ol className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:w-[22rem] md:flex-col md:overflow-visible md:px-0">
				{entries.map((e) => (
					<li key={e.show.key} className="w-64 shrink-0 md:w-auto" data-card={e.show.key}>
						<div className="flex items-center gap-3 rounded-lg bg-black/50 p-1.5 backdrop-blur-md">
							<img src={img(e.show.poster, "w185")} alt="" className="h-20 w-[54px] shrink-0 rounded-md object-cover" />
							<span className="min-w-0 flex-1">
								<span className="flex items-center gap-1.5">
									<span className="truncate text-sm font-bold text-white">{e.show.title}</span>
									{isNew(store.today, e.next) && <NewBadge />}
									{e.kind === "seenNew" && <Tag kind="seen">Seen</Tag>}
								</span>
								<span className="block truncate text-xs text-gray-200">{e.track.status === null ? costLine(facts[e.show.key]) : e.next ? `${code(e.next)} · ${e.next.name}` : ""}</span>
								<span className="block truncate text-xs text-gray-500">
									{e.track.status === null ? (facts[e.show.key]?.ended ? "Has ended" : "Still running") : e.kind === "seenNew" ? `${e.left} new` : `Last watched ${ago(e.track.lastWatch)}`}
								</span>
							</span>
							<WatchedButton entry={e} store={store} label="none" />
						</div>
					</li>
				))}
			</ol>
		</div>
	)
}

/** A Next episode as a card with the show's backdrop: never the episode's still. */
function EpisodeCard({ entry, store }: { entry: Entry; store: Store }) {
	const { show, next } = entry
	if (!next) return null
	return (
		<li className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-white/[0.05] ring-1 ring-white/10" data-card={show.key}>
			<div className="relative">
				<img src={img(show.backdrop, "w500")} alt="" loading="lazy" className="aspect-video w-full object-cover" />
				<span className="absolute inset-0 bg-linear-to-t from-gray-950/90 to-transparent" />
				<span className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
					<b className="min-w-0 truncate text-base text-white">{show.title}</b>
					{isNew(store.today, next) && <NewBadge />}
				</span>
				{entry.kind === "seenNew" && <Tag kind="seen" className="absolute left-2 top-2">Seen · {entry.left} new</Tag>}
			</div>
			<div className="flex flex-1 flex-col gap-1.5 p-3">
				<p className="truncate text-sm font-bold text-white">
					{code(next)} · <span className="font-medium text-gray-200">{next.name}</span>
				</p>
				<p className="truncate text-xs text-gray-400">{episodeFacts(store.today, entry)}</p>
				<Progress entry={entry} className="mt-1" />
				<WatchedButton entry={entry} store={store} className="mt-2 w-full" />
			</div>
		</li>
	)
}

/** A show to start as a card: the poster, then what starting costs. */
function StartCard({ entry, store, facts }: { entry: Entry; store: Store; facts: Record<string, Facts> }) {
	const { show } = entry
	const f = facts[show.key]
	return (
		<li className="flex min-w-0 gap-4 rounded-xl bg-white/[0.05] p-3 ring-1 ring-white/10" data-start={show.key}>
			<img src={img(show.poster, "w342")} alt="" loading="lazy" className="aspect-[2/3] w-24 shrink-0 self-start rounded-lg object-cover sm:w-28" />
			<div className="flex min-w-0 flex-1 flex-col">
				<p className="truncate text-lg font-bold leading-tight text-white">{show.title}</p>
				<p className="truncate text-xs text-gray-400">{[show.year, `${show.match}% taste match`].filter(Boolean).join(" · ")}</p>
				<div className="mt-3">
					<Cost facts={f} runtime={show.runtime} />
				</div>
				<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
					<ServiceLine title={show} mine={f?.mine} />
					{f && <MoodDots moods={f.moods} className="text-gray-400" />}
				</div>
				<span className="grow" />
				<WatchedButton entry={entry} store={store} className="mt-3 self-start" />
			</div>
		</li>
	)
}

/** Shows with nothing to pick tonight: not watched for 30 days (closed), waiting for episodes, On hold (closed). */
function Quiet({ store }: { store: Store }) {
	const c = continueOf(store)
	if (!c.quiet.length && !c.waiting.length && !c.onHold.length) return null
	const rows = (entries: Entry[]) => (
		<ul className="grid gap-2 md:grid-cols-2">
			{entries.map((e) => (
				<QuietRow key={e.show.key} entry={e} store={store} />
			))}
		</ul>
	)
	return (
		<section className="flex flex-col gap-4 border-t border-white/5 pt-6" aria-label="Shows with nothing for tonight" data-quiet>
			<Collapsed title={`Not watched for ${QUIET_DAYS} days`} count={c.quiet.length}>
				{rows(c.quiet)}
			</Collapsed>
			{c.waiting.length > 0 && (
				<div data-group="Waiting for episodes">
					<h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-300">
						Waiting for episodes <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums">{c.waiting.length}</span>
					</h3>
					{rows(c.waiting)}
				</div>
			)}
			<Collapsed title="On hold" count={c.onHold.length}>
				{rows(c.onHold)}
			</Collapsed>
		</section>
	)
}

const H2 = ({ children, note, right, id }: { children: ReactNode; note?: string; right?: ReactNode; id?: string }) => (
	<div className="mb-4 flex scroll-mt-24 flex-wrap items-end gap-x-4 gap-y-2" id={id}>
		<div className="min-w-0">
			<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>{children}</h2>
			{note && <p className="mt-1 text-sm text-gray-400">{note}</p>}
		</div>
		<span className="grow" />
		{right}
	</div>
)

const headLine = (store: Store) => {
	const c = continueOf(store)
	const n = c.lively.length + c.quiet.length
	const starts = store.wishlist.filter((t) => t.type === "show").length
	return [n ? `${n} with a Next episode` : "Nothing in progress", `${starts} to start`].join(" · ")
}

const NothingToStart = () => (
	<Empty title="No show to start">Want to See on a show puts it here, with how long it is and where it streams.</Empty>
)

// ---------------------------------------------------------------------------------------------------------
// A: Continue leads, Start follows.

function LeadPage({ store, facts, choice, go, mode }: Props) {
	const c = continueOf(store)
	// Arriving to start a show (home's Start door) lands on the start list.
	useEffect(() => {
		if (mode === "start") document.getElementById("start")?.scrollIntoView({ block: "start" })
	}, [mode])
	const [sort, setSort] = useState<StartSort>("match")
	const [all, setAll] = useState(false)
	const starts = startsOf(store, facts, sort)
	const lead = c.lively[0] ?? c.quiet[0]
	// With a show in progress the hero is its Next episode; otherwise it is the best show to start.
	const rest = lead ? c.lively.filter((e) => e !== lead) : []
	const more = rest.slice(3)
	const heroStart = lead ? null : starts[0]
	const cards = heroStart ? starts.slice(1) : starts
	return (
		<>
			<PageHead name="My shows" line={headLine(store)} whole={`${headLine(store)} · every show you want to see is here`} store={store} choice={choice} go={go} />
			{lead ? (
				<EpisodeHero entry={lead} store={store} eyebrow="Next episode" aside={<Beside title="Also watching" entries={rest.slice(0, 3)} store={store} facts={facts} />} />
			) : heroStart ? (
				<StartHero entry={heroStart} store={store} facts={facts} eyebrow="You are not in the middle of a show. Start one?" />
			) : (
				<div className={WRAP}>
					<NothingToStart />
				</div>
			)}
			<div className={`${WRAP} flex flex-col gap-12 pt-8`}>
				{more.length > 0 && (
					<section data-section="more">
						<H2 note="Watched in the last 30 days, most recent first, then shows you have Seen with new episodes.">More next episodes</H2>
						<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
							{(all ? more : more.slice(0, 4)).map((e) => (
								<EpisodeCard key={e.show.key} entry={e} store={store} />
							))}
						</ul>
						{more.length > 4 && !all && (
							<button type="button" onClick={() => setAll(true)} className="mt-3 h-10 cursor-pointer rounded-lg bg-white/5 px-4 text-sm font-bold text-gray-300 hover:bg-white/10">
								{more.length - 4} more
							</button>
						)}
					</section>
				)}
				{cards.length > 0 && (
					<section data-section="start">
						<H2 note="Shows you want to see and have not started, with what each one asks of you." right={<SortSelect value={sort} onChange={setSort} options={START_SORTS} />} id="start">
							Start a show
						</H2>
						<ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							{cards.map((e) => (
								<StartCard key={e.show.key} entry={e} store={store} facts={facts} />
							))}
						</ul>
					</section>
				)}
				<Quiet store={store} />
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// B: a Continue | Start switch.

function ContinueRow({ entry, store }: { entry: Entry; store: Store }) {
	const { show, next } = entry
	return (
		<li className="flex items-center gap-3 border-b border-white/5 py-3 md:gap-5" data-row={show.key} data-kind={entry.kind}>
			<img src={img(show.poster, "w185")} alt="" loading="lazy" className="h-[84px] w-14 shrink-0 rounded-md object-cover" />
			<div className="min-w-0 flex-1">
				<p className="flex items-center gap-2 text-base font-bold text-white md:text-lg">
					<span className="truncate">{show.title}</span>
					{isNew(store.today, next) && <NewBadge />}
					{entry.kind === "seenNew" && <Tag kind="seen">Seen</Tag>}
				</p>
				{next && (
					<p className="truncate text-sm text-gray-200">
						<b>{code(next)}</b> · {next.name}
					</p>
				)}
				<p className="truncate text-xs text-gray-400">{episodeFacts(store.today, entry)}</p>
			</div>
			<div className="hidden w-36 shrink-0 lg:block">
				<Progress entry={entry} />
				<p className="mt-1 text-xs tabular-nums text-gray-500">
					{entry.done} of {show.total} episodes
				</p>
			</div>
			<span className="hidden w-32 shrink-0 text-xs xl:block">
				<ServiceLine title={show} />
			</span>
			{entry.kind === "next" && (
				<button type="button" onClick={() => store.setStatus(show.key, "on-hold")} className="hidden h-10 shrink-0 cursor-pointer rounded-lg px-3 text-sm font-semibold text-gray-400 hover:bg-white/10 md:block">
					On hold
				</button>
			)}
			<span className="hidden sm:block">
				<WatchedButton entry={entry} store={store} />
			</span>
			<span className="sm:hidden">
				<WatchedButton entry={entry} store={store} label="none" />
			</span>
		</li>
	)
}

function StartTable({ entries, store, facts }: { entries: Entry[]; store: Store; facts: Record<string, Facts> }) {
	const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
	return (
		<>
			<table className="hidden w-full border-collapse md:table" data-start-table>
				<thead>
					<tr className="border-b border-white/10">
						<th className={th}>Show</th>
						<th className={`${th} text-right`}>Seasons</th>
						<th className={`${th} text-right`}>Episodes</th>
						<th className={`${th} text-right`}>In all</th>
						<th className={th}>Status</th>
						<th className={th}>Streams on</th>
						<th className={`${th} text-right`}>Match</th>
						<th className={th} />
					</tr>
				</thead>
				<tbody>
					{entries.map((e) => {
						const f = facts[e.show.key]
						return (
							<tr key={e.show.key} className="border-b border-white/5 hover:bg-white/[0.03]" data-start={e.show.key}>
								<td className="px-3 py-2">
									<span className="flex items-center gap-3">
										<img src={img(e.show.poster, "w92")} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded object-cover" />
										<span className="min-w-0">
											<b className="block truncate text-base text-white">{e.show.title}</b>
											{f && <MoodDots moods={f.moods} className="text-xs text-gray-400" />}
										</span>
									</span>
								</td>
								<td className={`${DISPLAY} px-3 text-right text-2xl text-white`}>{f?.seasons}</td>
								<td className={`${DISPLAY} px-3 text-right text-2xl text-white`}>{f?.episodes}</td>
								<td className="px-3 text-right text-sm tabular-nums text-gray-200">
									{f?.hours ? `${f.hours} h` : ""}
									<span className="block text-xs text-gray-500">{e.show.runtime ? `${e.show.runtime} min each` : ""}</span>
								</td>
								<td className="px-3">{f && <Ended facts={f} />}</td>
								<td className="px-3 text-sm">
									<ServiceLine title={e.show} mine={f?.mine} />
								</td>
								<td className="px-3 text-right text-sm font-bold tabular-nums text-amber-300">{e.show.match}%</td>
								<td className="py-2 pl-3 text-right">
									<WatchedButton entry={e} store={store} />
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
			<ul className="grid gap-3 md:hidden">
				{entries.map((e) => (
					<StartCard key={e.show.key} entry={e} store={store} facts={facts} />
				))}
			</ul>
		</>
	)
}

function SwitchPage({ store, facts, choice, go, mode, setMode }: Props) {
	const c = continueOf(store)
	const [sort, setSort] = useState<StartSort>("match")
	const starts = startsOf(store, facts, sort)
	const watching = c.lively.filter((e) => e.kind === "next")
	const seenNew = c.lively.filter((e) => e.kind === "seenNew")
	const inProgress = c.lively.length + c.quiet.length
	// Someone with nothing in progress lands on Start.
	const shown = mode === "continue" && !inProgress && !c.waiting.length && !c.onHold.length ? "start" : mode
	const list = (title: string, note: string, entries: Entry[]) =>
		entries.length > 0 && (
			<section data-group={title}>
				<h2 className="flex items-baseline gap-3">
					<span className={`${DISPLAY} text-2xl text-white`}>{title}</span>
					<span className="text-sm text-gray-400">{note}</span>
				</h2>
				<ul className="mt-1">
					{entries.map((e) => (
						<ContinueRow key={e.show.key} entry={e} store={store} />
					))}
				</ul>
			</section>
		)
	return (
		<>
			<PageHead name="My shows" line={headLine(store)} whole={`${headLine(store)} · every show you want to see is under Start`} store={store} choice={choice} go={go} />
			<div className={`${WRAP} pb-2`}>
				<Segmented
					label="Continue or start"
					size="lg"
					value={shown}
					onChange={setMode}
					options={[
						{ key: "continue", label: "Continue", count: inProgress },
						{ key: "start", label: "Start a show", count: starts.length },
					]}
				/>
			</div>
			{shown === "continue" ? (
				<div className={`${WRAP} flex flex-col gap-10 pt-6`} data-mode="continue">
					{!inProgress && <Empty title="Nothing in progress">Mark an episode watched and its show appears here with its Next episode.</Empty>}
					{list("Next episode", `${plural(watching.length, "show")}, last watched first`, watching)}
					{list("New episodes", "of shows you have Seen", seenNew)}
					<Quiet store={store} />
				</div>
			) : (
				<div data-mode="start">
					{starts[0] ? (
						<StartHero
							entry={starts[0]}
							store={store}
							facts={facts}
							eyebrow={sort === "short" ? "The shortest on your list" : sort === "top" ? "Top rated on your list" : "Best match to start tonight"}
							aside={<Beside title="Then" entries={starts.slice(1, 4)} store={store} facts={facts} />}
						/>
					) : (
						<div className={`${WRAP} pt-6`}>
							<NothingToStart />
						</div>
					)}
					{starts.length > 1 && (
						<div className={`${WRAP} pt-8`}>
							<H2 note="What each one asks of you, side by side." right={<SortSelect value={sort} onChange={setSort} options={START_SORTS} />}>
								All {starts.length} to start
							</H2>
							<StartTable entries={starts} store={store} facts={facts} />
						</div>
					)}
				</div>
			)}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// C: one list for tonight.

function RankedRow({ entry, n, store, facts, big }: { entry: Entry; n: number; store: Store; facts: Record<string, Facts>; big?: boolean }) {
	const { show, next } = entry
	const start = entry.track.status === null
	const f = facts[show.key]
	return (
		<motion.li
			layout="position"
			transition={{ duration: 0.3, ease: EASE }}
			className={`relative flex items-stretch gap-3 overflow-hidden rounded-2xl ring-1 ring-white/10 md:gap-5 ${big ? "bg-white/[0.07]" : "bg-white/[0.04]"}`}
			data-row={show.key}
			data-tag={start ? "start" : entry.kind}
		>
			<span className={`${DISPLAY} flex w-9 shrink-0 items-center justify-center text-3xl text-white/25 md:w-14 md:text-5xl`} aria-hidden>
				{n}
			</span>
			<span className={`relative hidden shrink-0 self-stretch sm:block ${big ? "w-64" : "w-44"}`}>
				<img src={img(show.backdrop, "w500")} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
			</span>
			<img src={img(show.poster, "w185")} alt="" loading="lazy" className="my-3 h-24 w-16 shrink-0 rounded-md object-cover sm:hidden" />
			<div className={`flex min-w-0 flex-1 flex-col justify-center ${big ? "py-5" : "py-3"}`}>
				<p className="flex flex-wrap items-center gap-1.5">
					{start ? <Tag kind="start">Start</Tag> : entry.kind === "seenNew" ? <Tag kind="seen">New episodes</Tag> : <Tag kind="next">Next episode</Tag>}
					{isNew(store.today, next) && !start && <NewBadge />}
				</p>
				<p className={`mt-1 truncate font-bold text-white ${big ? `${DISPLAY} text-3xl md:text-4xl` : "text-lg"}`}>{show.title}</p>
				<p className="truncate text-sm text-gray-200">{start ? costLine(f) : next ? `${code(next)} · ${next.name}` : ""}</p>
				<p className="truncate text-xs text-gray-400">
					{start ? [f?.ended ? "Has ended" : "Still running", `${show.match}% taste match`, show.service ? `on ${show.service.name}` : "not on your services"].join(" · ") : episodeFacts(store.today, entry)}
				</p>
				{!start && big && <Progress entry={entry} className="mt-2 max-w-xs" />}
			</div>
			<div className="flex shrink-0 items-center pr-3 md:pr-4">
				<span className="hidden md:block">
					<WatchedButton entry={entry} store={store} />
				</span>
				<span className="md:hidden">
					<WatchedButton entry={entry} store={store} label="none" />
				</span>
			</div>
		</motion.li>
	)
}

/** Recently watched shows first; a show to start after every third. */
export function rankedOf(store: Store, facts: Record<string, Facts>): Entry[] {
	const c = continueOf(store)
	const starts = startsOf(store, facts)
	const out: Entry[] = []
	let s = 0
	c.lively.forEach((e, i) => {
		out.push(e)
		if (i % 3 === 2 && starts[s]) out.push(starts[s++])
	})
	return [...out, ...starts.slice(s)]
}

function RankedPage({ store, facts, choice, go }: Props) {
	const list = rankedOf(store, facts)
	const [all, setAll] = useState(false)
	const shown = all ? list : list.slice(0, 10)
	return (
		<>
			<PageHead name="My shows" line={headLine(store)} whole={`${headLine(store)} · every show you want to see is in this list`} store={store} choice={choice} go={go} />
			<div className={`${WRAP} flex flex-col gap-10 pt-2`}>
				<section data-section="tonight">
					<H2 note="The shows you watched most recently first, and after every third a show to start, best match first.">Tonight</H2>
					{list.length === 0 ? (
						<NothingToStart />
					) : (
						<ol className="flex flex-col gap-2.5">
							{shown.map((e, i) => (
								<RankedRow key={e.show.key} entry={e} n={i + 1} store={store} facts={facts} big={i === 0} />
							))}
						</ol>
					)}
					{list.length > shown.length && (
						<button type="button" onClick={() => setAll(true)} className="mt-3 h-10 cursor-pointer rounded-lg bg-white/5 px-4 text-sm font-bold text-gray-300 hover:bg-white/10">
							{list.length - shown.length} more
						</button>
					)}
				</section>
				<Quiet store={store} />
			</div>
		</>
	)
}

export function ShowsPage(props: Props) {
	const Page = props.choice.shows === "lead" ? LeadPage : props.choice.shows === "switch" ? SwitchPage : RankedPage
	return (
		<div className="overflow-x-clip pb-40" data-shows={props.choice.shows}>
			<Page {...props} />
		</div>
	)
}
