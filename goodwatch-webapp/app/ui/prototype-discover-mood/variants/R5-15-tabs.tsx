// PROTOTYPE - throwaway. Round 5 variant 15: what each tab and sub-tab shows, and what the one field finds in each tab.
// Idle, a tab shows its open sub-tab (shaped for its job: lanes, a mood mixer, logos, tiles, single real cards side by
// side). While typing, every tab shows its own matches at once: Search has the lanes (search the text, titles, people),
// Mood the matching moods, themes, styles and genres, Streaming the matching services and countries, Watched the
// matching filters. Filters found by name open their sub-tab.
import { ArrowTurnDownLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useRef } from "react"
import { useCountries } from "~/routes/api.countries"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { AGE_CONTENT_WORDS, FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { Chip, type Option } from "~/ui/filter-bar/SheetControls"
import { PROVIDER_LOGO } from "~/ui/filter-bar/useFilterData"
import { type ProtoDiscover, TAGS, type Tag } from "../kit"
import { SearchLanes, usePeopleFound } from "./R5-15-lanes"
import {
	ClearLink,
	CountryLine,
	GenreControl,
	NotSeenControl,
	OneCard,
	PRIVATE,
	type Pieces,
	ReleasedControl,
	SEG_LABEL,
	SEG_ORDER,
	SUB_LABEL,
	ScoreControl,
	type SegKey,
	ServiceLogos,
	StreamingModes,
	type SubKey,
	TagChips,
	TagChipsBare,
	TypeControl,
	chipsOf,
	cleanName,
	clearCard,
	genreOptions,
	placeOf,
	subCount,
	subsFor,
	tagOption,
	useDebouncedText,
	useKeepTop,
	useQuickTitles,
	useStreaming,
} from "./R5-15-parts"

// ---------------------------------------------------------------------------------------------------------------
// Filters by name: the words each filter is found by, and the short hint it shows.

type FilterKey = CardKey | "notSeenYet"

const FILTER_INFO: Record<FilterKey, { title: string; hint: string; words: string }> = {
	similarTo: { title: "Similar to", hint: "Like titles you pick", words: "similar like" },
	people: { title: "Cast and crew", hint: "Actors and directors", words: "cast crew actor actors actress director directors people" },
	moods: { title: "Mood", hint: "How it feels", words: "mood moods feel feeling vibe" },
	type: { title: "Movies or shows", hint: "Both, movies, shows", words: "movie movies film films show shows series tv type" },
	genres: { title: "Genre", hint: "Drama, comedy, horror", words: "genre genres" },
	themes: { title: "About", hint: "Crime, family, the future", words: "about theme themes topic topics subject" },
	styles: { title: "Style", hint: "Slow burn, fast-paced", words: "style styles pace tone" },
	runtime: { title: "Length", hint: "Short movies, short episodes", words: "length runtime short long minutes duration episode episodes quick" },
	services: { title: "Streaming services", hint: "Where it streams", words: "streaming stream services service everywhere subscription" },
	productionCountries: { title: "Production country", hint: "Where it was made", words: "made produced production country countries origin foreign international" },
	ageLimit: { title: "Age and content", hint: "Age rating, violence, language", words: AGE_CONTENT_WORDS },
	notSeenYet: { title: "Not seen yet", hint: "Hide what you've seen", words: "seen unseen watched new" },
	minScore: { title: "Score", hint: "GoodWatch score", words: "score rating good best quality top" },
	released: { title: "Released", hint: "Recent, a decade, a year range", words: "released release year years decade recent old classic" },
	minMatch: { title: "Taste match", hint: "How well it fits your taste", words: "taste match fit personal" },
	loved: { title: "Loved", hint: "Steer toward these", words: "loved love liked favorite favourite" },
	disliked: { title: "Disliked", hint: "Steer away from these", words: "disliked dislike hate hated avoid" },
	sourceScores: { title: "Scores by source", hint: "IMDb, Rotten Tomatoes, Metacritic", words: "imdb rotten tomatoes metacritic metascore tmdb source sources" },
	scoreGap: { title: "Critics vs audiences", hint: "Where they disagree", words: "critics critic audiences audience gap disagree underrated overrated divisive" },
}

/** A word starts with the text (short text), or the words contain it (three letters or more). */
const hits = (words: string, q: string) =>
	q.length > 0 && (words.split(/\s+/).some((w) => w.startsWith(q)) || (q.length >= 3 && words.includes(q)))
const nameHit = (name: string, q: string) => hits(name.toLowerCase(), q)

// ---------------------------------------------------------------------------------------------------------------
// Matches

export interface TabMatches {
	q: string
	titles: ReturnType<typeof useQuickTitles>["found"]
	people: ReturnType<typeof usePeopleFound>["matches"]
	moods: Tag[]
	themes: Tag[]
	styles: Tag[]
	genres: Option[]
	services: Pieces["services"]["countryProviders"]
	countries: { code: string; name: string }[]
	/** Filters found by name, by tab. Inline ones show their control right in the matches. */
	filters: Record<SegKey, FilterKey[]>
	counts: Record<SegKey, number>
}

const INLINE = new Set<FilterKey>(["type", "notSeenYet", "minScore", "released"])

export function useMatches(d: ProtoDiscover, pieces: Pieces, text: string): TabMatches {
	const raw = text.trim()
	const q = raw.toLowerCase()
	const titles = useQuickTitles(raw).found.slice(0, 5)
	const people = usePeopleFound(d, useDebouncedText(raw)).matches.slice(0, 6)
	const countriesQ = useCountries()
	if (!q)
		return {
			q,
			titles: [],
			people: [],
			moods: [],
			themes: [],
			styles: [],
			genres: [],
			services: [],
			countries: [],
			filters: { search: [], mood: [], streaming: [], watched: [] },
			counts: { search: 0, mood: 0, streaming: 0, watched: 0 },
		}
	const tags = (g: Tag["group"]) =>
		TAGS.filter((t) => t.group === g && (nameHit(t.name, q) || (q.length >= 3 && t.description?.toLowerCase().includes(q))))
	const moods = tags("moods")
	const themes = tags("themes")
	const styles = tags("styles")
	const genres = genreOptions(d).filter((o) => nameHit(o.label, q))
	const services = pieces.services.countryProviders.filter((p) => nameHit(cleanName(p.name), q)).slice(0, 12)
	const countries = (countriesQ.data ?? [])
		.filter((c) => nameHit(c.name, q) || c.code.toLowerCase() === q)
		.slice(0, 12)
	const ladderWords = pieces.groups.ladder ? pieces.groups.ladder.steps.map((s) => s.label.toLowerCase()).join(" ") : ""
	const filters: Record<SegKey, FilterKey[]> = { search: [], mood: [], streaming: [], watched: [] }
	for (const k of Object.keys(FILTER_INFO) as FilterKey[]) {
		if (k === "ageLimit" && !pieces.groups.ladder) continue
		const info = FILTER_INFO[k]
		const words = `${info.title.toLowerCase()} ${info.words}${k === "ageLimit" ? ` ${ladderWords}` : ""}`
		const yearish = k === "released" && /^(1[89]|20)\d{0,2}s?$/.test(q)
		if (!hits(words, q) && !yearish) continue
		const seg = k === "notSeenYet" ? "watched" : placeOf(k).seg
		if (seg === "search") continue // the Search tab's lanes cover titles and people
		filters[seg].push(k)
	}
	return {
		q,
		titles,
		people,
		moods,
		themes,
		styles,
		genres,
		services,
		countries,
		filters,
		counts: {
			search: titles.length + people.length,
			mood: moods.length + themes.length + styles.length + genres.length + filters.mood.length,
			streaming: services.length + countries.length + filters.streaming.length,
			watched: filters.watched.length,
		},
	}
}

// ---------------------------------------------------------------------------------------------------------------
// The sub-tab row (idle) and the match line (typing). Same height, so the panel doesn't move.

const ROW = "flex h-14 shrink-0 items-center gap-1 border-b border-white/[0.07]"

export function SubTabs({
	id,
	seg,
	sub,
	onSub,
	d,
	pieces,
	phone,
}: {
	id: string
	seg: SegKey
	sub: SubKey
	onSub: (s: SubKey) => void
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
}) {
	return (
		<div
			role="tablist"
			aria-label={`${SEG_LABEL[seg]} sections`}
			className={`${ROW} ${phone ? "overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "px-5"}`}
		>
			{subsFor(seg, pieces).map((s) => {
				const on = s.id === sub
				const n = subCount(d, pieces, s)
				return (
					<button
						key={s.id}
						type="button"
						role="tab"
						aria-selected={on}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => onSub(s.id)}
						className={`relative flex h-full shrink-0 items-center gap-2 px-3 text-[14px] font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
							on ? "text-white" : "text-gray-400 hover:text-gray-200"
						}`}
					>
						{s.label}
						{n > 0 && (
							<span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 tabular-nums">
								{n}
							</span>
						)}
						{on && (
							<motion.span
								layoutId={`${id}-sub`}
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-amber-400"
							/>
						)}
					</button>
				)
			})}
		</div>
	)
}

function RunButton({ text, onRun }: { text: string; onRun: () => void }) {
	return (
		<button
			type="button"
			onClick={onRun}
			className="flex h-9 min-w-0 items-center gap-2 rounded-full bg-amber-400/[0.12] pr-2 pl-3.5 text-[13px] ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<span className="shrink-0 font-semibold text-amber-200/80">Search:</span>
			<span className={`min-w-0 truncate font-semibold text-white ${PRIVATE}`}>{text}</span>
			<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-amber-200/80 sm:flex">
				<ArrowTurnDownLeftIcon className="h-3 w-3" aria-hidden />
				Enter
			</kbd>
		</button>
	)
}

/** While typing, in place of the sub-tabs: what this tab found, and running the search. */
export function MatchHead({
	seg,
	text,
	n,
	onRun,
	phone,
}: { seg: SegKey; text: string; n: number; onRun: () => void; phone: boolean }) {
	return (
		<div className={`${ROW} justify-between gap-3 ${phone ? "px-4" : "px-6"}`}>
			<span className="min-w-0 truncate text-[14px] text-gray-400">
				<span className="font-semibold text-gray-100">{n ? `${n} ${n === 1 ? "match" : "matches"}` : "No match"}</span> in{" "}
				{SEG_LABEL[seg]}
			</span>
			{seg !== "search" && <RunButton text={text.trim()} onRun={onRun} />}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Matches in one tab

function MatchSection({ title, path, children }: { title: string; path?: string; children: ReactNode }) {
	return (
		<section className="min-w-0 break-inside-avoid pb-6">
			<h4 className="mb-2.5 flex items-baseline gap-2">
				<span className="text-[14px] font-semibold text-gray-100">{title}</span>
				{path && <span className="text-[12px] text-gray-500">{path}</span>}
			</h4>
			{children}
		</section>
	)
}

/** A filter found by name: a row that opens its sub-tab. */
function FilterJump({ k, pieces, onOpen }: { k: FilterKey; pieces: Pieces; onOpen: () => void }) {
	const info = FILTER_INFO[k]
	const set = k === "notSeenYet" ? [] : chipsOf(pieces, k)
	const at = k === "notSeenYet" ? { seg: "watched" as const, sub: "basics" as const } : placeOf(k)
	return (
		<button
			type="button"
			onClick={onOpen}
			className="group flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left cursor-pointer outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<span className={`h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[k].dot}`} />
			<span className="min-w-0 flex-1">
				<span className="flex items-baseline gap-2">
					<span className="text-[14px] font-semibold text-gray-100">{info.title}</span>
					<span className="truncate text-[12px] text-gray-500">
						{SEG_LABEL[at.seg]} › {SUB_LABEL[at.sub]}
					</span>
				</span>
				<span className={`block truncate text-[12px] ${set.length ? "text-amber-200/80" : "text-gray-500"}`}>
					{set.length ? set.map((c) => c.label).join(", ") : info.hint}
				</span>
			</span>
			<ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-gray-300" />
		</button>
	)
}

function InlineFilter({ k, d, pieces }: { k: FilterKey; d: ProtoDiscover; pieces: Pieces }) {
	switch (k) {
		case "type":
			return <TypeControl d={d} />
		case "notSeenYet":
			return (
				<div>
					<h4 className="mb-2.5 text-[14px] font-semibold text-gray-100">Seen</h4>
					<NotSeenControl pieces={pieces} />
				</div>
			)
		case "minScore":
			return <ScoreControl d={d} />
		case "released":
			return <ReleasedControl d={d} />
		default:
			return null
	}
}

function Chips({ options }: { options: Option[] }) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{options.map((o) => (
				<Chip key={o.id} o={o} />
			))}
		</div>
	)
}

/** Every match of one tab (not Search), in short columns. */
export function MatchBody({
	seg,
	m,
	d,
	pieces,
	phone,
	onOpen,
	onTab,
}: {
	seg: Exclude<SegKey, "search">
	m: TabMatches
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	onOpen: (seg: SegKey, sub: SubKey) => void
	onTab: (seg: SegKey) => void
}) {
	const st = useStreaming(d, pieces)
	const sections: ReactNode[] = []
	const filters = m.filters[seg]
	const inline = filters.filter((k) => INLINE.has(k))
	const jumps = filters.filter((k) => !INLINE.has(k))
	const tagSection = (title: string, sub: SubKey, list: Tag[]) =>
		list.length > 0 &&
		sections.push(
			<MatchSection key={sub + title} title={title} path={sub === "mood" ? undefined : `Mood › ${SUB_LABEL[sub]}`}>
				<Chips options={list.map((t) => tagOption(d, t))} />
			</MatchSection>,
		)
	if (seg === "mood") {
		tagSection("Mood", "mood", m.moods)
		if (m.genres.length)
			sections.push(
				<MatchSection key="genres" title="Genre">
					<Chips options={m.genres} />
				</MatchSection>,
			)
		tagSection("About", "about", m.themes)
		tagSection("Style", "style", m.styles)
	}
	if (seg === "streaming") {
		if (m.services.length)
			sections.push(
				<MatchSection key="services" title="Services">
					<div className="flex flex-wrap gap-1.5">
						{m.services.map((p) => (
							<Chip
								key={p.id}
								img={`${PROVIDER_LOGO}${p.logo_path}`}
								o={{
									id: String(p.id),
									label: cleanName(p.name),
									active: st.mode !== "any" && st.chosen.includes(p.id),
									count: null,
									toggle: () => st.pick(p.id),
								}}
							/>
						))}
					</div>
				</MatchSection>,
			)
		if (m.countries.length) {
			const chosen = d.filters.state.productionCountries ?? []
			sections.push(
				<MatchSection key="countries" title="Made in" path="Streaming › Made in">
					<Chips
						options={m.countries.map((c) => ({
							id: c.code,
							label: c.name,
							active: chosen.includes(c.code),
							count: null,
							toggle: () => {
								const next = chosen.includes(c.code) ? chosen.filter((x) => x !== c.code) : [...chosen, c.code]
								d.filters.set({ productionCountries: next.length ? next : undefined })
							},
						}))}
					/>
				</MatchSection>,
			)
		}
	}
	for (const k of inline)
		sections.push(
			<section key={k} className="min-w-0 break-inside-avoid pb-6">
				<InlineFilter k={k} d={d} pieces={pieces} />
			</section>,
		)
	if (jumps.length)
		sections.push(
			<MatchSection key="jumps" title="Filters">
				<div className="-mx-3">
					{jumps.map((k) => (
						<FilterJump
							key={k}
							k={k}
							pieces={pieces}
							onOpen={() => {
								const at = k === "notSeenYet" ? { seg: "watched" as const, sub: "basics" as const } : placeOf(k)
								onOpen(at.seg, at.sub)
							}}
						/>
					))}
				</div>
			</MatchSection>,
		)
	if (!sections.length) {
		const elsewhere = SEG_ORDER.filter((k) => k !== seg && m.counts[k] > 0)
		return (
			<div className={phone ? "py-6" : "px-6 py-8"}>
				<p className="text-[15px] font-semibold text-white">Nothing in {SEG_LABEL[seg]} called “{m.q}”</p>
				{elsewhere.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-2">
						{elsewhere.map((k) => (
							<button
								key={k}
								type="button"
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => onTab(k)}
								className="flex h-9 items-center gap-2 rounded-full bg-white/[0.06] px-3.5 text-[13px] text-gray-200 ring-1 ring-inset ring-white/10 cursor-pointer outline-none hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span className="font-semibold text-white">{SEG_LABEL[k]}</span>
								<span className="text-amber-200">{m.counts[k]}</span>
							</button>
						))}
					</div>
				)}
			</div>
		)
	}
	return <div className={phone ? "pt-5" : "columns-3 gap-10 px-6 py-5"}>{sections}</div>
}

// ---------------------------------------------------------------------------------------------------------------
// Idle: one sub-tab

function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ${className}`}>{children}</div>
}

/** One real card with a header (title, hint, Clear), for sub-tabs that show a few side by side. */
function CardColumn({ d, pieces, k }: { d: ProtoDiscover; pieces: Pieces; k: CardKey }) {
	const info = FILTER_INFO[k]
	const set = chipsOf(pieces, k).length > 0
	return (
		<section aria-label={info.title} className="min-w-0">
			<header className="mb-3 flex min-h-[38px] items-start gap-2">
				<span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[k].dot}`} />
				<div className="min-w-0 flex-1">
					<h4 className="text-[15px] font-bold leading-tight text-white">{info.title}</h4>
					<p className="truncate text-[12px] text-gray-500">{info.hint}</p>
				</div>
				{set && <ClearLink onClick={() => clearCard(d, pieces, k)} />}
			</header>
			<OneCard key={k} pieces={pieces} k={k} />
		</section>
	)
}

function Columns({ d, pieces, ks, phone, max }: { d: ProtoDiscover; pieces: Pieces; ks: CardKey[]; phone: boolean; max?: string }) {
	return (
		<div
			className={phone ? "flex flex-col gap-7" : `grid gap-x-8 ${max ?? ""}`}
			style={phone ? undefined : { gridTemplateColumns: `repeat(${ks.length}, minmax(0, 1fr))` }}
		>
			{ks.map((k, i) => (
				<div key={k} className={!phone && i ? "-ml-4 border-l border-white/[0.06] pl-4" : ""}>
					<CardColumn d={d} pieces={pieces} k={k} />
				</div>
			))}
		</div>
	)
}

const PAD = "px-6 py-5"

function SubBody({
	sub,
	d,
	pieces,
	phone,
	lanes,
}: {
	sub: SubKey
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	lanes: { onRun: (t: string) => void; onFill: (t: string) => void }
}) {
	const scroll = phone ? "" : `h-full min-h-0 overflow-y-auto overscroll-contain ${PAD}`
	switch (sub) {
		case "find":
			return <SearchLanes d={d} text="" typing={false} phone={phone} {...lanes} />
		case "people":
			return (
				<div className={scroll}>
					<Columns d={d} pieces={pieces} ks={["people"]} phone={phone} max="max-w-2xl" />
				</div>
			)
		case "mood":
			// The mood mixer: moods big on the left, what kind of title on the right.
			return (
				<div className={phone ? "flex flex-col gap-6" : "grid h-full min-h-0 grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}>
					<div className={phone ? "" : "min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-6 py-5"}>
						<TagChips d={d} group="moods" big />
					</div>
					<div className={phone ? "flex flex-col gap-6" : "flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain px-6 py-5"}>
						<TypeControl d={d} />
						<GenreControl d={d} limit={phone ? 10 : 16} />
					</div>
				</div>
			)
		case "about":
		case "style":
			return (
				<div className={scroll}>
					<TagChipsBare d={d} group={sub === "about" ? "themes" : "styles"} />
				</div>
			)
		case "length":
			return (
				<div className={scroll}>
					<Columns d={d} pieces={pieces} ks={["runtime"]} phone={phone} max="max-w-xl" />
				</div>
			)
		case "services":
			return (
				<div className={scroll}>
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
						<div className="w-full max-w-md">
							<StreamingModes d={d} pieces={pieces} />
						</div>
						<CountryLine d={d} pieces={pieces} />
					</div>
					<div className="mt-5">
						<ServiceLogos d={d} pieces={pieces} layout="grid" limit={phone ? 12 : 18} />
					</div>
				</div>
			)
		case "made":
			return (
				<div className={scroll}>
					<Columns d={d} pieces={pieces} ks={["productionCountries"]} phone={phone} max="max-w-2xl" />
				</div>
			)
		case "age":
			return (
				<div className={scroll}>
					<Columns d={d} pieces={pieces} ks={["ageLimit"]} phone={phone} max="max-w-2xl" />
				</div>
			)
		case "basics":
			return (
				<div
					className={
						phone
							? "flex flex-col gap-3"
							: `grid h-full min-h-0 auto-rows-min grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-3 overflow-y-auto ${PAD}`
					}
				>
					<Tile>
						<h4 className="mb-3 text-[14px] font-semibold text-gray-100">Seen</h4>
						<NotSeenControl pieces={pieces} />
					</Tile>
					<Tile>
						<ScoreControl d={d} />
					</Tile>
					<Tile>
						<ReleasedControl d={d} />
					</Tile>
				</div>
			)
		case "taste":
			return (
				<div className={scroll}>
					<Columns d={d} pieces={pieces} ks={["minMatch", "loved", "disliked"]} phone={phone} />
				</div>
			)
		case "scores":
			return (
				<div className={scroll}>
					<Columns d={d} pieces={pieces} ks={["sourceScores", "scoreGap"]} phone={phone} max="max-w-4xl" />
				</div>
			)
	}
}

/** The open sub-tab, fading between sub-tabs. */
export function TabBody({
	sub,
	d,
	pieces,
	phone,
	lanes,
}: {
	sub: SubKey
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	lanes: { onRun: (t: string) => void; onFill: (t: string) => void }
}) {
	const box = useRef<HTMLDivElement>(null)
	// The real cards scroll themselves into view as they mount; keep each sub-tab starting at the top.
	useKeepTop(box, sub, ".overflow-y-auto")
	return (
		<div ref={box} className={phone ? "" : "relative h-full min-h-0"}>
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={sub}
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.14 }}
					className={phone ? "pt-5" : "h-full min-h-0"}
				>
					<SubBody sub={sub} d={d} pieces={pieces} phone={phone} lanes={lanes} />
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

/** While typing in the Search tab: the lanes, filled by the field. */
export function SearchMatches({
	d,
	text,
	phone,
	lanes,
}: {
	d: ProtoDiscover
	text: string
	phone: boolean
	lanes: { onRun: (t: string) => void; onFill: (t: string) => void }
}) {
	return (
		<div className={phone ? "pt-5" : "h-full min-h-0"}>
			<SearchLanes d={d} text={text} typing phone={phone} {...lanes} />
		</div>
	)
}
