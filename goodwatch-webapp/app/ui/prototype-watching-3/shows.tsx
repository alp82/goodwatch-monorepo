// PROTOTYPE - throwaway. My shows for /prototype/watching-3 (#371): round 2's variant C, one list for tonight, as the
// owner chose it, with the two changes they asked for.
//   1. The row's large Watched button is gone. The whole row is a link to the show's title page: to
//      /prototype/episode-list-2 for the shows that have an episode list there, otherwise to a stub in this prototype.
//      `tick=on` puts a small quiet tick at the end of the row that marks the Next episode watched; the default is
//      none, so marking happens on the title page.
//   2. The order is one rule that the page states (tonightOf in model.ts): Continue first, the show watched last on
//      top, then Start, best taste match first. The two groups have labels, and the fact that places a row is on it.
// The quiet groups under the list are round 2's: not watched for 30 days, Waiting for episodes, On hold.
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline"
import { type ReactNode, useEffect } from "react"
import { Collapsed, NewBadge, Progress, QuietRow, WatchedButton, episodeFacts } from "~/ui/prototype-watching/kit"
import { type Entry, QUIET_DAYS, type Store, ago, aired, code, img, isNew, isShow } from "~/ui/prototype-watching/model"
import { Empty, Tag } from "~/ui/prototype-watching-2/bits"
import { type Facts, continueOf, costLine, unstarted } from "~/ui/prototype-watching-2/model"
import { DISPLAY, WRAP } from "~/ui/watch-next/style"
import { type Nav, statusWord, titlePage, tonightOf } from "./model"
import { PageHead, headLinks } from "./seen"

/** The whole row is this link. A show with an episode list in the other prototype leaves for it. */
function RowLink({ entry, nav }: { entry: Entry; nav: Nav }) {
	const href = titlePage(entry.show)
	const cls = "absolute inset-0 z-0 cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:outline-amber-300"
	const label = `Open ${entry.show.title}`
	return href ? (
		<a href={href} data-row-link="episode-list" className={cls}>
			<span className="sr-only">{label}</span>
		</a>
	) : (
		<button type="button" data-row-link="stub" aria-label={label} onClick={() => nav.go("title", { show: entry.show.key })} className={cls} />
	)
}

/** What is left of the one-tap mark: a small tick that doesn't compete with the row. */
function QuietTick({ entry, store }: { entry: Entry; store: Store }) {
	if (!entry.next) return null
	return (
		<button
			type="button"
			data-tick={entry.show.key}
			onClick={() => store.markWatched(entry.show.key)}
			aria-label={`Mark ${entry.show.title} ${code(entry.next)} watched`}
			title={`Mark ${code(entry.next)} watched`}
			className="pointer-events-auto relative z-10 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 ring-1 ring-white/10 transition-colors hover:bg-green-500/15 hover:text-green-300 hover:ring-green-400/50"
		>
			<CheckIcon className="h-5 w-5" aria-hidden />
		</button>
	)
}

function Row({ entry, n, nav, big }: { entry: Entry; n: number; nav: Nav; big?: boolean }) {
	const { store, facts, tick } = nav
	const { show, next } = entry
	const start = entry.track.status === null
	const f = facts[show.key]
	// The one fact that places the row in its group.
	const why = start ? `${show.match}% taste match` : entry.kind === "seenNew" ? `${entry.left} new since you saw it` : `Watched ${ago(entry.track.lastWatch)}`
	return (
		<li
			className={`group relative flex items-stretch gap-3 overflow-hidden rounded-2xl ring-1 ring-white/10 transition-colors hover:bg-white/[0.09] hover:ring-white/25 md:gap-5 ${big ? "bg-white/[0.07]" : "bg-white/[0.04]"}`}
			data-row={show.key}
			data-tag={start ? "start" : entry.kind}
		>
			<RowLink entry={entry} nav={nav} />
			<span className={`${DISPLAY} pointer-events-none flex w-8 shrink-0 items-center justify-center text-3xl text-white/25 md:w-14 md:text-5xl`} aria-hidden>
				{n}
			</span>
			<span className={`pointer-events-none relative hidden shrink-0 self-stretch sm:block ${big ? "w-64" : "w-44"}`}>
				<img src={img(show.backdrop, "w500")} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
			</span>
			<img src={img(show.poster, "w185")} alt="" loading="lazy" className="pointer-events-none my-3 h-24 w-16 shrink-0 rounded-md object-cover sm:hidden" />
			<div className={`pointer-events-none flex min-w-0 flex-1 flex-col justify-center ${big ? "py-5" : "py-3"}`}>
				<p className="flex flex-wrap items-center gap-1.5">
					{start ? <Tag kind="start">Start</Tag> : entry.kind === "seenNew" ? <Tag kind="seen">New episodes</Tag> : <Tag kind="next">Next episode</Tag>}
					{isNew(store.today, next) && !start && <NewBadge />}
					<span className="truncate text-xs font-semibold text-gray-300 md:hidden">{why}</span>
				</p>
				<p className={`mt-1 truncate font-bold text-white ${big ? `${DISPLAY} text-3xl md:text-4xl` : "text-lg"}`}>{show.title}</p>
				<p className="truncate text-sm text-gray-200">{start ? costLine(f) : next ? `${code(next)} · ${next.name}` : ""}</p>
				<p className="truncate text-xs text-gray-400">
					{start
						? [f?.ended ? "Has ended" : "Still running", show.service ? `on ${show.service.name}` : "not on your services"].join(" · ")
						: [next ? aired(store.today, next) : null, show.runtime ? `${show.runtime} min` : null, `${entry.done} of ${show.total} episodes`].filter(Boolean).join(" · ")}
				</p>
				{!start && big && <Progress entry={entry} className="mt-2 max-w-xs" />}
			</div>
			<span className="pointer-events-none hidden w-40 shrink-0 items-center justify-end text-right text-sm font-semibold text-gray-300 md:flex" data-why>
				{why}
			</span>
			<div className="pointer-events-none flex shrink-0 items-center gap-1 pr-2 md:pr-4">
				{tick && <QuietTick entry={entry} store={store} />}
				<ChevronRightIcon className="h-5 w-5 text-gray-500 transition-colors group-hover:text-amber-300" aria-hidden />
			</div>
		</li>
	)
}

const GroupLabel = ({ id, name, rule, count }: { id: string; name: string; rule: string; count: number }) => (
	<li className="flex scroll-mt-24 items-baseline gap-2 px-1 pt-3 first:pt-0" id={id} data-group-label={id}>
		<h3 className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">{name}</h3>
		<span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-300">{count}</span>
		<span className="truncate text-xs text-gray-400">{rule}</span>
	</li>
)

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

export function ShowsPage({ nav, at }: { nav: Nav; at: string | null }) {
	const { store, facts } = nav
	const { continues, starts } = tonightOf(store, facts)
	// Home's Start door lands on the Start group.
	useEffect(() => {
		if (at === "start") document.getElementById("start")?.scrollIntoView({ block: "start" })
	}, [at])
	const jump = (id: string, label: ReactNode) => (
		<a href={`#${id}`} onClick={(e) => {
				e.preventDefault()
				document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" })
			}} className="font-bold text-gray-200 underline decoration-white/30 underline-offset-4 hover:text-white">
			{label}
		</a>
	)
	const total = continues.length + starts.length
	return (
		<div className="overflow-x-clip pb-40" data-shows>
			<PageHead name="My shows" line={[continues.length ? `${continues.length} to continue` : "Nothing in progress", `${starts.length} to start`].join(" · ")} links={headLinks(nav)} />
			<div className={`${WRAP} flex flex-col gap-10 pt-2`}>
				<section data-section="tonight">
					<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>Tonight</h2>
					<p className="mb-4 mt-1 max-w-3xl text-sm text-gray-400" data-order-rule>
						{continues.length > 0 && <>{jump("continue", "Continue")} comes first, the show you watched last on top. </>}
						{starts.length > 0 && <>{continues.length ? "Then" : "Shows to"} {jump("start", continues.length ? "Start" : "start")}: the shows you want to see, best taste match first. </>}
						{total > 0 && "A row opens the show."}
					</p>
					{total === 0 ? (
						<Empty title="No show to start">Want to See on a show puts it here, with how long it is and where it streams.</Empty>
					) : (
						<ol className="flex flex-col gap-2.5">
							{continues.length > 0 && <GroupLabel id="continue" name="Continue" rule="last watched first" count={continues.length} />}
							{continues.map((e, i) => (
								<Row key={e.show.key} entry={e} n={i + 1} nav={nav} big={i === 0} />
							))}
							{starts.length > 0 && <GroupLabel id="start" name="Start" rule="best taste match first" count={starts.length} />}
							{starts.map((e, i) => (
								<Row key={e.show.key} entry={e} n={continues.length + i + 1} nav={nav} big={!continues.length && i === 0} />
							))}
						</ol>
					)}
				</section>
				<Quiet store={store} />
			</div>
		</div>
	)
}

/**
 * A stand-in for the show's title page, for the shows without an episode list in /prototype/episode-list-2. It only
 * shows where the row leads and that marking an episode watched happens there.
 */
export function TitleStub({ nav, showKey }: { nav: Nav; showKey: string }) {
	const { store, facts } = nav
	const show = store.titles[showKey]
	if (!isShow(show)) return <div className={`${WRAP} pt-10 text-gray-300`}>No such show.</div>
	const entry = store.entries.find((e) => e.show.key === showKey) ?? unstarted(store, show)
	const f = facts[showKey]
	return (
		<div className="overflow-x-clip pb-40" data-title-stub={showKey}>
			<section className="relative isolate overflow-hidden">
				{show.backdrop && <img src={img(show.backdrop, "w1280")} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]" />}
				<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-900 via-gray-900/80 to-gray-900/30" />
				<div className={`${WRAP} flex min-h-[24rem] flex-col justify-end gap-3 pb-8 pt-6`}>
					<button type="button" data-back onClick={() => nav.go("shows")} className="mb-auto inline-flex h-9 cursor-pointer items-center gap-1 self-start rounded-xl bg-black/40 px-3 text-sm font-bold text-gray-200 ring-1 ring-white/10 hover:bg-black/60">
						<ChevronLeftIcon className="h-4 w-4" aria-hidden />
						My shows
					</button>
					<p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">Stand-in for the title page</p>
					<h1 className={`${DISPLAY} text-5xl leading-[0.9] text-white md:text-7xl`}>{show.title}</h1>
					<p className="text-sm text-gray-300">{[show.year, costLine(f), entry.track.status ? statusWord(entry) : "On your Wishlist"].filter(Boolean).join(" · ")}</p>
				</div>
			</section>
			<div className={`${WRAP} flex flex-col gap-4 pt-6`}>
				<div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10" data-stub-next>
					<div className="min-w-0 flex-1 basis-64">
						<p className="text-sm font-semibold text-amber-300">{entry.next ? "Next episode" : "No episode to watch right now"}</p>
						{entry.next && (
							<p className="text-xl font-bold text-white">
								{code(entry.next)} · {entry.next.name}
							</p>
						)}
						<p className="text-xs text-gray-400">{entry.track.status ? episodeFacts(store.today, entry) : "Not started"}</p>
						{entry.track.status && <Progress entry={entry} className="mt-2 max-w-xs" />}
					</div>
					<WatchedButton entry={entry} store={store} className="!h-12 !px-4 !text-base" />
				</div>
				<p className="max-w-2xl text-sm text-gray-400">
					In the app this is the show's title page with its episode list, where episodes are marked watched. Slow Horses and Chernobyl open the episode list prototype (
					<a href="/prototype/episode-list-2?variant=B&show=slow-horses" className="underline underline-offset-2 hover:text-white">
						/prototype/episode-list-2
					</a>
					) from their rows; that prototype has its own state, so what is marked there doesn't come back to this list.
				</p>
			</div>
		</div>
	)
}
