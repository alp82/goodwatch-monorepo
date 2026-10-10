// PROTOTYPE - throwaway. The open question of /prototype/watching-3 (#371): the Wishlist stays a plain page of
// everything behind My shows and My movies (round 2's A), and the member can switch between it and what they have
// already watched. Four ways to do that, `?wishlist=`:
//   A switch:  a two-way switch, Want to see | Seen, over the same poster grid and the same controls.
//   B diary:   the other half is a diary: one row per watch under month heads, with the date as precise as it is
//              known, rewatches as rows of their own, and the watches without a date in a last group.
//   C library: one page, My library, with a status per chip: Want to see, Watching, On hold, Dropped, Seen. The
//              Wishlist is the first chip. Rows, not posters.
//   D page:    no switch. The Wishlist is round 2's plain page; Seen is a page of its own in the navigation, in
//              groups by year watched, score, or letter.
// Each has the Seen sorts (Last watched, My score, Title), a quiet way to the Seen titles without a score, and draws
// a long list in steps, so the member with 1,500 Seen titles gets the same page as the one with 30.
import { ChevronRightIcon } from "@heroicons/react/24/solid"
import { type ReactNode, useMemo, useState } from "react"
import { Progress } from "~/ui/prototype-watching/kit"
import { type Entry, type Title, ago, code, img, waitLine } from "~/ui/prototype-watching/model"
import { Empty, Segmented, SortSelect } from "~/ui/prototype-watching-2/bits"
import { costLine, hm, picksOf, plural } from "~/ui/prototype-watching-2/model"
import { DISPLAY, WRAP } from "~/ui/watch-next/style"
import {
	type DiaryRow,
	type Nav,
	SEEN_SORTS,
	SIDES,
	type SeenItem,
	type SeenSort,
	type Side,
	dayParts,
	diaryOf,
	groupSeen,
	importLine,
	inProgress,
	monthsOf,
	sortSeen,
	statusWord,
	titlePage,
	yearOf,
} from "./model"
import { GRID, KindTag, LinkKey, PageHead, Poster, Score, Search, SeenCard, SeenRow, count, useSteps } from "./seen"

type Kind = "all" | "movie" | "show"
type WantSort = "added" | "waiting" | "match" | "top"
const WANT_SORTS: Record<WantSort, string> = { added: "Last added", waiting: "Waiting longest", match: "Best match", top: "Top rated" }

const has = (q: string) => {
	const needle = q.trim().toLowerCase()
	return (title: string) => !needle || title.toLowerCase().includes(needle)
}
const ofKind = (kind: Kind) => (t: { type: string }) => kind === "all" || t.type === kind

function KindFilter({ kind, setKind, list }: { kind: Kind; setKind: (k: Kind) => void; list: { type: string }[] }) {
	const movies = list.filter((t) => t.type === "movie").length
	return (
		<Segmented
			label="Movies or shows"
			value={kind}
			onChange={setKind}
			options={[
				{ key: "all", label: "All", count: list.length },
				{ key: "movie", label: "Movies", count: movies },
				{ key: "show", label: "Shows", count: list.length - movies },
			]}
		/>
	)
}

/** A small switch that is off by default: "Only not rated", "Shows in progress", "Episodes". */
function Quiet({ on, set, children, id }: { on: boolean; set: (on: boolean) => void; children: ReactNode; id: string }) {
	return (
		<button
			type="button"
			aria-pressed={on}
			data-quiet={id}
			onClick={() => set(!on)}
			className={`inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold ring-1 transition-colors ${on ? "bg-amber-400/15 text-amber-200 ring-amber-400/50" : "text-gray-400 ring-white/10 hover:text-white"}`}
		>
			<span className={`h-2 w-2 rounded-full ${on ? "bg-amber-300" : "bg-white/20"}`} />
			{children}
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The Wishlist half: round 2's plain grid.

function useWant(nav: Nav) {
	const [kind, setKind] = useState<Kind>("all")
	const [sort, setSort] = useState<WantSort>("added")
	const { store, facts } = nav
	const by: Record<WantSort, (t: Title) => number> = {
		added: (t) => facts[t.key]?.added ?? 0,
		waiting: (t) => -(facts[t.key]?.added ?? 0),
		match: (t) => -t.match,
		top: (t) => -(t.score ?? 0),
	}
	const list = store.wishlist.filter(ofKind(kind)).sort((a, b) => by[sort](a) - by[sort](b))
	return { kind, setKind, sort, setSort, list }
}

function WantCards({ nav, list }: { nav: Nav; list: Title[] }) {
	const { facts } = nav
	if (!list.length) return <Empty title="Nothing here yet">Want to See on a title puts it on your Wishlist.</Empty>
	return (
		<ul className={GRID} data-wishlist-grid>
			{list.map((t) => (
				<li key={t.key} className="min-w-0" data-title={t.key}>
					<span className="relative block">
						<Poster t={t} className="aspect-[2/3] w-full rounded-lg ring-1 ring-white/5" />
						<KindTag t={t} className="absolute left-1.5 top-1.5" />
					</span>
					<span className="mt-1.5 block truncate text-sm font-bold text-white">{t.title}</span>
					<span className="block truncate text-xs text-gray-400">{t.type === "show" ? costLine(facts[t.key]).split(" · ").slice(0, 2).join(" · ") : hm(t.runtime)}</span>
					<span className="block truncate text-xs text-gray-500">Added {ago(facts[t.key]?.added ?? null)}</span>
				</li>
			))}
		</ul>
	)
}

function WantHalf({ nav }: { nav: Nav }) {
	const w = useWant(nav)
	return (
		<>
			<div className="flex flex-wrap items-center gap-2" data-controls="want">
				<KindFilter kind={w.kind} setKind={w.setKind} list={nav.store.wishlist} />
				<span className="grow" />
				<SortSelect value={w.sort} onChange={w.setSort} options={WANT_SORTS} />
			</div>
			<WantCards nav={nav} list={w.list} />
		</>
	)
}

/** The two-way switch A and B share. The names of its halves differ. */
function Halves({ nav, want, other, otherCount }: { nav: Nav; want: string; other: string; otherCount: number }) {
	return (
		<Segmented
			label="Wishlist or what you watched"
			size="lg"
			value={nav.side === "want" ? "want" : "seen"}
			onChange={(side: Side) => nav.setSide(side)}
			options={[
				{ key: "want", label: want, count: nav.store.wishlist.length },
				{ key: "seen", label: other, count: otherCount },
			]}
		/>
	)
}

const NothingSeen = () => <Empty title="Nothing Seen yet">A movie you mark as watched, a show you watch through, and every title you rate appears here.</Empty>

// ---------------------------------------------------------------------------------------------------------
// A: a two-way switch over the same grid.

function SwitchPage({ nav }: { nav: Nav }) {
	const { store, seen, side, askRate } = nav
	const [kind, setKind] = useState<Kind>("all")
	const [sort, setSort] = useState<SeenSort>("last")
	const [q, setQ] = useState("")
	const [unrated, setUnrated] = useState(side === "unrated")
	const [withProgress, setWithProgress] = useState(false)
	const { entries } = store
	const progress = useMemo(() => inProgress(entries), [entries])
	// Not rated is a question about Seen titles only.
	const base = useMemo(() => (withProgress && !unrated ? [...progress, ...seen] : seen), [withProgress, unrated, progress, seen])
	const list = useMemo(() => sortSeen(base.filter((s) => ofKind(kind)(s.t) && has(q)(s.t.title) && (!unrated || s.mine == null)), sort), [base, kind, q, unrated, sort])
	const steps = useSteps(list, 70)
	const open = seen.filter((s) => s.mine == null).length
	const onSeen = side !== "want"
	return (
		<div className={`${WRAP} flex flex-col gap-5 pt-6`}>
			<header className="flex flex-wrap items-end gap-x-6 gap-y-3">
				<div className="min-w-0">
					<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>{onSeen ? "Seen" : "Wishlist"}</h1>
					<p className="mt-1 text-sm text-gray-400">{onSeen ? "Every movie and show you have Seen, with when you watched it and your score." : "Everything you want to see, movies and shows together."}</p>
				</div>
				<span className="grow" />
				<Halves nav={nav} want="Want to see" other="Seen" otherCount={seen.length} />
			</header>
			{!onSeen ? (
				<WantHalf nav={nav} />
			) : !seen.length ? (
				<NothingSeen />
			) : (
				<>
					<div className="flex flex-wrap items-center gap-2" data-controls="seen">
						<KindFilter kind={kind} setKind={setKind} list={base.map((s) => s.t)} />
						<Search value={q} onChange={setQ} placeholder="Have I seen…?" />
						<span className="grow" />
						<SortSelect value={sort} onChange={setSort} options={SEEN_SORTS} />
					</div>
					<div className="-mt-2 flex flex-wrap items-center gap-2">
						{open > 0 && (
							<Quiet on={unrated} set={setUnrated} id="unrated">
								{count(open)} not rated yet
							</Quiet>
						)}
						{progress.length > 0 && !unrated && (
							<Quiet on={withProgress} set={setWithProgress} id="progress">
								Shows in progress · {progress.length}
							</Quiet>
						)}
						<span className="text-xs text-gray-500" data-result>
							{count(list.length)} {list.length === 1 ? "title" : "titles"}
						</span>
					</div>
					{list.length ? (
						<ul className={GRID} data-seen-grid>
							{steps.shown.map((s) => (
								<SeenCard key={s.id} item={s} today={store.today} askRate={askRate} />
							))}
						</ul>
					) : (
						<p className="text-sm text-gray-400">Nothing you have Seen matches.</p>
					)}
					{steps.more}
				</>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// B: the other half is a diary.

function DiaryLine({ row, nav }: { row: DiaryRow; nav: Nav }) {
	const parts = dayParts(nav.store.today, row.watch)
	const imported = importLine(row.watch)
	return (
		<li className="grid grid-cols-[2.75rem_2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/5 py-2" data-watch={row.id} data-precision={row.watch.days == null ? "unknown" : row.watch.time ? "moment" : "day"}>
			<span className="text-center leading-none">
				{parts ? (
					<>
						<b className={`${DISPLAY} block text-2xl text-white`}>{parts.day}</b>
						<span className="text-[11px] uppercase tracking-wide text-gray-500">{parts.weekday}</span>
					</>
				) : (
					<span className="text-lg text-gray-600">?</span>
				)}
			</span>
			<Poster t={row.t} size="w92" className="h-[60px] w-10 rounded" />
			<span className="min-w-0">
				<span className="flex min-w-0 items-center gap-2">
					<b className="truncate text-sm text-white md:text-base">{row.t.title}</b>
					{row.rewatch && <span className="shrink-0 rounded bg-fuchsia-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-200">Rewatch</span>}
				</span>
				<span className="block truncate text-xs text-gray-400">{[row.watch.time, row.note ?? (row.t.type === "show" ? "Show" : null), row.t.year].filter(Boolean).join(" · ")}</span>
				{imported && <span className="block truncate text-xs text-gray-500">{imported}</span>}
			</span>
			<span className="flex w-14 justify-end">
				{row.item ? <Score item={row.item} askRate={nav.askRate} /> : <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-300/80">Episode</span>}
			</span>
		</li>
	)
}

function Diary({ nav }: { nav: Nav }) {
	const { store, seen, askRate } = nav
	const [kind, setKind] = useState<Kind>("all")
	const [sort, setSort] = useState<SeenSort>("last")
	const [q, setQ] = useState("")
	const [unrated, setUnrated] = useState(nav.side === "unrated")
	const [episodes, setEpisodes] = useState(true)
	const [from, setFrom] = useState<number | null>(null)
	const [n, setN] = useState(60)
	const titles = useMemo(() => seen.filter((s) => ofKind(kind)(s.t) && has(q)(s.t.title) && (!unrated || s.mine == null)), [seen, kind, q, unrated])
	const { entries } = store
	const rows = useMemo(() => diaryOf(titles, entries, episodes && !unrated && kind !== "movie").filter((r) => has(q)(r.t.title)), [titles, entries, episodes, unrated, kind, q])
	const dated = useMemo(() => rows.filter((r) => r.watch.days != null), [rows])
	const unknown = useMemo(() => rows.filter((r) => r.watch.days == null), [rows])
	const years = useMemo(() => {
		const out: { year: number; n: number }[] = []
		for (const r of dated) {
			const year = yearOf(store.today, r.watch) as number
			const last = out[out.length - 1]
			if (last?.year === year) last.n++
			else out.push({ year, n: 1 })
		}
		return out
	}, [dated, store.today])
	const start = from == null ? 0 : Math.max(0, dated.findIndex((r) => (yearOf(store.today, r.watch) as number) <= from))
	const shown = dated.slice(start, start + n)
	const months = monthsOf(store.today, shown)
	const left = dated.length - start - shown.length
	const flat = useSteps(sort === "last" ? [] : sortSeen(titles, sort), 60)
	const open = seen.filter((s) => s.mine == null).length
	const jump = (year: number | null) => {
		setFrom(year)
		setN(60)
	}
	return (
		<>
			<div className="flex flex-wrap items-center gap-2" data-controls="diary">
				<KindFilter kind={kind} setKind={setKind} list={seen.map((s) => s.t)} />
				<Search value={q} onChange={setQ} placeholder="When did I watch…?" />
				<span className="grow" />
				<SortSelect value={sort} onChange={setSort} options={{ last: "By date", score: "My score", title: "Title" }} />
			</div>
			<div className="-mt-2 flex flex-wrap items-center gap-2">
				{open > 0 && (
					<Quiet on={unrated} set={setUnrated} id="unrated">
						{count(open)} not rated yet
					</Quiet>
				)}
				{sort === "last" && !unrated && (
					<Quiet on={episodes} set={setEpisodes} id="episodes">
						Episodes of shows in progress
					</Quiet>
				)}
				<span className="text-xs text-gray-500" data-result>
					{sort === "last" ? `${count(rows.length)} ${rows.length === 1 ? "watch" : "watches"} of ${count(titles.length)} titles` : `${count(titles.length)} titles`}
				</span>
			</div>
			{sort !== "last" ? (
				<>
					<ul data-seen-list>
						{flat.shown.map((s) => (
							<SeenRow key={s.id} item={s} today={store.today} askRate={askRate} />
						))}
					</ul>
					{flat.more}
				</>
			) : (
				<div className="grid gap-x-8 gap-y-3 lg:grid-cols-[6.5rem_minmax(0,1fr)]" data-diary>
					<nav aria-label="Years" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:self-start lg:px-0" data-years>
						{years.map((y, i) => {
							const on = from == null ? i === 0 : y.year === Math.min(from, years[0].year)
							return (
								<button
									key={y.year}
									type="button"
									data-year={y.year}
									aria-current={on}
									onClick={() => jump(i === 0 ? null : y.year)}
									className={`flex h-9 shrink-0 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-sm font-bold tabular-nums ${on ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
								>
									{y.year}
									<span className="text-xs font-medium text-gray-500">{count(y.n)}</span>
								</button>
							)
						})}
						{unknown.length > 0 && (
							<a href="#date-unknown" data-year="unknown" className="flex h-9 shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold text-gray-400 hover:bg-white/5 hover:text-white">
								No date
								<span className="text-xs font-medium text-gray-500">{count(unknown.length)}</span>
							</a>
						)}
					</nav>
					<div className="flex min-w-0 flex-col gap-6">
						{!rows.length && <p className="text-sm text-gray-400">No watch matches.</p>}
						{months.map((m) => (
							<section key={m.key} data-month={m.key}>
								<h2 className="flex items-baseline gap-2 border-b border-white/10 pb-1.5">
									<span className={`${DISPLAY} text-xl text-white md:text-2xl`}>{m.label}</span>
									<span className="text-xs text-gray-500">{plural(m.items.length, "watch", "watches")}</span>
								</h2>
								<ul>
									{m.items.map((r) => (
										<DiaryLine key={r.id} row={r} nav={nav} />
									))}
								</ul>
							</section>
						))}
						{left > 0 && (
							<button type="button" data-more onClick={() => setN(n + 120)} className="h-10 cursor-pointer self-start rounded-lg bg-white/5 px-4 text-sm font-bold text-gray-300 hover:bg-white/10">
								Earlier <span className="font-medium text-gray-500">· {count(left)} more watches</span>
							</button>
						)}
						{unknown.length > 0 && <Undated rows={unknown} nav={nav} />}
					</div>
				</div>
			)}
		</>
	)
}

/** The watches nobody recorded a date for: their own group, never placed in a month. */
function Undated({ rows, nav }: { rows: DiaryRow[]; nav: Nav }) {
	const steps = useSteps(rows, 30)
	return (
		<details className="group scroll-mt-24" id="date-unknown" open={rows.length <= 12} data-month="unknown">
			<summary className="flex cursor-pointer list-none items-baseline gap-2 border-b border-white/10 pb-1.5 [&::-webkit-details-marker]:hidden">
				<ChevronRightIcon className="h-4 w-4 self-center text-gray-400 transition-transform group-open:rotate-90" aria-hidden />
				<span className={`${DISPLAY} text-xl text-white md:text-2xl`}>Date unknown</span>
				<span className="text-xs text-gray-500">{plural(rows.length, "watch", "watches")} without a date, most of them imported</span>
			</summary>
			<ul>
				{steps.shown.map((r) => (
					<DiaryLine key={r.id} row={r} nav={nav} />
				))}
			</ul>
			{steps.more}
		</details>
	)
}

function DiaryPage({ nav }: { nav: Nav }) {
	const onDiary = nav.side !== "want"
	const watches = nav.seen.reduce((sum, s) => sum + s.watches.length, 0)
	return (
		<div className={`${WRAP} flex flex-col gap-5 pt-6`}>
			<header className="flex flex-wrap items-end gap-x-6 gap-y-3">
				<div className="min-w-0">
					<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>{onDiary ? "Diary" : "Wishlist"}</h1>
					<p className="mt-1 text-sm text-gray-400">{onDiary ? "What you watched, by the day you watched it. A title you watched twice is here twice." : "Everything you want to see, movies and shows together."}</p>
				</div>
				<span className="grow" />
				<Halves nav={nav} want="Wishlist" other="Diary" otherCount={watches} />
			</header>
			{!onDiary ? <WantHalf nav={nav} /> : !nav.seen.length ? <NothingSeen /> : <Diary nav={nav} />}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// C: My library, a status per chip.

const CHIPS: Side[] = ["want", "watching", "onhold", "dropped", "seen"]

function ProgressRow({ item, nav }: { item: SeenItem; nav: Nav }) {
	const e = item.entry as Entry
	const href = titlePage(e.show)
	const cls = "absolute inset-0 cursor-pointer"
	return (
		<li className="relative flex items-center gap-3 border-b border-white/5 py-2 hover:bg-white/[0.03]" data-progress={item.id}>
			{href ? (
				<a href={href} className={cls}>
					<span className="sr-only">Open {e.show.title}</span>
				</a>
			) : (
				<button type="button" aria-label={`Open ${e.show.title}`} onClick={() => nav.go("title", { show: e.show.key })} className={cls} />
			)}
			<Poster t={item.t} size="w92" className="h-[60px] w-10 shrink-0 rounded" />
			<span className="min-w-0 flex-1">
				<b className="block truncate text-sm text-white md:text-base">{item.t.title}</b>
				<span className="block truncate text-xs text-gray-400">{e.next ? `${e.track.status === "watching" ? "Next" : "Stopped before"} ${code(e.next)} · ${e.next.name}` : e.upcoming ? `${statusWord(e)} · ${waitLine(e)}` : statusWord(e)}</span>
			</span>
			<span className="hidden w-40 shrink-0 sm:block">
				<Progress entry={e} />
				<span className="mt-1 block text-xs tabular-nums text-gray-500">
					{e.done} of {e.show.total} episodes
				</span>
			</span>
			<span className="w-24 shrink-0 text-right text-xs text-gray-400">{ago(e.track.lastWatch)}</span>
			<ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-600" aria-hidden />
		</li>
	)
}

function WantRow({ t, nav }: { t: Title; nav: Nav }) {
	const f = nav.facts[t.key]
	return (
		<li className="flex items-center gap-3 border-b border-white/5 py-2" data-title={t.key}>
			<Poster t={t} size="w92" className="h-[60px] w-10 shrink-0 rounded" />
			<span className="min-w-0 flex-1">
				<b className="block truncate text-sm text-white md:text-base">{t.title}</b>
				<span className="block truncate text-xs text-gray-500">{[t.type === "show" ? "Show" : "Movie", t.year, t.type === "show" ? costLine(f).split(" · ").slice(0, 2).join(" · ") : hm(t.runtime)].filter(Boolean).join(" · ")}</span>
			</span>
			<span className="hidden w-28 shrink-0 truncate text-xs text-gray-400 sm:block">{t.service?.name ?? "Not streaming"}</span>
			<span className="w-24 shrink-0 text-right text-xs text-gray-400">Added {ago(f?.added ?? null)}</span>
			<b className="w-10 shrink-0 text-right text-sm tabular-nums text-amber-300">{t.match}%</b>
		</li>
	)
}

function LibraryPage({ nav }: { nav: Nav }) {
	const { store, seen, askRate, setSide } = nav
	const side = nav.side
	const w = useWant(nav)
	const [kind, setKind] = useState<Kind>("all")
	const [sort, setSort] = useState<SeenSort>("last")
	const [showSort, setShowSort] = useState<"last" | "title">("last")
	const [q, setQ] = useState("")
	const { entries } = store
	const byStatus = useMemo(() => ({ watching: inProgress(entries, "watching"), onhold: inProgress(entries, "onhold"), dropped: inProgress(entries, "dropped") }), [entries])
	const unrated = useMemo(() => seen.filter((s) => s.mine == null), [seen])
	const counts: Record<Side, number> = { want: store.wishlist.length, watching: byStatus.watching.length, onhold: byStatus.onhold.length, dropped: byStatus.dropped.length, seen: seen.length, unrated: unrated.length }
	const seenList = useMemo(() => sortSeen((side === "unrated" ? unrated : seen).filter((s) => ofKind(kind)(s.t) && has(q)(s.t.title)), sort), [seen, unrated, side, kind, q, sort])
	const steps = useSteps(seenList, 60)
	const chip = (s: Side, quiet = false) => (
		<button
			key={s}
			type="button"
			data-chip={s}
			aria-current={side === s}
			onClick={() => setSide(s)}
			className={`flex h-10 shrink-0 cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3.5 text-sm font-bold ring-1 transition-colors ${side === s ? "bg-amber-400 text-black ring-amber-400" : quiet ? "text-gray-400 ring-transparent hover:bg-white/5 hover:text-white" : "bg-white/[0.05] text-gray-200 ring-white/10 hover:bg-white/10"}`}
		>
			{SIDES[s]}
			<span className={`text-xs tabular-nums ${side === s ? "text-black/60" : "text-gray-400"}`}>{count(counts[s])}</span>
		</button>
	)
	const isShows = side === "watching" || side === "onhold" || side === "dropped"
	const shows = isShows ? byStatus[side].filter((s) => has(q)(s.t.title)).sort((a, b) => (showSort === "title" ? a.t.title.localeCompare(b.t.title) : (a.last ?? 9e9) - (b.last ?? 9e9))) : []
	const wanted = w.list.filter((t) => has(q)(t.title))
	return (
		<div className={`${WRAP} pt-6`}>
			<header>
				<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>My library</h1>
				<p className="mt-1 text-sm text-gray-400">Every title you have marked, by where you stand with it. Picking one for tonight happens in My shows and My movies.</p>
			</header>
			<div className="mt-5 grid gap-x-8 gap-y-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
				<nav aria-label="Status" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:self-start lg:px-0" data-chips>
					{CHIPS.map((s) => chip(s))}
					{counts.unrated > 0 && (
						<>
							<span className="mx-1 w-px shrink-0 bg-white/10 lg:mx-0 lg:my-2 lg:h-px lg:w-auto" />
							{chip("unrated", true)}
						</>
					)}
				</nav>
				<div className="flex min-w-0 flex-col gap-3" data-library={side}>
					<div className="flex flex-wrap items-center gap-2" data-controls="library">
						{!isShows && <KindFilter kind={side === "want" ? w.kind : kind} setKind={side === "want" ? w.setKind : setKind} list={side === "want" ? store.wishlist : (side === "unrated" ? unrated : seen).map((s) => s.t)} />}
						<Search value={q} onChange={setQ} placeholder={`Search ${SIDES[side].toLowerCase()}`} />
						<span className="grow" />
						{side === "want" ? (
							<SortSelect value={w.sort} onChange={w.setSort} options={WANT_SORTS} />
						) : isShows ? (
							<SortSelect value={showSort} onChange={setShowSort} options={{ last: "Last watched", title: "Title" }} />
						) : (
							<SortSelect value={sort} onChange={setSort} options={SEEN_SORTS} />
						)}
					</div>
					{side === "want" ? (
						wanted.length ? (
							<ul data-rows="want">
								{wanted.map((t) => (
									<WantRow key={t.key} t={t} nav={nav} />
								))}
							</ul>
						) : (
							<Empty title="Nothing here yet">Want to See on a title puts it here.</Empty>
						)
					) : isShows ? (
						shows.length ? (
							<ul data-rows={side}>
								{shows.map((s) => (
									<ProgressRow key={s.id} item={s} nav={nav} />
								))}
							</ul>
						) : (
							<Empty title={`No show is ${SIDES[side]}`}>{side === "watching" ? "The first episode you mark watched puts its show here." : side === "onhold" ? "A show you set aside waits here." : "A show you gave up on stays here and out of your recommendations."}</Empty>
						)
					) : seenList.length ? (
						<>
							{side === "unrated" && <p className="text-xs text-gray-400">Seen and without a score. A score takes the title off this list.</p>}
							<ul data-rows={side}>
								{steps.shown.map((s) => (
									<SeenRow key={s.id} item={s} today={store.today} askRate={askRate} />
								))}
							</ul>
							{steps.more}
						</>
					) : (
						<NothingSeen />
					)}
				</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// D: no switch. The Wishlist is plain; Seen is a page of its own.

/** The two ways on from the Wishlist, as in round 2. */
function Doors({ nav }: { nav: Nav }) {
	const { store, facts, go } = nav
	const p = picksOf(store, facts)
	const movies = store.wishlist.filter((t) => t.type === "movie").length
	const shows = store.wishlist.length - movies
	const door = (id: string, title: Title | undefined, name: string, line: string, open: () => void) => (
		<button type="button" data-door={id} onClick={open} className="group relative isolate flex min-h-24 cursor-pointer items-center gap-4 overflow-hidden rounded-2xl p-4 text-left ring-1 ring-white/10 transition-colors hover:ring-amber-300">
			{title?.backdrop && <img src={img(title.backdrop, "w780")} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40 transition-opacity group-hover:opacity-55" />}
			<span className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/80 to-transparent" />
			<span className="min-w-0 flex-1">
				<span className={`${DISPLAY} block text-2xl text-white md:text-3xl`}>{name}</span>
				<span className="block truncate text-sm text-gray-300">{line}</span>
			</span>
			<ChevronRightIcon className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-amber-300" aria-hidden />
		</button>
	)
	return (
		<div className="grid gap-3 md:grid-cols-2">
			{door("movies", p.film?.title, "My movies", p.film ? `${plural(movies, "movie")} · tonight: ${p.film.title.title}, ${hm(p.film.title.runtime)}` : "No movies yet", () => go("movies"))}
			{door("shows", (p.episode ?? p.start)?.title, "My shows", [p.episode ? `${store.groups.next.length} in progress` : null, `${shows} to start`].filter(Boolean).join(" · "), () => go("shows"))}
		</div>
	)
}

function PlainWishlist({ nav }: { nav: Nav }) {
	return (
		<>
			<PageHead name="Wishlist" line="Everything you want to see, movies and shows together. Picking one for tonight happens on the two pages." links={[{ id: "seen", label: `Seen · ${count(nav.seen.length)}`, open: () => nav.go("wishlist", { side: "seen" }) }]} />
			<div className={`${WRAP} flex flex-col gap-5`}>
				<Doors nav={nav} />
				<WantHalf nav={nav} />
				<p className="max-w-2xl text-sm text-gray-500">A show leaves the Wishlist with its first watched episode and is then in My shows. A movie leaves it when you have watched it and is then in Seen.</p>
			</div>
		</>
	)
}

/** The one nudge: a short row of Seen titles without a score, which can be put away. */
function RateRail({ nav, only }: { nav: Nav; only: () => void }) {
	const [away, setAway] = useState(false)
	const open = useMemo(() => sortSeen(nav.seen.filter((s) => s.mine == null), "last"), [nav.seen])
	if (away || !open.length) return null
	return (
		<section className="rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10" data-rate-rail>
			<div className="flex items-center gap-3">
				<h2 className="text-sm font-bold text-gray-200">Rate these</h2>
				<span className="truncate text-xs text-gray-500">{count(open.length)} Seen without a score. Your scores are what Taste is built from.</span>
				<span className="grow" />
				<button type="button" data-rail-away onClick={() => setAway(true)} className="h-8 shrink-0 cursor-pointer rounded-lg px-2 text-xs font-semibold text-gray-400 hover:bg-white/10 hover:text-white">
					Not now
				</button>
			</div>
			<ul className="-mx-3 mt-2 flex gap-3 overflow-x-auto px-3 [scrollbar-width:none]">
				{open.slice(0, 10).map((s) => (
					<li key={s.id} className="w-[72px] shrink-0" data-rail={s.id}>
						<Poster t={s.t} size="w154" className="aspect-[2/3] w-full rounded-md" />
						<Score item={s} askRate={nav.askRate} className="mt-1.5 w-full" />
					</li>
				))}
				{open.length > 10 && (
					<li className="flex shrink-0 items-center">
						<button type="button" data-rail-all onClick={only} className="h-9 cursor-pointer whitespace-nowrap rounded-lg px-3 text-sm font-bold text-gray-300 ring-1 ring-white/10 hover:bg-white/10">
							All {count(open.length)}
						</button>
					</li>
				)}
			</ul>
		</section>
	)
}

function SeenPage({ nav }: { nav: Nav }) {
	const { store, seen, askRate } = nav
	const [kind, setKind] = useState<Kind>("all")
	const [sort, setSort] = useState<SeenSort>("last")
	const [q, setQ] = useState("")
	const [unrated, setUnrated] = useState(nav.side === "unrated")
	const [opened, setOpened] = useState<Record<string, number>>({})
	const list = useMemo(() => seen.filter((s) => ofKind(kind)(s.t) && has(q)(s.t.title) && (!unrated || s.mine == null)), [seen, kind, q, unrated])
	const groups = useMemo(() => groupSeen(store.today, list, sort), [store.today, list, sort])
	const movies = seen.filter((s) => s.t.type === "movie").length
	const year = new Date(`${store.today}T00:00:00Z`).getUTCFullYear()
	const thisYear = seen.filter((s) => s.last != null && yearOf(store.today, s.watches[0]) === year).length
	const progress = inProgress(store.entries).length
	// A short list shows whole; in a long one every group starts with two rows of posters.
	const cap = list.length <= 60 ? 9e9 : 14
	return (
		<>
			<PageHead
				name="Seen"
				line={seen.length ? `${plural(movies, "movie")} and ${plural(seen.length - movies, "show")} · ${thisYear} this year` : "Nothing yet"}
				links={[{ id: "wishlist", label: `Wishlist · ${count(store.wishlist.length)}`, open: () => nav.go("wishlist", { side: "want" }) }]}
			/>
			<div className={`${WRAP} flex flex-col gap-5`}>
				{!seen.length ? (
					<NothingSeen />
				) : (
					<>
						{!unrated && <RateRail nav={nav} only={() => setUnrated(true)} />}
						<div className="flex flex-wrap items-center gap-2" data-controls="seen">
							<KindFilter kind={kind} setKind={setKind} list={seen.map((s) => s.t)} />
							<Search value={q} onChange={setQ} placeholder="Have I seen…?" />
							{unrated && (
								<Quiet on={unrated} set={setUnrated} id="unrated">
									Only not rated
								</Quiet>
							)}
							<span className="grow" />
							<SortSelect value={sort} onChange={setSort} options={SEEN_SORTS} />
						</div>
						{!list.length && <p className="text-sm text-gray-400">Nothing you have Seen matches.</p>}
						{groups.map((g) => {
							const n = opened[g.key] ?? cap
							return (
								<section key={g.key} data-group={g.key}>
									<h2 className="mb-3 flex items-baseline gap-2 border-b border-white/10 pb-1.5">
										<span className={`${DISPLAY} text-2xl text-white md:text-3xl`}>{g.label}</span>
										<span className="text-xs text-gray-500">{count(g.items.length)}</span>
									</h2>
									<ul className={GRID}>
										{g.items.slice(0, n).map((s) => (
											<SeenCard key={s.id} item={s} today={store.today} askRate={askRate} />
										))}
									</ul>
									{g.items.length > n && (
										<button type="button" data-more onClick={() => setOpened({ ...opened, [g.key]: n + 140 })} className="mt-3 h-9 cursor-pointer rounded-lg bg-white/5 px-3 text-sm font-bold text-gray-300 hover:bg-white/10">
											{g.items.length - n > 140 ? "Show 140 more" : `All ${count(g.items.length)}`} <span className="font-medium text-gray-500">· {count(g.items.length - n)} left</span>
										</button>
									)}
								</section>
							)
						})}
						{progress > 0 && (
							<p className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
								{plural(progress, "show")} you are Watching, have On hold or Dropped {progress === 1 ? "is" : "are"} not Seen and {progress === 1 ? "is" : "are"} in My shows.
								<LinkKey link={{ id: "shows", label: "My shows", open: () => nav.go("shows") }} />
							</p>
						)}
					</>
				)}
			</div>
		</>
	)
}

export function WishlistPage({ nav }: { nav: Nav }) {
	const { variant, side } = nav
	return (
		<div className="overflow-x-clip pb-40" data-wishlist={variant} data-side={side}>
			{variant === "switch" ? <SwitchPage nav={nav} /> : variant === "diary" ? <DiaryPage nav={nav} /> : variant === "library" ? <LibraryPage nav={nav} /> : side === "want" ? <PlainWishlist nav={nav} /> : <SeenPage nav={nav} />}
		</div>
	)
}
