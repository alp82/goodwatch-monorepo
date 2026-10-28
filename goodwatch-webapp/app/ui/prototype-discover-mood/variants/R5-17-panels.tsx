// PROTOTYPE - throwaway. Round 5 variant 17: what each sub-tab shows, shaped for its job. Search: lanes driven by the
// one field (describe, titles, similar to, cast and crew, find a filter). Mood: a tag mixer with the picked recipe on
// top. Streaming: logos, then single real cards. Watched: seen and taste picks, score controls side by side, released.
import { FilmIcon, UserIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useRef, useState } from "react"
import { FilterGroups } from "~/ui/filter-bar"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { Chip, byCount } from "~/ui/filter-bar/SheetControls"
import { usePeopleNames } from "~/ui/filter-bar/useFilterData"
import type { TitleKey } from "~/utils/title-key"
import { type ProtoDiscover, TAGS, type Tag, short, tagId } from "../kit"
import type { TabKey } from "./R5-17-bar"
import { ExampleRow, LaneHead, MoodLane, SimilarLane, TitleLane } from "./R5-17-lanes"
import {
	ClearLink,
	CountryLine,
	type FoundTitle,
	GenreControl,
	NotSeenControl,
	OneCard,
	type Pieces,
	ReleasedControl,
	ScoreControl,
	ServiceLogos,
	StreamingModes,
	TagChips,
	TitleRow,
	TitleRowsLoading,
	TypeControl,
	chipsOf,
	clearCard,
	tagOption,
	useKeepTop,
	useQuickTitles,
	useSimilar,
} from "./R5-17-parts"

export interface SearchProps {
	text: string
	typing: boolean
	onRun: (t: string) => void
	onFill: (t: string) => void
}

export interface PanelProps {
	tab: TabKey
	sub: string
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	search: SearchProps
}

/** A scroll area for one column on desktop, plain on phones. */
const col = (phone: boolean, extra = "") => (phone ? "" : `min-h-0 overflow-y-auto overscroll-contain px-6 py-5 ${extra}`)
const DIVIDE = "border-r border-white/[0.06]"

function Column({
	d,
	pieces,
	k,
	title,
	hint,
	children,
}: { d: ProtoDiscover; pieces: Pieces; k: CardKey; title: string; hint: string; children?: ReactNode }) {
	const set = chipsOf(pieces, k).length > 0
	return (
		<section aria-label={title} className="min-w-0">
			<header className="mb-3 flex min-h-[38px] items-start gap-2">
				<span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[k].dot}`} />
				<div className="min-w-0 flex-1">
					<h4 className="text-[15px] font-bold leading-tight text-white">{title}</h4>
					<p className="truncate text-[12px] text-gray-500">{hint}</p>
				</div>
				{set && <ClearLink onClick={() => clearCard(d, pieces, k)} />}
			</header>
			{children ?? <OneCard key={k} pieces={pieces} k={k} />}
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Search

const PROFILE = "https://image.tmdb.org/t/p/w92"
const PEOPLE_EXAMPLES = ["Greta Gerwig", "Denis Villeneuve", "Florence Pugh"]

function CastLane({ d, text, onFill }: { d: ProtoDiscover; text: string; onFill: (t: string) => void }) {
	const chosen = d.filters.state.people ?? []
	const names = usePeopleNames(chosen, "")
	const found = usePeopleNames([], text)
	const [seen, setSeen] = useState(() => new Map<number, { name: string; profile: string | null }>())
	const nameOf = (id: number) => seen.get(id) ?? names.byId.get(id)
	const toggle = (id: number, name: string, profile: string | null) => {
		setSeen((m) => new Map(m).set(id, { name, profile }))
		const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]
		d.filters.set({ people: next.length ? next : undefined })
	}
	const asking = text.trim().length >= 2
	const matches = found.matches.filter((p) => !chosen.includes(p.id))
	return (
		<div>
			<LaneHead icon={<UserIcon />}>Cast and crew</LaneHead>
			{chosen.length > 0 && (
				<div className="mb-4 flex flex-wrap gap-1.5 px-1">
					{chosen.map((id) => {
						const p = nameOf(id)
						return (
							<Chip
								key={id}
								img={p?.profile ? `${PROFILE}${p.profile}` : null}
								o={{ id: String(id), label: p?.name ?? "…", active: true, count: null, toggle: () => toggle(id, p?.name ?? "", p?.profile ?? null) }}
							/>
						)
					})}
				</div>
			)}
			{asking ? (
				matches.length > 0 ? (
					<div className="flex flex-wrap gap-1.5 px-1">
						{matches.map((p) => (
							<Chip
								key={p.id}
								img={p.profile ? `${PROFILE}${p.profile}` : null}
								o={{ id: String(p.id), label: p.name, active: false, count: null, toggle: () => toggle(p.id, p.name, p.profile) }}
							/>
						))}
					</div>
				) : (
					<p className="px-2 py-3 text-[13px] text-gray-500">No one called “{text.trim()}”</p>
				)
			) : (
				<div className="flex flex-col">
					{PEOPLE_EXAMPLES.map((n) => (
						<ExampleRow key={n} icon={<UserIcon />} text={n} onClick={() => onFill(n)} />
					))}
				</div>
			)}
		</div>
	)
}

function TitleGrid({
	text,
	titles,
	similar,
	onFill,
	onSeen,
	phone,
}: {
	text: string
	titles: ReturnType<typeof useQuickTitles>
	similar: ReturnType<typeof useSimilar>
	onFill: (t: string) => void
	onSeen: (t: FoundTitle) => void
	phone: boolean
}) {
	const asking = text.trim().length >= 2
	if (!asking) return <TitleLane text={text} titles={titles} similar={similar} onFill={onFill} onSeen={onSeen} />
	return (
		<div>
			<LaneHead icon={<FilmIcon />}>Find a title</LaneHead>
			<div className={`${phone ? "" : "grid grid-cols-2 gap-x-6"} ${titles.loading ? "opacity-70" : ""}`}>
				{titles.found.length > 0 ? (
					titles.found.slice(0, 10).map((t) => (
						<TitleRow
							key={t.key}
							t={t}
							liked={similar.has(t.key)}
							onLike={() => {
								onSeen(t)
								similar.toggle(t.key)
							}}
						/>
					))
				) : titles.loading ? (
					<TitleRowsLoading n={4} />
				) : (
					<p className="px-2 py-3 text-[13px] text-gray-500">No title called “{text.trim()}”</p>
				)}
			</div>
		</div>
	)
}

/** "Find a filter" results across every filter, in columns so the list stays short. */
function FindAll({ pieces, text, phone }: { pieces: Pieces; text: string; phone: boolean }) {
	const css = phone
		? ""
		: `.find-all-17 > .flex-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 2rem; row-gap: 1.75rem; align-items: start }`
	return (
		<>
			{css && <style dangerouslySetInnerHTML={{ __html: css }} />}
			<FilterGroups data={pieces.groups} query={text} className="find-all-17" />
		</>
	)
}

const FIND_EXAMPLES = ["Horror", "Netflix", "Korea", "Short", "Rotten Tomatoes", "Anime"]

function FindLane({ pieces, text, phone, onFill }: { pieces: Pieces; text: string; phone: boolean; onFill: (t: string) => void }) {
	if (text.trim()) return <FindAll pieces={pieces} text={text} phone={phone} />
	return (
		<div>
			<LaneHead icon={<span className="block h-2 w-2 rounded-full bg-amber-400/70" />}>Find a filter</LaneHead>
			<div className="flex flex-wrap gap-1.5 px-1">
				{FIND_EXAMPLES.map((t) => (
					<Chip key={t} o={{ id: t, label: t, active: false, count: null, toggle: () => onFill(t) }} />
				))}
			</div>
		</div>
	)
}

function SearchPanel({ sub, d, pieces, phone, search }: PanelProps) {
	const similar = useSimilar(d)
	const titles = useQuickTitles(search.text)
	const [seen, setSeen] = useState(() => new Map<TitleKey, FoundTitle>())
	const onSeen = (t: FoundTitle) => setSeen((m) => new Map(m).set(t.key, t))
	const { text, typing, onRun, onFill } = search
	switch (sub) {
		case "describe":
			return (
				<div className={phone ? "flex flex-col gap-8" : "grid h-full min-h-0 grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"}>
					<div className={col(phone, DIVIDE)}>
						<MoodLane d={d} text={text} typing={typing} onRun={onRun} />
					</div>
					<div className={col(phone)}>
						<TitleLane text={text} titles={titles} similar={similar} onFill={onFill} onSeen={onSeen} />
					</div>
				</div>
			)
		case "title":
			return (
				<div className={col(phone, "h-full")}>
					<TitleGrid text={text} titles={titles} similar={similar} onFill={onFill} onSeen={onSeen} phone={phone} />
				</div>
			)
		case "similar":
			return (
				<div className={col(phone, "h-full max-w-3xl")}>
					<SimilarLane text={text} titles={titles} similar={similar} seen={seen} onSeen={onSeen} />
				</div>
			)
		case "cast":
			return (
				<div className={col(phone, "h-full max-w-4xl")}>
					<CastLane d={d} text={text} onFill={onFill} />
				</div>
			)
		default:
			return (
				<div className={col(phone, "h-full")}>
					<FindLane pieces={pieces} text={text} phone={phone} onFill={onFill} />
				</div>
			)
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Mood: the mixer

const MIX_GROUPS: Tag["group"][] = ["moods", "themes", "styles"]

/** The picked recipe across Mood, About and Style, one line, with what it leaves. */
function Recipe({ d }: { d: ProtoDiscover }) {
	const picks = d.picked
	return (
		<div className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-white/[0.06] px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			<span className="shrink-0 text-[12px] text-gray-500">{picks.length ? "Mix" : "Pick a few to mix"}</span>
			{picks.map((t, i) => (
				<span key={tagId(t)} className="flex shrink-0 items-center gap-2">
					{i > 0 && <span className="text-gray-600">+</span>}
					<button
						type="button"
						onClick={() => d.toggle(t)}
						aria-label={`Remove ${t.name}`}
						className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-white cursor-pointer"
						style={{ background: `${t.color}2e`, boxShadow: `inset 0 0 0 1px ${t.color}88` }}
					>
						<span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
						{t.name}
					</button>
				</span>
			))}
			{picks.length > 0 && (
				<>
					<span className="shrink-0 text-[13px] text-gray-400">
						= <span className="font-semibold text-white">{short(d.total)}</span> titles
					</span>
					<span className="ml-auto shrink-0">
						<ClearLink onClick={d.clearTags} />
					</span>
				</>
			)}
		</div>
	)
}

/** Tags from groups with nothing picked yet, by what they'd leave: honest "and" combinations. */
function CombineWith({ d, not }: { d: ProtoDiscover; not: Tag["group"] }) {
	const open = MIX_GROUPS.filter((g) => g !== not && !d.picked.some((t) => t.group === g))
	const options = byCount(TAGS.filter((t) => open.includes(t.group)).map((t) => tagOption(d, t))).filter((o) => o.count)
	if (!d.picked.length || !options.length) return null
	return (
		<div>
			<h4 className="mb-2.5 text-[14px] font-semibold text-gray-100">Combine with</h4>
			<div className="flex flex-wrap gap-1.5">
				{options.slice(0, 10).map((o) => (
					<Chip key={o.id} o={o} />
				))}
			</div>
		</div>
	)
}

function MoodPanel({ sub, d, phone }: PanelProps) {
	const group: Tag["group"] = sub === "about" ? "themes" : sub === "style" ? "styles" : "moods"
	const body =
		sub === "genre" ? (
			<div className={phone ? "flex flex-col gap-6" : "grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,3fr)]"}>
				<div className={col(phone, DIVIDE)}>
					<TypeControl d={d} />
				</div>
				<div className={col(phone)}>
					<GenreControl d={d} limit={phone ? 14 : 40} />
				</div>
			</div>
		) : (
			<div className={phone ? "flex flex-col gap-6" : "grid h-full min-h-0 grid-cols-[minmax(0,3fr)_minmax(0,1.3fr)]"}>
				<div className={col(phone, DIVIDE)}>
					<TagChips d={d} group={group} big={group === "moods"} />
				</div>
				<div className={col(phone)}>
					<CombineWith d={d} not={group} />
				</div>
			</div>
		)
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<div className="-mx-5">
					<Recipe d={d} />
				</div>
				{body}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			<Recipe d={d} />
			<div className="min-h-0 flex-1">{body}</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Streaming

const STREAMING_CARDS: Record<string, { k: CardKey; title: string; hint: string }> = {
	length: { k: "runtime", title: "Length", hint: "Short movies, short episodes" },
	age: { k: "ageLimit", title: "Age and content", hint: "Age rating, violence, language" },
	made: { k: "productionCountries", title: "Production country", hint: "Where it was made" },
}

function StreamingPanel({ sub, d, pieces, phone }: PanelProps) {
	if (sub === "services")
		return (
			<div className={col(phone, "h-full")}>
				<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
					<div className="w-full max-w-md">
						<StreamingModes d={d} pieces={pieces} />
					</div>
					<CountryLine d={d} pieces={pieces} />
				</div>
				<div className="mt-5">
					<ServiceLogos d={d} pieces={pieces} layout="grid" limit={phone ? 12 : 24} />
				</div>
			</div>
		)
	const c = STREAMING_CARDS[sub]
	return (
		<div className={col(phone, "h-full")}>
			<div className="max-w-2xl">
				<Column d={d} pieces={pieces} {...c} />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Watched

function WatchedPanel({ sub, d, pieces, phone }: PanelProps) {
	const grid = (cols: string) => (phone ? "flex flex-col gap-7" : `grid h-full min-h-0 ${cols}`)
	if (sub === "seen")
		return (
			<div className={grid("grid-cols-3")}>
				<div className={col(phone, DIVIDE)}>
					<section aria-label="Not seen yet">
						<h4 className="mb-3 min-h-[38px] text-[15px] font-bold text-white">Not seen yet</h4>
						<NotSeenControl pieces={pieces} />
					</section>
				</div>
				<div className={col(phone, DIVIDE)}>
					<Column d={d} pieces={pieces} k="loved" title="Loved" hint="Steer toward these" />
				</div>
				<div className={col(phone)}>
					<Column d={d} pieces={pieces} k="disliked" title="Disliked" hint="Steer away from these" />
				</div>
			</div>
		)
	if (sub === "scores")
		return (
			<div className={grid("grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)]")}>
				<div className={col(phone, DIVIDE)}>
					<ScoreControl d={d} />
				</div>
				<div className={col(phone, DIVIDE)}>
					<Column d={d} pieces={pieces} k="minMatch" title="Taste match" hint="How well it fits your taste" />
				</div>
				<div className={col(phone, DIVIDE)}>
					<Column d={d} pieces={pieces} k="sourceScores" title="Scores by source" hint="IMDb, Rotten Tomatoes, Metacritic" />
				</div>
				<div className={col(phone)}>
					<Column d={d} pieces={pieces} k="scoreGap" title="Critics vs audiences" hint="Where they disagree" />
				</div>
			</div>
		)
	return (
		<div className={col(phone, "h-full")}>
			<div className="max-w-2xl">
				<ReleasedControl d={d} />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function Panel(p: PanelProps) {
	const root = useRef<HTMLDivElement>(null)
	// The real cards scroll themselves into view as they mount; columns start at the top.
	useKeepTop(root, `${p.tab}:${p.sub}`, ".overflow-y-auto")
	const body =
		p.tab === "search" ? (
			<SearchPanel {...p} />
		) : p.tab === "mood" ? (
			<MoodPanel {...p} />
		) : p.tab === "streaming" ? (
			<StreamingPanel {...p} />
		) : (
			<WatchedPanel {...p} />
		)
	return (
		<div ref={root} className={p.phone ? "" : "h-full min-h-0"}>
			{body}
		</div>
	)
}
