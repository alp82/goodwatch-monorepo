// PROTOTYPE (Discover lab, titles g "Suggestions list"): a classic search-suggest list under the bar. One list, grouped,
// ↑ ↓ Enter: the first row runs the bar's text (the text shows once, as that row's action), then filters the text
// points at, titles (steer with thumbs or Like this), people (Cast and crew).
// Round 8: running a search (the first row, a Try row, Enter) puts it in the bar's pill and closes the panel.
// Round 9: one full-width list, no side column. What steers the list (More like, Less like, Like this, people) sits in
// the search row as removable chips. When no title has the text's name, Titles lists the top of the results (or of the
// preview) to thumb, and People lists who is most in the running search's results.
// Round 11: no Filters row (Mood has them) and no Showing row (the footer shows the search state, with the steering
// chips); Movies or shows with the anime switch sits where Filters was. Running, the titles and people get the room.
// Round 11b: with no text, popular and very different titles sit beside Try (phones: under it), with the same thumbs
// and Like this, as Cast and crew shows well-known people. A hand-picked list, names and posters read live.
import {
	ArrowTurnDownLeftIcon,
	CheckIcon,
	FilmIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	UserIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useMemo, useRef } from "react"
import { useTitleNames } from "~/ui/filter-bar/useFilterData"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"
import { EXAMPLE_PROMPTS, short } from "../../../kit"
import { type FoundTitle, PRIVATE, PosterThumb, useQuickTitles } from "../../shell-parts"
import { TypeBlock } from "../../shell-tabs"
import type { SectionProps } from "../../types"
import { type CountedPerson, useResultPeople } from "../people/in-results"
import { Face, type Person, roleOf, usePeople } from "../people/shared"
import { STEER_ORDER, SteerToggle, cardTitle, chipStyle, useListNav } from "./ghi-parts"
import { PreviewPosters, SECTION_LABEL, type TitleUses, useKnown, useSearchPreview, useTitleUses } from "./shared"

type Item =
	| { kind: "run"; text: string }
	| { kind: "prompt"; text: string }
	| { kind: "title"; t: FoundTitle }
	| { kind: "person"; p: Person }

const PURPLE = "#c084fc"
/** The search ranks at most this many titles; filters can leave fewer (as in d). */
const SEARCH_CAP = 100
/** Popular and far apart: movies and shows, countries, eras, animation, a documentary. Rows read in pairs. */
const POPULAR: TitleKey[] = [
	titleKey("movie", 496243), // Parasite
	titleKey("show", 1396), // Breaking Bad
	titleKey("show", 71446), // Money Heist
	titleKey("movie", 129), // Spirited Away
	titleKey("movie", 238), // The Godfather
	titleKey("show", 94605), // Arcane
	titleKey("show", 93405), // Squid Game
	titleKey("movie", 194), // Amélie
	titleKey("movie", 579974), // RRR
	titleKey("show", 68595), // Planet Earth II
	titleKey("show", 70523), // Dark
	titleKey("movie", 239), // Some Like It Hot
]

/** The popular titles in POPULAR's order, as they resolve. */
function usePopular(n: number): { list: FoundTitle[]; loading: boolean } {
	const names = useTitleNames(POPULAR, "")
	return useMemo(() => {
		const list = POPULAR.slice(0, n).flatMap((key): FoundTitle[] => {
			const t = names.byKey.get(key)
			if (!t) return []
			const { mediaType, tmdbId } = parseTitleKey(key)
			return [{ key, title: t.title, year: t.year ? String(t.year) : "", poster: t.poster, mediaType: mediaType === "movie" ? "movie" : "show", tmdbId }]
		})
		return { list, loading: names.byKey.size === 0 }
	}, [names.byKey, n])
}

const matches = (n: number) => (n >= SEARCH_CAP ? `Top ${SEARCH_CAP} matches` : `${short(n)} ${n === 1 ? "match" : "matches"}`)


export function TitlesG({ d, phone, text, runSearch, setText, close }: SectionProps) {
	const go = (q: string) => {
		runSearch(q)
		setText(q)
		close?.()
	}
	const typed = text.trim()
	const asking = typed.length >= 2
	const titles = useQuickTitles(text)
	const people = usePeople(d, text)
	const preview = useSearchPreview(d, text)
	const uses = useTitleUses(d)
	const known = useKnown(uses.picked.map((p) => p.key))
	const showing = typed !== "" && typed === d.q
	const inResults = useResultPeople(d)
	const popular = usePopular(phone ? 6 : 12)

	// Running (no Search row): three rows of titles.
	const nTitles = phone ? 3 : showing ? 6 : 4
	const nPeople = 2
	// No title has this name: the top of what the text returns, to thumb (the running results, else the preview).
	const named = titles.found.slice(0, nTitles)
	const fallback: FoundTitle[] =
		asking && !titles.loading && named.length === 0
			? (showing ? d.cards : preview.ready ? preview.cards : []).slice(0, nTitles).map(cardTitle)
			: []
	const tList = named.length ? named : fallback
	// No person has this name: who is most in the running search's results.
	const counted =
		showing && people.found.length === 0
			? [...inResults.actors.slice(0, nPeople / 2), ...inResults.behind.slice(0, nPeople / 2)].filter((p): p is CountedPerson => !!p)
			: []
	const pList: Person[] = people.found.length ? people.found.slice(0, nPeople) : counted
	const items: Item[] = typed
		? [
				...(showing ? [] : [{ kind: "run" as const, text: typed }]),
				...(asking ? tList.map((t) => ({ kind: "title" as const, t })) : []),
				...(asking ? pList.map((p) => ({ kind: "person" as const, p })) : []),
			]
		: [
				...EXAMPLE_PROMPTS.slice(0, 5).map((p) => ({ kind: "prompt" as const, text: p })),
				...popular.list.map((t) => ({ kind: "title" as const, t })),
			]

	const act = (i: number) => {
		const it = items[i]
		if (!it) return
		if (it.kind === "run" || it.kind === "prompt") go(it.text)
		else if (it.kind === "title") {
			known.remember(it.t)
			uses.toggle("similarTo", it.t.key)
		} else people.toggle(it.p)
	}
	const nav = useListNav(items.length, act, `${typed}|${showing}`, typed !== "" && !showing)

	const list = useRef<HTMLDivElement>(null)
	useEffect(() => {
		list.current?.querySelector<HTMLElement>(`[data-row="${nav.active}"]`)?.scrollIntoView({ block: "nearest" })
	}, [nav.active])

	const at = (it: Item) => items.indexOf(it)
	const run = items.find((x) => x.kind === "run")
	const tRows = items.filter((x): x is Extract<Item, { kind: "title" }> => x.kind === "title")
	const pRows = items.filter((x): x is Extract<Item, { kind: "person" }> => x.kind === "person")
	const prompts = items.filter((x): x is Extract<Item, { kind: "prompt" }> => x.kind === "prompt")

	const listBody = (
		<div ref={list} role="listbox" aria-label="Suggestions" className={phone ? "flex flex-col gap-1" : "flex flex-col gap-1"}>
			{run && (
				<Row i={at(run)} active={nav.active} onHover={nav.setActive} onClick={() => go(typed)} tall>
					<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
					<span className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden text-[16px] text-gray-300">
						<span className="shrink-0">Search</span>
						<span className={`brand-header truncate text-[18px] text-white ${PRIVATE}`}>{typed}</span>
					</span>
					{!phone && (
						<span className="flex shrink-0 items-center gap-3">
							{preview.ready && preview.total != null && <span className="text-[12px] tabular-nums text-gray-500">{matches(preview.total)}</span>}
							<PreviewPosters p={preview} n={5} w={22} />
						</span>
					)}
					<EnterKey show={nav.active === at(run)} />
				</Row>
			)}
			<TypeBlock d={d} className={`max-w-[440px] px-3 ${run ? "pt-2 pb-1" : "pb-1"}`} />

			{asking && <Head icon={<FilmIcon />}>{named.length || !fallback.length ? "Titles" : showing ? "In these results" : "In this search"}</Head>}
			{asking && tRows.length === 0 && (
				<p className="flex h-11 items-center px-3 text-[13px] text-gray-500">{titles.loading || (showing ? d.loading : preview.busy) ? "Looking…" : `No title called “${typed}”`}</p>
			)}
			<div className={phone ? "flex flex-col gap-1" : "grid grid-cols-2 gap-x-3 gap-y-1"}>
				{tRows.map((it) => (
					<TitleItem key={it.t.key} it={it.t} i={at(it)} nav={nav} uses={uses} remember={known.remember} phone={phone} />
				))}
			</div>

			{pRows.length > 0 && <Head icon={<UserIcon />}>{people.found.length ? "People" : "Most in these results"}</Head>}
			<div className={phone ? "flex flex-col gap-1" : "grid grid-cols-2 gap-x-3 gap-y-1"}>
				{pRows.map((it) => {
				const on = people.has(it.p.id)
				return (
					<Row key={it.p.id} i={at(it)} active={nav.active} onHover={nav.setActive} onClick={() => people.toggle(it.p)}>
						<Face src={it.p.profile} size={32} />
						<span className="min-w-0 flex-1">
							<span className="block truncate text-[14px] font-semibold text-gray-100">{it.p.name}</span>
							<span className="block text-[12px] text-gray-500">{personNote(it.p)}</span>
						</span>
						<span
							className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap ${on ? "text-white" : "text-gray-300 ring-1 ring-inset ring-white/10"}`}
							style={on ? chipStyle(PURPLE) : undefined}
						>
							{on ? <CheckIcon className="h-3.5 w-3.5 text-purple-200" /> : <PlusIcon className="h-3.5 w-3.5" />}
							Cast and crew
							{on && <XMarkIcon className="h-3 w-3 text-white/60" />}
						</span>
						<EnterKey show={nav.active === at(it)} />
					</Row>
				)
			})}
			</div>
		</div>
	)

	// No text: Try on the left (phones: on top), popular titles to steer by on the right.
	const idle = !typed && (
		<div ref={list} role="listbox" aria-label="Suggestions" className={phone ? "flex flex-col gap-1" : "grid grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-8"}>
			<div className="flex min-w-0 flex-col gap-1">
				<TypeBlock d={d} className="px-3 pb-1" />
				<Head icon={<MagnifyingGlassIcon />}>Try</Head>
				{prompts.map((it) => (
					<Row key={it.text} i={at(it)} active={nav.active} onHover={nav.setActive} onClick={() => go(it.text)}>
						<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-400/60" aria-hidden />
						<span className="min-w-0 flex-1 truncate text-[15px] text-gray-300">{it.text}</span>
						<EnterKey show={nav.active === at(it)} />
					</Row>
				))}
			</div>
			<div className="flex min-w-0 flex-col gap-1">
				<Head icon={<FilmIcon />} first={!phone}>
					Popular titles
				</Head>
				<div className={phone ? "flex flex-col gap-1" : "grid grid-cols-2 gap-x-3 gap-y-1"}>
					{popular.loading
						? Array.from({ length: phone ? 6 : 12 }, (_, i) => <span key={i} className="block h-11 rounded-xl bg-white/[0.03]" />)
						: tRows.map((it) => <TitleItem key={it.t.key} it={it.t} i={at(it)} nav={nav} uses={uses} remember={known.remember} phone={phone} />)}
				</div>
			</div>
		</div>
	)
	const body = idle || listBody
	if (phone) return body
	return <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{body}</div>
}

/** A person row's line: the role, and for someone counted in the results, how many titles. */
function personNote(p: Person): string {
	if (!("count" in p)) return roleOf(p.department)
	const c = p as CountedPerson
	const role = c.role === "directors" ? "Director" : c.role === "writers" ? "Writer" : roleOf(c.department)
	return `${role} · ${c.count} ${c.count === 1 ? "title" : "titles"}`
}

function Row({
	i,
	active,
	onHover,
	onClick,
	children,
	tall = false,
}: {
	i: number
	active: number
	onHover: (i: number) => void
	onClick: () => void
	children: ReactNode
	tall?: boolean
}) {
	const on = i === active
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the bar's field drives the keyboard (↑ ↓ Enter)
		<div
			data-row={i}
			role="option"
			aria-selected={on}
			tabIndex={-1}
			onMouseEnter={() => onHover(i)}
			onClick={onClick}
			className={`flex min-w-0 shrink-0 items-center gap-3 rounded-xl px-3 cursor-pointer ${tall ? "h-12" : "h-11"} ${
				on ? "bg-white/[0.08] ring-1 ring-inset ring-white/10" : "hover:bg-white/[0.04]"
			}`}
		>
			{children}
		</div>
	)
}

function Head({ icon, children, first = false }: { icon: ReactNode; children: ReactNode; first?: boolean }) {
	return (
		<h3 className={`${SECTION_LABEL} ${first ? "" : "mt-2"} flex h-6 shrink-0 items-center gap-1.5 px-3 text-gray-500 [&>svg]:h-3.5 [&>svg]:w-3.5`}>
			{icon}
			{children}
		</h3>
	)
}

function EnterKey({ show }: { show: boolean }) {
	return (
		<kbd
			className={`hidden h-6 w-7 shrink-0 place-items-center rounded-md bg-black/30 text-amber-200/80 transition-opacity sm:grid ${show ? "opacity-100" : "opacity-0"}`}
			aria-hidden
		>
			<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" />
		</kbd>
	)
}

function TitleItem({
	it,
	i,
	nav,
	uses,
	remember,
	phone,
}: {
	it: FoundTitle
	i: number
	nav: { active: number; setActive: (i: number) => void }
	uses: TitleUses
	remember: (t: FoundTitle) => void
	phone: boolean
}) {
	const toggle = (u: (typeof STEER_ORDER)[number]) => {
		remember(it)
		uses.toggle(u, it.key)
	}
	return (
		<Row i={i} active={nav.active} onHover={nav.setActive} onClick={() => toggle("similarTo")}>
			<PosterThumb poster={it.poster} title={it.title} className="h-[38px] w-[26px]" />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-[14px] font-semibold text-gray-100">{it.title}</span>
				<span className="block text-[12px] text-gray-500">{[it.year, it.mediaType === "movie" ? "Movie" : "Show"].filter(Boolean).join(" · ")}</span>
			</span>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the row's own click */}
			<span className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
				<SteerToggle use="loved" on={uses.has("loved", it.key)} onToggle={() => toggle("loved")} />
				<SteerToggle use="disliked" on={uses.has("disliked", it.key)} onToggle={() => toggle("disliked")} />
				<SteerToggle use="similarTo" on={uses.has("similarTo", it.key)} onToggle={() => toggle("similarTo")} wide={!phone} />
			</span>
			<EnterKey show={nav.active === i} />
		</Row>
	)
}
