// PROTOTYPE (Discover lab, mood section): the parts every Mood variant shares.
//
// The refined mood set is the Explorer's twelve mood islands (server/explorer/islands.server.ts MOODS). Discover can't
// filter by those islands: its mood filter is the 11-mood mask in domain/moods.ts. So each island maps to what Discover
// can do today, honestly:
// - seven map to a Discover mood filter with a close rule (Cozy is Feel-good's exact rule; Funny, Romantic, Thrilling,
//   Scary, Sad, Trippy are near: see MOOD_CHOICES);
// - five have no filter (Tense, Dark, Deep, Magical, Quirky) and run as a word in the mood search, which reads them
//   into the same fingerprint scores the islands use (tension, bleakness, philosophical, wonder, eccentricity).
// Discover's four topic moods (Crime & mystery, Other worlds, History, Coming of age) duplicate themes and are left to
// About. Pictures, "apart" lines and island positions come from the Explorer's world (/api/explorer/world as a guest).
// Counts are Discover's own (d.countFor, or the results endpoint for a mix); search moods show no count until they run.
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, MinusIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useQueries, useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import type { ExplorerWorld } from "~/domain/explorer"
import type { DiscoverResults } from "~/server/discover-results.server"
import { TYPE_LABELS, compactCount } from "~/ui/filter-bar/labels"
import { ChipList, type Option, Segmented } from "~/ui/filter-bar/SheetControls"
import { ChoiceArt } from "~/ui/watch-next/TasteShelf"
import { type ProtoDiscover, TAGS, type Tag, short, tagId } from "../../../kit"

// ---------------------------------------------------------------------------------------------------------------
// The mood set

export interface MoodChoice {
	/** The Explorer island id. */
	id: string
	name: string
	color: string
	/** A Discover mood filter, or a word for the mood search. */
	tag?: Tag
	word?: string
	/** The Discover filter's own name where it differs. */
	alias?: string
}

const tag = (group: Tag["group"], key: string) => {
	const t = TAGS.find((x) => x.group === group && x.key === key)
	if (!t) throw new Error(`No tag ${group}:${key}`)
	return t
}

export const MOOD_CHOICES: MoodChoice[] = [
	{ id: "funny", name: "Funny", color: tag("moods", "funny").color, tag: tag("moods", "funny") },
	{ id: "cozy", name: "Cozy", color: tag("moods", "feelgood").color, tag: tag("moods", "feelgood"), alias: "Feel-good" },
	{ id: "romantic", name: "Romantic", color: tag("moods", "romance").color, tag: tag("moods", "romance"), alias: "Romance" },
	{ id: "thrilling", name: "Thrilling", color: tag("moods", "action").color, tag: tag("moods", "action"), alias: "Action" },
	{ id: "tense", name: "Tense", color: "#5b7fa8", word: "tense" },
	{ id: "scary", name: "Scary", color: tag("moods", "scary").color, tag: tag("moods", "scary") },
	{ id: "sad", name: "Sad", color: tag("moods", "heavy").color, tag: tag("moods", "heavy"), alias: "Heavy" },
	{ id: "dark", name: "Dark", color: "#6a5aa8", word: "dark" },
	{ id: "trippy", name: "Trippy", color: tag("moods", "mind").color, tag: tag("moods", "mind"), alias: "Mind-bending" },
	{ id: "deep", name: "Deep", color: "#3fc1b0", word: "deep" },
	{ id: "magical", name: "Magical", color: "#e9a23b", word: "magical" },
	{ id: "quirky", name: "Quirky", color: "#b98a5a", word: "quirky" },
]

/** Discover moods that are topics; About holds them. They still show as picks when the URL has them. */
const TOPIC_MOOD_ISLAND: Record<string, string> = {
	crime: "theme:crime",
	worlds: "theme:fantasy",
	history: "theme:history",
	growing: "theme:growing",
}

export const THEME_TAGS = TAGS.filter((t) => t.group === "themes")
export const STYLE_TAGS = TAGS.filter((t) => t.group === "styles")

/** The Explorer world island a Discover tag looks like. */
export function islandOfTag(t: Tag): string {
	if (t.group === "themes") return `theme:${t.key}`
	if (t.group === "styles") return `style:${t.key}`
	const choice = MOOD_CHOICES.find((c) => c.tag?.key === t.key)
	return choice ? `mood:${choice.id}` : (TOPIC_MOOD_ISLAND[t.key] ?? `mood:${t.key}`)
}

/** A tag's name in this tab: a Discover mood shows its Explorer name. */
export const tagName = (t: Tag) =>
	t.group === "moods" ? (MOOD_CHOICES.find((c) => c.tag?.key === t.key)?.name ?? t.name) : t.name

// ---------------------------------------------------------------------------------------------------------------
// The Explorer's world: pictures, lines and positions

export interface IslandArt {
	path: string | null
	apart: string
	x: number
	y: number
	/** Titles on the island in the Explorer's pool (not Discover's catalog). */
	count: number
}

export function useWorldArt() {
	const world = useQuery({
		queryKey: ["lab-mood-world"],
		staleTime: 60 * 60_000,
		queryFn: async ({ signal }) => {
			const response = await fetch("/api/explorer/world?services=all&unseen=0", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ guest: { interactions: [], country: "US", services: null } }),
				signal,
			})
			if (!response.ok) throw new Error(`World ${response.status}`)
			return (await response.json()) as ExplorerWorld
		},
	})
	const map = new Map<string, IslandArt>()
	for (const m of world.data?.maps ?? [])
		for (const i of m.islands)
			map.set(`${m.grouping}:${i.id}`, {
				path: i.titles.find((t) => t.backdrop)?.backdrop ?? null,
				apart: i.apart,
				x: i.x,
				y: i.y,
				count: i.count,
			})
	return { get: (id: string) => map.get(id), ready: Boolean(world.data) }
}
export type WorldArt = ReturnType<typeof useWorldArt>

// ---------------------------------------------------------------------------------------------------------------
// Picking moods: Discover's mood filter and words in the search, three at most together

const wordRe = (w: string) => new RegExp(`(^|\\s)${w}(?=\\s|$|[,.])`, "i")
const hasWord = (q: string | null, w: string) => Boolean(q && wordRe(w).test(q))
const addWord = (q: string | null, w: string) => (q ? `${q.trim()} ${w}` : w)
const dropWord = (q: string | null, w: string) => (q ?? "").replace(wordRe(w), " ").replace(/\s+/g, " ").trim() || null

export const MAX_MOODS = 3

export interface Tap {
	text: string
	short: string
	/** Picking it would leave nothing. */
	none: boolean
	search: boolean
}

export function useMoods(d: ProtoDiscover) {
	const [refusedAt, setRefusedAt] = useState(0)
	const isOn = (c: MoodChoice) => (c.tag ? d.isOn(c.tag) : hasWord(d.q, c.word ?? ""))
	const words = MOOD_CHOICES.filter((c) => c.word && isOn(c))
	const moodTags = d.picked.filter((t) => t.group === "moods")
	const used = moodTags.length + words.length
	const toggle = (c: MoodChoice) => {
		const on = isOn(c)
		if (!on && used >= MAX_MOODS) return setRefusedAt(Date.now())
		if (c.tag) d.toggle(c.tag)
		else if (c.word) d.setQ(on ? dropWord(d.q, c.word) : addWord(d.q, c.word))
	}
	const tap = (c: MoodChoice): Tap => {
		if (!c.tag) {
			if (!isOn(c)) return { text: "Mood search", short: "", none: false, search: true }
			if (d.searchBusy || d.total === null) return { text: "Searching", short: "…", none: false, search: true }
			return { text: `${d.total.toLocaleString("en")} found`, short: short(d.total), none: false, search: true }
		}
		return tagTap(d, c.tag)
	}
	return { isOn, toggle, tap, used, words, full: used >= MAX_MOODS, refusedAt }
}
export type Moods = ReturnType<typeof useMoods>

/** What a tap on a filter tag does: its count, or what it adds next to a pick of its group. */
export function tagTap(d: ProtoDiscover, t: Tag): Tap {
	const n = d.countFor(t)
	const on = d.isOn(t)
	const groupPicked = d.picked.some((p) => p.group === t.group)
	// For a pick, the count is what removing it would leave: not worth a line.
	if (on) return { text: "Picked", short: "", none: false, search: false }
	if (n === null) return { text: "", short: "", none: false, search: false }
	if (!on && groupPicked && d.total !== null) {
		const adds = Math.max(0, n - d.total)
		return { text: `Adds ${adds.toLocaleString("en")}`, short: `+${compactCount(adds)}`, none: false, search: false }
	}
	return { text: `${n.toLocaleString("en")} titles`, short: compactCount(n), none: !on && n === 0, search: false }
}

/** Every pick in this tab: filter tags and search mood words. */
export interface Pick {
	id: string
	name: string
	color: string
	island: string
	remove: () => void
}

export function usePicks(d: ProtoDiscover, m: Moods): Pick[] {
	return [
		...d.picked.map((t) => ({
			id: tagId(t),
			name: tagName(t),
			color: t.color,
			island: islandOfTag(t),
			remove: () => d.toggle(t),
		})),
		...m.words.map((c) => ({ id: `word:${c.id}`, name: c.name, color: c.color, island: `mood:${c.id}`, remove: () => m.toggle(c) })),
	]
}

export function clearAll(d: ProtoDiscover, m: Moods) {
	let q = d.q
	for (const c of m.words) q = dropWord(q, c.word ?? "")
	if (q !== d.q) d.setQ(q)
	d.clearTags()
}

// ---------------------------------------------------------------------------------------------------------------
// Mixes: hand-picked combinations of filter tags, each a whole recipe, counted for real with every other filter as is

export interface Mix {
	id: string
	tags: Tag[]
}
const mix = (...ids: string[]): Mix => ({
	id: ids.join("+"),
	tags: ids.map((id) => {
		const [group, key] = id.split(":") as [Tag["group"], string]
		return tag(group, key)
	}),
})

export const MIXES: Mix[] = [
	mix("moods:feelgood", "styles:animated"),
	mix("moods:funny", "themes:crime"),
	mix("moods:scary", "styles:slow"),
	mix("moods:romance", "themes:history"),
	mix("moods:action", "themes:future"),
	mix("moods:heavy", "themes:true"),
	mix("moods:mind", "styles:stylized"),
	mix("moods:funny", "themes:family"),
]

export const mixName = (x: Mix) => x.tags.map(tagName).join(" + ")

export interface MixCount {
	total: number | null
	path: string | null
	/** The mix's first title. */
	top: string | null
}

/** A mix is a whole recipe: it replaces the tab's mood, theme and style picks (like a taste group in My movies). */
function withMix(query: string, x: Mix) {
	const p = new URLSearchParams(query)
	for (const group of ["moods", "themes", "styles"] as const) {
		const keys = x.tags.filter((t) => t.group === group).map((t) => t.key)
		if (keys.length) p.set(group, keys.join(","))
		else p.delete(group)
	}
	return p.toString()
}

/** Each mix's real count and its top title's picture. While a search runs, its ranked list isn't ours: no counts. */
export function useMixes(d: ProtoDiscover, mixes: Mix[] = MIXES) {
	const query = d.filters.query
	const results = useQueries({
		queries: mixes.map((x) => ({
			queryKey: ["lab-mood-mix", x.id, query],
			enabled: d.q === null,
			staleTime: 60_000,
			placeholderData: (prev: DiscoverResults | undefined) => prev,
			queryFn: async ({ signal }: { signal: AbortSignal }) => {
				const response = await fetch(`/api/discover/results?${withMix(query, x)}&page=1`, { signal })
				if (!response.ok) throw new Error(`Mix ${response.status}`)
				return (await response.json()) as DiscoverResults
			},
		})),
	})
	const isOn = (x: Mix) => d.picked.length === x.tags.length && x.tags.every((t) => d.isOn(t))
	const toggle = (x: Mix) => {
		const on = isOn(x)
		d.filters.update((s) => {
			const next = { ...s, moods: [], themes: [], styles: [] } as typeof s
			if (!on) for (const t of x.tags) (next[t.group] as string[]).push(t.key)
			return next
		})
	}
	const count = (i: number): MixCount => {
		const r = results[i]?.data
		const first = r?.cards.find((c) => c.backdrop_path)
		return { total: d.q === null && r ? r.total : null, path: first?.backdrop_path ?? null, top: d.q === null ? (first?.title ?? null) : null }
	}
	return { mixes, isOn, toggle, count }
}
export type Mixes = ReturnType<typeof useMixes>

// ---------------------------------------------------------------------------------------------------------------
// Pieces of display

export function Tick({ on }: { on: boolean }) {
	return (
		<span
			className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-white text-black" : "bg-black/30 ring-1 ring-white/50"}`}
			aria-hidden
		>
			{on && <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

/** A choice as a picture tile and a checkbox, like My movies' shelf tiles. */
export function ArtTile({
	name,
	line,
	hues,
	path,
	on,
	dim,
	foot,
	search = false,
	onClick,
	className = "h-[6.25rem]",
	title,
	small = false,
}: {
	name: string
	line?: string | null
	hues: string[]
	path: string | null
	on: boolean
	dim?: boolean
	foot: ReactNode
	search?: boolean
	onClick: () => void
	className?: string
	title?: string
	small?: boolean
}) {
	return (
		<motion.button
			type="button"
			role="checkbox"
			aria-checked={on}
			title={title}
			onClick={onClick}
			whileTap={{ scale: 0.97 }}
			className={`group relative isolate flex min-w-0 cursor-pointer flex-col ${line || foot ? "justify-between" : "justify-center"} overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${dim ? "opacity-40" : ""}`}
			style={{ boxShadow: on ? `0 8px 28px -8px ${hues[0]}` : undefined }}
		>
			<ChoiceArt
				hues={hues}
				path={path}
				split={hues.length > 1}
				className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
			/>
			<span className="flex items-start justify-between gap-2">
				<span className={`line-clamp-2 min-w-0 break-words font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)] ${small ? "text-[13px]" : "text-[15px]"}`}>{name}</span>
				<Tick on={on} />
			</span>
			{(line || foot) && (
				<span className="block min-w-0 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
					{line && <span className="line-clamp-1 text-xs leading-snug text-white/90">{line}</span>}
					<span className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold tabular-nums text-white/75">
						{search && <MagnifyingGlassIcon className="h-3 w-3 shrink-0" aria-hidden />}
						{foot}
					</span>
				</span>
			)}
		</motion.button>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Without X: taking one pick out (e, j, k). Round 12: slim removal tiles at the grid's end, production's recovery look.

/** One pick to take out: its name, color and what it brings back. */
export interface DropStep {
	id: string
	name: string
	color: string
	/** Titles it brings back; null while unknown. */
	n: number | null
	tap: () => void
}

/**
 * Whether "Without X" shows (three picks or more are the caller's): the narrowing "+ X" cards leave at least one full
 * row of the grid free.
 */
export const showDrops = (narrowing: number, drops: number, slots: number, cols: number) => drops > 0 && narrowing <= slots - cols

/** A slim removal tile: minus, the pick struck through in its color, amber "+ N" it brings back. */
export function WithoutTile({ s, className = "", basis, short = false }: { s: DropStep; className?: string; basis?: string; short?: boolean }) {
	return (
		<motion.button
			type="button"
			whileTap={{ scale: 0.97 }}
			onClick={s.tap}
			aria-label={`Without ${s.name}${s.n ? `, brings back ${s.n.toLocaleString("en")}` : ""}`}
			className={`group flex h-full min-w-0 cursor-pointer items-center rounded-xl bg-white/[0.03] text-left ${short ? "gap-1.5 px-2" : "gap-2 px-3"} outline-none hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-amber-400 ${className}`}
			style={{ boxShadow: `inset 0 0 0 1px ${s.color}59`, flexBasis: basis }}
		>
			<span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ color: s.color, boxShadow: `inset 0 0 0 1px ${s.color}80` }}>
				<MinusIcon className="h-3.5 w-3.5" aria-hidden />
			</span>
			<span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-300 line-through decoration-2 group-hover:text-white" style={{ textDecorationColor: `${s.color}cc` }}>
				{s.name}
			</span>
			{s.n !== null && (
				<span className="flex shrink-0 items-center gap-0.5 text-[13px] font-bold tabular-nums text-amber-400 group-hover:text-amber-300">
					<PlusIcon className="h-3.5 w-3.5" aria-hidden />
					{short ? compactCount(s.n) : s.n.toLocaleString("en")}
				</span>
			)}
		</motion.button>
	)
}

/** The removal tiles in one slim row; they stretch to fill it, more than `cols` scroll sideways under a fade. */
export function WithoutRow({ drops, cols, className = "" }: { drops: DropStep[]; cols: number; className?: string }) {
	const basis = `calc((100% - ${(cols - 1) * 0.5}rem) / ${cols})`
	const more = drops.length > cols
	return (
		<div
			className={`relative flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] ${more ? "[mask-image:linear-gradient(to_right,black_88%,transparent)]" : ""} ${className}`}
		>
			{drops.map((s) => (
				<WithoutTile key={s.id} s={s} basis={basis} short={cols <= 2} className="shrink-0 grow" />
			))}
		</div>
	)
}

/** A small picture chip: a pick (with ×) or a suggestion (with +). */
export function ArtChip({
	name,
	hues,
	path,
	count,
	onRemove,
	onAdd,
}: {
	name: string
	hues: string[]
	path: string | null
	count?: string
	onRemove?: () => void
	onAdd?: () => void
}) {
	const body = (
		<>
			<ChoiceArt hues={hues} path={path} split={hues.length > 1} />
			{onAdd && <PlusIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />}
			<span className="truncate">{name}</span>
			{count && <span className="shrink-0 rounded-md bg-black/30 px-1 text-xs tabular-nums">{count}</span>}
		</>
	)
	const cls =
		"relative isolate inline-flex h-9 max-w-[20rem] shrink-0 items-center gap-1.5 overflow-hidden rounded-xl text-sm font-bold text-white ring-1 [text-shadow:0_1px_4px_rgba(0,0,0,.6)]"
	if (onAdd)
		return (
			<button type="button" onClick={onAdd} className={`${cls} cursor-pointer pl-2 pr-2.5 ring-white/20 hover:ring-white/50`}>
				{body}
			</button>
		)
	return (
		<motion.span
			layout
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			className={`${cls} pl-2.5 ring-white/25`}
			style={{ boxShadow: `0 4px 18px -6px ${hues[0]}` }}
		>
			{body}
			<button
				type="button"
				aria-label={`Remove ${name}`}
				onClick={onRemove}
				className="mr-1.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/25 hover:bg-black/50"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</motion.span>
	)
}

/** The picks as picture chips with Clear, or `empty` when nothing is picked. Fixed height. */
export function PickRow({
	d,
	m,
	art,
	empty,
	right,
}: {
	d: ProtoDiscover
	m: Moods
	art: WorldArt
	empty?: ReactNode
	right?: ReactNode
}) {
	const picks = usePicks(d, m)
	return (
		<div className="flex h-9 min-w-0 items-center gap-2">
			<div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none]">
				{picks.length ? (
					picks.map((p) => <ArtChip key={p.id} name={p.name} hues={[p.color]} path={art.get(p.island)?.path ?? null} onRemove={p.remove} />)
				) : (
					empty
				)}
			</div>
			<PickCount n={picks.length} m={m} />
			{picks.length > 0 && (
				<button
					type="button"
					onClick={() => clearAll(d, m)}
					className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-sm font-semibold text-gray-200 hover:bg-white/10"
				>
					Clear
				</button>
			)}
			{right}
		</div>
	)
}

/** "k of 3" moods; amber and nudged when a fourth was refused. Next to a Moods heading only (f). */
export function MoodCount({ m }: { m: Moods }) {
	return (
		<motion.span
			key={m.refusedAt}
			initial={m.refusedAt ? { x: -4 } : false}
			animate={{ x: 0 }}
			transition={{ type: "spring", stiffness: 900, damping: 12 }}
			className={`shrink-0 text-sm tabular-nums ${m.full ? "font-semibold text-amber-300" : "text-gray-400"}`}
		>
			{m.used} of {MAX_MOODS} moods
		</motion.span>
	)
}

/**
 * How many picks the tab holds ("3 picked"). The mood limit shows only once it matters: at three moods, in amber,
 * nudged when a fourth was refused. Nothing while nothing is picked.
 */
export function PickCount({ n, m }: { n: number; m: Moods }) {
	if (!n) return null
	const limit = `${m.used} of ${MAX_MOODS} moods`
	return (
		<motion.span
			key={m.refusedAt}
			initial={m.refusedAt ? { x: -4 } : false}
			animate={{ x: 0 }}
			transition={{ type: "spring", stiffness: 900, damping: 12 }}
			className="shrink-0 text-sm tabular-nums text-gray-400"
		>
			{m.full && n === m.used ? (
				<span className="font-semibold text-amber-300">{limit}</span>
			) : (
				<>
					{n} picked
					{m.full && <span className="font-semibold text-amber-300"> · {limit}</span>}
				</>
			)}
		</motion.span>
	)
}

/** The mood tiles' grid. */
export function MoodTiles({
	d,
	m,
	art,
	cols = "grid-cols-6",
	tile = "h-[6.25rem]",
	lines = true,
}: {
	d: ProtoDiscover
	m: Moods
	art: WorldArt
	cols?: string
	tile?: string
	lines?: boolean
}) {
	return (
		<div className={`grid gap-2 ${cols}`}>
			{MOOD_CHOICES.map((c) => {
				const on = m.isOn(c)
				const tap = m.tap(c)
				const a = art.get(`mood:${c.id}`)
				return (
					<ArtTile
						key={c.id}
						name={c.name}
						line={lines ? a?.apart : null}
						hues={[c.color]}
						path={a?.path ?? null}
						on={on}
						dim={(!on && m.full) || tap.none}
						search={tap.search}
						foot={tap.text}
						onClick={() => m.toggle(c)}
						className={tile}
						small={!lines}
						title={c.alias ? `Discover's ${c.alias} filter` : c.word ? `Adds "${c.word}" to the search` : undefined}
					/>
				)
			})}
		</div>
	)
}

/** Theme or style chips with hue dots and honest counts. */
export function TagChipRow({ d, tags, wrap = true }: { d: ProtoDiscover; tags: Tag[]; wrap?: boolean }) {
	return (
		<div className={`flex gap-1.5 ${wrap ? "flex-wrap" : "overflow-x-auto [scrollbar-width:none]"}`}>
			{tags.map((t) => {
				const on = d.isOn(t)
				const tap = tagTap(d, t)
				return (
					<motion.button
						key={t.key}
						type="button"
						aria-pressed={on}
						whileTap={{ scale: 0.96 }}
						onClick={() => d.toggle(t)}
						className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
							on
								? "bg-white font-semibold text-gray-950"
								: tap.none
									? "bg-white/[0.02] text-gray-600"
									: "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white"
						}`}
					>
						<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
						{t.name}
						{!on && tap.short && <span className="text-[11px] tabular-nums text-gray-500">{tap.short}</span>}
					</motion.button>
				)
			})}
		</div>
	)
}

/** Themes and styles that would narrow the picks (groups with no pick yet), most titles first. */
export function narrowTags(d: ProtoDiscover, n = 6): Tag[] {
	if (!d.picked.length && d.q === null) return []
	return [...THEME_TAGS, ...STYLE_TAGS]
		.filter((t) => !d.picked.some((p) => p.group === t.group) && (d.countFor(t) ?? 0) > 0)
		.sort((a, b) => (d.countFor(b) ?? 0) - (d.countFor(a) ?? 0))
		.slice(0, n)
}

/** A row of small hue dots. */
export function Dots({ hues }: { hues: string[] }) {
	return (
		<span className="flex shrink-0 -space-x-1" aria-hidden>
			{hues.map((hue, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: two colors can be the same
					key={i}
					className="h-3 w-3 rounded-full ring-2 ring-gray-900"
					style={{ background: hue }}
				/>
			))}
		</span>
	)
}

export const picksIn = (d: ProtoDiscover, group: Tag["group"]) => d.picked.filter((t) => t.group === group).length

// ---------------------------------------------------------------------------------------------------------------
// Genre (copied from shell-parts, which keeps it private)

const GENRE_FOLDS: { label: string; names: string[] }[] = [
	{ label: "Action", names: ["Action", "Action & Adventure"] },
	{ label: "Adventure", names: ["Adventure", "Action & Adventure"] },
	{ label: "Sci-Fi", names: ["Science Fiction", "Sci-Fi & Fantasy"] },
	{ label: "Fantasy", names: ["Fantasy", "Sci-Fi & Fantasy"] },
	{ label: "War", names: ["War", "War & Politics"] },
]
const FOLDED = new Set(GENRE_FOLDS.flatMap((f) => f.names))

/** Genre choices as the tab shows them: folded pairs (Action = Action or Action & Adventure) and the rest one each. */
export function genreUnits(d: ProtoDiscover): { label: string; names: string[]; on: boolean }[] {
	const s = d.filters.state
	const all = Object.keys(d.counts?.optionCounts.genres ?? {})
	for (const g of s.genres) if (!all.includes(g)) all.push(g)
	const units = [
		...GENRE_FOLDS.filter((f) => f.names.some((n) => all.includes(n))),
		...all.filter((n) => !FOLDED.has(n)).map((n) => ({ label: n, names: [n] })),
	]
	return units.map((u) => ({ ...u, on: s.genres.includes(u.names[0]) }))
}

export function genreOptions(d: ProtoDiscover): Option[] {
	const s = d.filters.state
	const oc = d.counts?.optionCounts.genres
	const c = (n: string) => oc?.[n] ?? null
	const units = genreUnits(d)
	const isOn = (u: { on: boolean }) => u.on
	return units.map((u) => {
		const parts = u.names.map(c).filter((x): x is number => x !== null)
		return {
			id: u.label,
			label: u.label,
			active: isOn(u),
			count: parts.length ? parts.reduce((a, b) => a + b, 0) : null,
			toggle: () => {
				const on = units.filter((x) => (x === u ? !isOn(u) : isOn(x)))
				d.filters.set({ genres: [...new Set(on.flatMap((x) => x.names))] })
			},
		}
	})
}

export function GenreChips({ d, limit = 99 }: { d: ProtoDiscover; limit?: number }) {
	return <ChipList options={genreOptions(d)} limit={limit} sort />
}

// ---------------------------------------------------------------------------------------------------------------
// "Everything else": About, Style and Genre folded, one open at a time

export type FoldKey = "themes" | "styles" | "genres"
export const FOLD_TITLE: Record<FoldKey, string> = { themes: "About", styles: "Style", genres: "Genre" }
export const FOLD_LINE: Record<FoldKey, string> = { themes: "what it's about", styles: "how it's told", genres: "any of" }

export function foldCount(d: ProtoDiscover, k: FoldKey) {
	return k === "genres" ? d.filters.state.genres.length : picksIn(d, k)
}
export function foldSize(d: ProtoDiscover, k: FoldKey) {
	return k === "themes" ? THEME_TAGS.length : k === "styles" ? STYLE_TAGS.length : genreOptions(d).length
}
export function foldHues(d: ProtoDiscover, k: FoldKey) {
	return k === "genres" ? [] : (k === "themes" ? THEME_TAGS : STYLE_TAGS).slice(0, 5).map((t) => t.color)
}
const byTagCount = (d: ProtoDiscover, tags: Tag[]) =>
	[...tags].sort((a, b) => Number(d.isOn(b)) - Number(d.isOn(a)) || (d.countFor(b) ?? 0) - (d.countFor(a) ?? 0))

export function FoldBody({ d, k, wrap = true }: { d: ProtoDiscover; k: FoldKey; wrap?: boolean }) {
	if (k === "genres") return <GenreChips d={d} />
	return <TagChipRow d={d} tags={byTagCount(d, k === "themes" ? THEME_TAGS : STYLE_TAGS)} wrap={wrap} />
}

export function FoldHead({
	d,
	k,
	on,
	onClick,
	lineShown = true,
}: {
	d: ProtoDiscover
	k: FoldKey
	on: boolean
	onClick: () => void
	lineShown?: boolean
}) {
	const n = foldCount(d, k)
	return (
		<button
			type="button"
			aria-expanded={on}
			onClick={onClick}
			className={`flex h-11 w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-white ring-1 transition-colors ${on ? "bg-white/10 ring-white/25" : "bg-white/5 ring-white/10 hover:bg-white/10"}`}
		>
			{k !== "genres" && <Dots hues={foldHues(d, k)} />}
			<span>{FOLD_TITLE[k]}</span>
			<span className="truncate font-normal text-gray-400">
				{foldSize(d, k)}
				{lineShown && ` · ${FOLD_LINE[k]}`}
			</span>
			<span className="ml-auto flex items-center gap-2">
				{n > 0 && (
					<span className="rounded-full bg-white px-1.5 text-xs font-bold tabular-nums text-black">
						{n}
						<span className="sr-only"> picked</span>
					</span>
				)}
				<ChevronDownIcon className={`h-4 w-4 opacity-70 transition-transform ${on ? "rotate-180" : ""}`} aria-hidden />
			</span>
		</button>
	)
}

/** Folds in a column of fixed height: the open one takes the room left and scrolls inside. */
export function Folds({ d, keys, first = null, phone = false }: { d: ProtoDiscover; keys: FoldKey[]; first?: FoldKey | null; phone?: boolean }) {
	const [open, setOpen] = useState<FoldKey | null>(first)
	return (
		<div className={`flex flex-col gap-2 ${phone ? "" : "min-h-0 flex-1"}`}>
			{keys.map((k) => (
				<div key={k} className={open === k && !phone ? "flex min-h-0 flex-1 flex-col gap-2" : "contents"}>
					<FoldHead d={d} k={k} on={open === k} onClick={() => setOpen(open === k ? null : k)} />
					{open === k && (
						<motion.div
							initial={{ opacity: 0, y: -4 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.14 }}
							className={phone ? "pb-1" : "min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1"}
						>
							<FoldBody d={d} k={k} />
						</motion.div>
					)}
				</div>
			))}
		</div>
	)
}

/** Mixes as picture chips with real counts. */
export function MixChips({ x, art }: { x: Mixes; art: WorldArt }) {
	return (
		<>
			{x.mixes.map((mx, i) => {
				const c = x.count(i)
				const on = x.isOn(mx)
				const path = c.path ?? art.get(islandOfTag(mx.tags[0]))?.path ?? null
				return on ? null : (
					<ArtChip
						key={mx.id}
						name={mixName(mx)}
						hues={mx.tags.map((t) => t.color)}
						path={path}
						count={c.total !== null ? compactCount(c.total) : undefined}
						onAdd={() => x.toggle(mx)}
					/>
				)
			})}
		</>
	)
}

/** Narrowing suggestions as picture chips. */
export function NarrowChips({ d, art, n = 6 }: { d: ProtoDiscover; art: WorldArt; n?: number }) {
	return (
		<>
			{narrowTags(d, n).map((t) => (
				<ArtChip
					key={tagId(t)}
					name={t.name}
					hues={[t.color]}
					path={art.get(islandOfTag(t))?.path ?? null}
					count={compactCount(d.countFor(t) ?? 0)}
					onAdd={() => d.toggle(t)}
				/>
			))}
		</>
	)
}

export const ROW_FADE = { maskImage: "linear-gradient(to right, black calc(100% - 3rem), transparent)" }

/** Movies or shows as one segmented control, without a heading. */
export function TypeSwitch({ d, count }: { d: ProtoDiscover; count?: (option: string) => number | null }) {
	const c = count ?? ((o: string) => d.counts?.optionCounts.type?.[o] ?? null)
	return (
		<div className="w-[300px] max-w-full shrink-0">
		<Segmented
			label="Movies or shows"
			value={d.filters.state.type}
			onChange={(type) => d.filters.set({ type })}
			options={(["all", "movie", "show"] as const).map((id) => ({ id, label: id === "all" ? "Both" : TYPE_LABELS[id], count: c(id) }))}
		/>
		</div>
	)
}

