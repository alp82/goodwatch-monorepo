// PROTOTYPE (Discover lab, titles g/h/i): what the three round 7 variants share.
// - STEER: the three ways a title steers this list (Like this = Similar to, More like = Loved, Less like = Disliked),
//   drawn as session filter chips (pill, colored thumb, ×), never as a rating.
// - useFilterMatches: moods, themes, styles and genres the bar's text points at ("funny" → Funny mood, Comedy genre).
// - useListNav: ↑ ↓ Enter over a list while focus stays in the bar's field.
import { HandThumbDownIcon, HandThumbUpIcon, Square2StackIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { TAP } from "~/ui/filter-bar/motion"
import type { TitleCard } from "~/server/title-cards.server"
import type { TitleKey } from "~/utils/title-key"
import { type ProtoDiscover, TAGS, type Tag, short, tagId } from "../../../kit"
import { type FoundTitle, POSTER_SM } from "../../shell-parts"
import type { Use } from "./shared"

// ---------------------------------------------------------------------------------------------------------------
// Steering

export const STEER: Record<
	Use,
	{ label: string; word: string; icon: ReactNode; color: string; text: string; idle: string }
> = {
	similarTo: {
		label: "Like this",
		word: "like",
		icon: <Square2StackIcon />,
		color: "#fb7185",
		text: "text-rose-200",
		idle: "hover:text-rose-200 hover:bg-rose-400/[0.12]",
	},
	loved: {
		label: "More like",
		word: "more like",
		icon: <HandThumbUpIcon />,
		color: "#34d399",
		text: "text-emerald-200",
		idle: "hover:text-emerald-200 hover:bg-emerald-400/[0.12]",
	},
	disliked: {
		label: "Less like",
		word: "less like",
		icon: <HandThumbDownIcon />,
		color: "#f87171",
		text: "text-red-200",
		idle: "hover:text-red-200 hover:bg-red-400/[0.12]",
	},
}
export const STEER_ORDER: Use[] = ["loved", "disliked", "similarTo"]

export const chipStyle = (color: string) => ({ background: `${color}26`, boxShadow: `inset 0 0 0 1px ${color}99` })

/** A steering pick as a session filter chip: colored thumb, tiny poster, name, ×. */
export function SteerChip({
	use,
	title,
	poster,
	onRemove,
	prefix,
	size = "md",
}: {
	use: Use
	title: string
	poster?: string | null
	onRemove: () => void
	/** Words before the name, e.g. "more like". */
	prefix?: string
	size?: "md" | "sm"
}) {
	const s = STEER[use]
	const h = size === "md" ? "h-9 text-[14px]" : "h-8 text-[13px]"
	return (
		<motion.span
			layout="position"
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			className={`inline-flex max-w-full shrink-0 items-center rounded-full font-semibold whitespace-nowrap text-white ${h}`}
			style={chipStyle(s.color)}
		>
			<span className={`flex min-w-0 items-center gap-1.5 pl-1.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 ${s.text}`}>
				{poster !== undefined && <MiniPoster poster={poster} />}
				{s.icon}
				{prefix && <span className="font-normal">{prefix}</span>}
				<span className="truncate text-white">{title}</span>
			</span>
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${title}`}
				className="grid h-full w-8 shrink-0 place-items-center rounded-r-full text-white/50 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</motion.span>
	)
}

export function MiniPoster({ poster, w = 20 }: { poster: string | null; w?: number }) {
	return (
		<span className="block shrink-0 overflow-hidden rounded-[4px] bg-white/10" style={{ width: w, height: Math.round(w * 1.5) }}>
			{poster && <img src={`${POSTER_SM}${poster}`} alt="" loading="lazy" className="h-full w-full object-cover" />}
		</span>
	)
}

/**
 * One steering toggle for one title. Off: a quiet round thumb. On: the same thumb inside a colored chip with ×, the
 * look of an active filter, so it reads as "on for this list" rather than a saved vote.
 */
export function SteerToggle({ use, on, onToggle, wide = false }: { use: Use; on: boolean; onToggle: () => void; wide?: boolean }) {
	const s = STEER[use]
	if (on)
		return (
			<motion.button
				type="button"
				whileTap={TAP}
				aria-pressed
				onClick={onToggle}
				title={`Remove ${s.label}`}
				className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full pr-2 pl-2.5 text-[13px] font-semibold whitespace-nowrap text-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5 ${s.text}`}
				style={chipStyle(s.color)}
			>
				{s.icon}
				<span className="text-white">{s.label}</span>
				<XMarkIcon className="!h-3 !w-3 text-white/60" />
			</motion.button>
		)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={false}
			aria-label={s.label}
			title={s.label}
			onClick={onToggle}
			className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap text-gray-400 ring-1 ring-inset ring-white/10 cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5 ${s.idle} ${wide ? "px-3" : "w-8"}`}
		>
			{s.icon}
			{wide && s.label}
		</motion.button>
	)
}

/** A result card as a found title (to steer with). */
export const cardTitle = (c: TitleCard): FoundTitle => ({
	key: c.key,
	title: c.title,
	year: c.release_year ? String(c.release_year) : "",
	poster: c.poster_path,
	mediaType: c.media_type === "movie" ? "movie" : "show",
	tmdbId: c.tmdb_id,
})

/**
 * The empty state of a place picks land in (round 9): a few titles of this list as quiet chips with that place's
 * thumb; one tap puts the title there. No empty slots.
 */
export function SuggestChips({ titles, use, onPick, n = 3 }: { titles: FoundTitle[]; use: Use; onPick: (t: FoundTitle) => void; n?: number }) {
	const s = STEER[use]
	return (
		<>
			{titles.slice(0, n).map((t) => (
				<motion.button
					key={t.key}
					type="button"
					whileTap={TAP}
					onClick={() => onPick(t)}
					title={`${s.label} ${t.title}`}
					className="inline-flex h-8 max-w-[220px] shrink-0 items-center gap-1.5 rounded-full bg-white/[0.04] pr-3 pl-1 text-[13px] text-gray-400 ring-1 ring-inset ring-white/[0.08] cursor-pointer outline-none transition-colors hover:bg-white/[0.09] hover:text-gray-100 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<MiniPoster poster={t.poster} w={18} />
					<span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5" style={{ color: s.color }}>
						{s.icon}
					</span>
					<span className="truncate">{t.title}</span>
				</motion.button>
			))}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Filters the text points at

const ALIASES: { words: string[]; tags?: string[]; genres?: string[] }[] = [
	{ words: ["funny", "fun", "laugh", "comedy", "comedies", "hilarious", "witty"], tags: ["moods:funny"], genres: ["Comedy"] },
	{ words: ["feel", "feelgood", "cozy", "cosy", "uplifting", "wholesome", "warm"], tags: ["moods:feelgood"], genres: ["Family"] },
	{ words: ["romantic", "romance", "love", "date"], tags: ["moods:romance"], genres: ["Romance"] },
	{ words: ["action", "fight", "explosive"], tags: ["moods:action"], genres: ["Action", "Action & Adventure"] },
	{ words: ["crime", "mystery", "detective", "heist", "murder"], tags: ["moods:crime"], genres: ["Crime", "Mystery"] },
	{ words: ["twist", "mind", "trippy", "bending", "puzzle"], tags: ["moods:mind"] },
	{ words: ["sad", "heavy", "drama", "tearjerker", "bleak"], tags: ["moods:heavy"], genres: ["Drama"] },
	{ words: ["space", "fantasy", "sci-fi", "scifi", "future", "magic"], tags: ["moods:worlds"], genres: ["Science Fiction", "Sci-Fi & Fantasy", "Fantasy"] },
	{ words: ["history", "historical", "period", "war"], tags: ["moods:history"], genres: ["History", "War"] },
	{ words: ["teen", "school", "growing", "youth"], tags: ["moods:growing"] },
	{ words: ["thriller", "tense", "suspense"], genres: ["Thriller"] },
	{ words: ["animated", "animation", "cartoon"], genres: ["Animation"] },
	{ words: ["documentary", "docu"], genres: ["Documentary"] },
]

export interface FilterMatch {
	id: string
	label: string
	/** Mood hue or the group's color. */
	color: string | null
	group: "Mood" | "About" | "Style" | "Genre"
	on: boolean
	count: number | null
	toggle: () => void
}

const GROUP_NAME = { moods: "Mood", themes: "About", styles: "Style" } as const

/** Moods, themes, styles and genres the text points at, best first, at most `n`. */
export function useFilterMatches(d: ProtoDiscover, text: string, n = 6): FilterMatch[] {
	const words = text
		.toLowerCase()
		.split(/[^a-z0-9-]+/)
		.filter((w) => w.length >= 3)
	if (!words.length) return []
	const tagIds = new Set<string>()
	const genres = new Set<string>()
	for (const a of ALIASES) {
		if (!words.some((w) => a.words.some((x) => x.startsWith(w) || w.startsWith(x)))) continue
		for (const t of a.tags ?? []) tagIds.add(t)
		for (const g of a.genres ?? []) genres.add(g)
	}
	for (const t of TAGS) {
		const name = t.name.toLowerCase()
		if (words.some((w) => name.split(/[^a-z]+/).some((p) => p.length >= 3 && (p.startsWith(w) || w.startsWith(p))))) tagIds.add(tagId(t))
	}
	const known = Object.keys(d.counts?.optionCounts.genres ?? {})
	for (const g of known) {
		const name = g.toLowerCase()
		if (words.some((w) => name.split(/[^a-z]+/).some((p) => p.length >= 3 && p.startsWith(w)))) genres.add(g)
	}
	const s = d.filters.state
	const tags: FilterMatch[] = TAGS.filter((t) => tagIds.has(tagId(t))).map((t: Tag) => ({
		id: tagId(t),
		label: t.name,
		color: t.color,
		group: GROUP_NAME[t.group],
		on: d.isOn(t),
		count: d.countFor(t),
		toggle: () => d.toggle(t),
	}))
	const genreList: FilterMatch[] = [...genres]
		.filter((g) => !known.length || known.includes(g) || s.genres.includes(g))
		.map((g) => ({
			id: `genre:${g}`,
			label: g,
			color: null,
			group: "Genre" as const,
			on: s.genres.includes(g),
			count: d.counts?.optionCounts.genres?.[g] ?? null,
			toggle: () => d.filters.set({ genres: s.genres.includes(g) ? s.genres.filter((x) => x !== g) : [...s.genres, g] }),
		}))
	return [...tags.sort((a, b) => Number(b.group === "Mood") - Number(a.group === "Mood")), ...genreList].slice(0, n)
}

/** A filter the text points at, as the sheet's chip: hue dot, name, what it would leave. */
export function FilterMatchChip({ m, active = false }: { m: FilterMatch; active?: boolean }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={m.on}
			onClick={m.toggle}
			className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				m.on ? "text-white" : "bg-white/[0.06] text-gray-200 ring-1 ring-inset ring-white/10 hover:bg-white/[0.11]"
			} ${active ? "ring-2 ring-amber-400/80" : ""}`}
			style={m.on ? chipStyle(m.color ?? "#94a3b8") : undefined}
		>
			<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.color ?? "#94a3b8" }} />
			<span className="text-[11px] font-normal text-gray-400">{m.group}</span>
			{m.label}
			{m.on ? (
				<XMarkIcon className="h-3.5 w-3.5 text-white/60" />
			) : (
				m.count != null && <span className="text-[12px] font-normal tabular-nums text-gray-500">{short(m.count)}</span>
			)}
		</motion.button>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Keyboard: ↑ ↓ Enter over a list while the bar's field keeps focus

const inBar = () => {
	const el = document.activeElement
	return el instanceof HTMLInputElement && el.getAttribute("aria-label") === "Search"
}

/**
 * The highlighted row of a list of `count` rows, moved by ↑ ↓ while typing in the bar. With `firstIsBar`, row 0 is
 * highlighted from the start and Enter on it is left to the bar (it runs the search); otherwise nothing is highlighted
 * until an arrow moves. Enter on a highlighted row calls `onEnter(i)`. Resets when `reset` changes.
 */
export function useListNav(count: number, onEnter: (i: number) => void, reset: unknown, firstIsBar: boolean) {
	const start = firstIsBar ? 0 : -1
	const [active, setActive] = useState(start)
	const live = useRef({ count, onEnter, active, firstIsBar })
	live.current = { count, onEnter, active, firstIsBar }
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset is the trigger
	useEffect(() => setActive(start), [reset, start])
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!inBar()) return
			const { count, onEnter, active, firstIsBar } = live.current
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				if (!count) return
				e.preventDefault()
				e.stopPropagation()
				const step = e.key === "ArrowDown" ? 1 : -1
				setActive((a) => Math.max(firstIsBar ? 0 : -1, Math.min(count - 1, a + step)))
			} else if (e.key === "Enter" && active >= 0 && active < count && !(firstIsBar && active === 0)) {
				e.preventDefault()
				e.stopPropagation()
				onEnter(active)
			}
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])
	useEffect(() => {
		if (active >= count) setActive(count - 1)
	}, [active, count])
	return { active, setActive }
}

export type Known = (k: TitleKey) => { title: string; year: string; poster: string | null } | undefined
