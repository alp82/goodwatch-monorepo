// PROTOTYPE - throwaway. The filter categories variants O and X organize their side nav / side tabs by: the common ones
// first (Mood, Streaming, Type, Genre, Score, Released), then the niche ones under "More". Each category has a short
// active value for the nav, and a pane: Mood, About and Style are hue chips with counts (M's mood filter); the others
// are the real filter card, shown alone (FilterGroups' card stack with the other cards hidden by CSS).
import { useEffect, useState } from "react"
import { dropFilter, type FilterState } from "~/domain/filter-state"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups } from "~/ui/filter-bar"
import { NotSeenSwitch, ServicesControl } from "~/ui/filter-bar/controls"
import {
	type CardKey,
	cardOf,
	focusSheetOn,
} from "~/ui/filter-bar/filter-cards"
import { type ActiveChip, TYPE_LABELS } from "~/ui/filter-bar/labels"
import { Chip, type Option, byCount } from "~/ui/filter-bar/SheetControls"
import { XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import {
	type ProtoDiscover,
	TAGS,
	type Tag,
	type TagGroup,
	tagId,
	type useFilterPieces,
} from "../kit"

export type Pieces = ReturnType<typeof useFilterPieces>

export type CatKey =
	| "moods"
	| "services"
	| "type"
	| "genres"
	| "minScore"
	| "released"
	| "themes"
	| "styles"
	| "runtime"
	| "minMatch"
	| "sourceScores"
	| "scoreGap"
	| "similarTo"
	| "people"
	| "productionCountries"
	| "ageLimit"
	| "loved"
	| "disliked"

export interface Cat {
	key: CatKey
	label: string
	/** What the nav shows while nothing is set (common ones only). */
	idle?: string
}

export const COMMON: Cat[] = [
	{ key: "moods", label: "Mood", idle: "Any mood" },
	{ key: "services", label: "Streaming", idle: "Everywhere" },
	{ key: "type", label: "Type", idle: "Movies & shows" },
	{ key: "genres", label: "Genre", idle: "Any genre" },
	{ key: "minScore", label: "Score", idle: "Any score" },
	{ key: "released", label: "Released", idle: "Any year" },
]
const NICHE_ALL: Cat[] = [
	{ key: "themes", label: "About" },
	{ key: "styles", label: "Style" },
	{ key: "runtime", label: "Length" },
	{ key: "minMatch", label: "Taste match" },
	{ key: "sourceScores", label: "Scores by source" },
	{ key: "scoreGap", label: "Critics vs audiences" },
	{ key: "similarTo", label: "Similar to" },
	{ key: "people", label: "Cast and crew" },
	{ key: "productionCountries", label: "Production country" },
	{ key: "ageLimit", label: "Age and content" },
	{ key: "loved", label: "Loved" },
	{ key: "disliked", label: "Disliked" },
]
/** The niche categories this viewer gets: Age and content needs a rating ladder. */
export const nicheFor = (pieces: Pieces) =>
	NICHE_ALL.filter((c) => c.key !== "ageLimit" || pieces.groups.ladder)
export const ALL_CATS = [...COMMON, ...NICHE_ALL]
export const catLabel = (k: CatKey) =>
	ALL_CATS.find((c) => c.key === k)?.label ?? k

const TAG_CATS = new Set<CatKey>(["moods", "themes", "styles"])

// ---------------------------------------------------------------------------------------------------------------
// Values

const tagNames = (d: ProtoDiscover, group: TagGroup) =>
	d.picked
		.filter((t) => t.group === group)
		.map((t) => t.name)
		.join(", ")

/** The active value of every category, in a few words, or null while it's at its default. */
export function catValues(
	d: ProtoDiscover,
	pieces: Pieces,
): Record<CatKey, string | null> {
	const s = d.filters.state
	const out = {} as Record<CatKey, string | null>
	for (const c of ALL_CATS) {
		if (TAG_CATS.has(c.key)) {
			out[c.key] = tagNames(d, c.key as TagGroup) || null
			continue
		}
		if (c.key === "services") {
			out.services = s.onMyServices
				? "My services"
				: s.services?.length
					? s.services.length === 1
						? (pieces.services.countryProviders.find(
								(p) => p.id === s.services?.[0],
							)?.name ?? "1 service")
						: `${s.services.length} services`
					: s.anyService
						? "Any service"
						: null
			continue
		}
		if (c.key === "type") {
			out.type =
				s.type !== "all" || s.anime !== "any"
					? pieces.chips
							.filter((ch) => cardOf(ch.group) === "type")
							.map((ch) => ch.label)
							.join(", ") || TYPE_LABELS[s.type]
					: null
			continue
		}
		const labels = pieces.chips
			.filter((ch) => cardOf(ch.group) === c.key)
			.map((ch) => ch.label)
		out[c.key] = labels.length ? labels.join(", ") : null
	}
	return out
}

/** The state without this category's choice. */
export function clearedCat(state: FilterState, k: CatKey): FilterState {
	if (k === "released")
		return dropFilter(dropFilter(state, "released"), "years")
	if (k === "type") return dropFilter(dropFilter(state, "type"), "anime")
	if (k === "ageLimit")
		return dropFilter(dropFilter(state, "ageLimit"), "content")
	if (k === "services")
		return {
			...state,
			onMyServices: false,
			anyService: undefined,
			services: undefined,
		}
	return dropFilter(state, k)
}

// ---------------------------------------------------------------------------------------------------------------
// Tag chips (M's mood filter)

const BY_GROUP: Record<TagGroup, Tag[]> = {
	moods: TAGS.filter((t) => t.group === "moods"),
	themes: TAGS.filter((t) => t.group === "themes"),
	styles: TAGS.filter((t) => t.group === "styles"),
}
export const MOOD_TAGS = BY_GROUP.moods

const tagOption = (d: ProtoDiscover, t: Tag): Option => ({
	id: tagId(t),
	label: t.name,
	active: d.isOn(t),
	count: d.countFor(t),
	toggle: () => d.toggle(t),
	swatch: (
		<span
			className="h-2.5 w-2.5 shrink-0 rounded-full"
			style={{ background: t.color }}
		/>
	),
})

/** Overlapping hue dots for the picked moods, or the mood hues dimmed when none is picked. */
export function HueDots({ tags, size = 12 }: { tags: Tag[]; size?: number }) {
	const moods = tags.filter((t) => t.group === "moods")
	const shown = moods.length ? moods.slice(0, 3) : MOOD_TAGS.slice(0, 3)
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			{shown.map((t, i) => (
				<span
					key={tagId(t)}
					className={`rounded-full ring-2 ring-gray-950 ${moods.length ? "" : "opacity-50"}`}
					style={{
						width: size,
						height: size,
						background: t.color,
						marginLeft: i ? -size / 3 : 0,
					}}
				/>
			))}
		</span>
	)
}

/** The picked moods in one line: "Funny + Feel-good", "+1" past two. */
export function moodLabel(d: ProtoDiscover) {
	const moods = d.picked.filter((t) => t.group === "moods")
	if (!moods.length) return null
	const head = moods
		.slice(0, 2)
		.map((t) => t.name)
		.join(" + ")
	return moods.length > 2 ? `${head} +${moods.length - 2}` : head
}

function TagPane({ d, group }: { d: ProtoDiscover; group: TagGroup }) {
	const all = BY_GROUP[group].map((t) => tagOption(d, t))
	// Moods keep their own order (it's the order people know); About and Style go by what they'd leave.
	const options = group === "moods" ? all : byCount(all)
	return (
		<div className="flex flex-wrap gap-1.5">
			{options.map((o) => (
				<div
					key={o.id}
					title={BY_GROUP[group].find((t) => tagId(t) === o.id)?.description}
				>
					<Chip o={o} />
				</div>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// One real filter card, alone

const ONE_CARD_CSS = [
	...ALL_CATS.filter((c) => !TAG_CATS.has(c.key)).map(
		(c) =>
			`.oc-card[data-card="${c.key}"] > div > div.flex-col > *:not(:has(#filter-card-${c.key})) { display: none !important }`,
	),
	`.oc-card section[id^="filter-card-"] { background: transparent !important; box-shadow: none !important; padding: 0 !important }`,
	`.oc-card section[id^="filter-card-"] > div:first-child { display: none !important }`,
].join("\n")

/** Put once on a page that shows category panes. */
export function OneCardStyle() {
	// biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS; a plain <style>{css}</style> breaks hydration
	return <style dangerouslySetInnerHTML={{ __html: ONE_CARD_CSS }} />
}

function CardPane({ pieces, k }: { pieces: Pieces; k: CardKey }) {
	// The card stack starts with the card it's asked to open at; the CSS above hides every other card.
	useState(() => {
		focusSheetOn(k)
		return k
	})
	return (
		<div className="oc-card" data-card={k}>
			<FilterGroups data={pieces.groups} query="" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// A category's pane

export function CatPane({
	d,
	pieces,
	cat,
	niche = false,
}: {
	d: ProtoDiscover
	pieces: Pieces
	cat: CatKey
	niche?: boolean
}) {
	const value = catValues(d, pieces)[cat]
	const picks = TAG_CATS.has(cat)
		? d.picked.filter((t) => t.group === cat).length
		: 0
	const note = TAG_CATS.has(cat)
		? picks
			? `Any of these · ${picks} of 3`
			: "Up to 3"
		: null
	return (
		<section aria-label={catLabel(cat)}>
			<header className="mb-4 flex h-8 items-center gap-2.5">
				<h2
					className={`font-bold text-white ${niche ? "text-[16px]" : "text-[19px]"}`}
				>
					{catLabel(cat)}
				</h2>
				{note && <span className="text-[12px] text-gray-500">{note}</span>}
				{value && (
					<button
						type="button"
						onClick={() => d.filters.update((s) => clearedCat(s, cat))}
						className="ml-auto rounded-md px-2 py-1 text-[13px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
			</header>
			{TAG_CATS.has(cat) ? (
				<TagPane d={d} group={cat as TagGroup} />
			) : cat === "services" ? (
				<div className="flex flex-col gap-5">
					<div className="flex flex-wrap items-center gap-2.5">
						<ServicesControl {...pieces.servicesProps} size="sm" />
						<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
					</div>
					<CardPane key={cat} pieces={pieces} k="services" />
				</div>
			) : (
				<CardPane key={cat} pieces={pieces} k={cat as CardKey} />
			)}
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Shared bits for the page

export function useIsDesktop() {
	const [wide, setWide] = useState(false)
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 1024px)")
		const on = () => setWide(mq.matches)
		on()
		mq.addEventListener("change", on)
		return () => mq.removeEventListener("change", on)
	}, [])
	return wide
}

/** The mood search as a filter value: "Read as" and its chips, with × to drop the search. */
export function MoodSearchValue({
	d,
	onEdit,
	readOnly = false,
}: {
	d: ProtoDiscover
	onEdit?: () => void
	/** Only the Read as chips, for a bar whose field already shows the search as a value. */
	readOnly?: boolean
}) {
	if (!d.q) return null
	return (
		<span className="flex shrink-0 items-center gap-2">
			{!readOnly && (
				<span className="flex h-8 shrink-0 items-center rounded-full bg-amber-400/[0.12] text-[13px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/40">
					<button
						type="button"
						onClick={onEdit}
						disabled={!onEdit}
						className="h-full rounded-l-full pl-3 pr-1 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default"
					>
						<span className="search-private ph-no-capture sentry-mask block max-w-[16rem] truncate">
							“{d.q}”
						</span>
					</button>
					<button
						type="button"
						aria-label="Remove the mood search"
						onClick={() => d.setQ(null)}
						className="mr-1 grid h-6 w-6 place-items-center rounded-full text-amber-200/70 cursor-pointer outline-none hover:bg-amber-400/20 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-3.5 w-3.5" />
					</button>
				</span>
			)}
			{d.reading.length > 0 && (
				<span className="flex shrink-0 items-center gap-1.5">
					<span className="text-[12px] text-gray-500">Read as</span>
					<ReadAsChips reading={d.reading} />
				</span>
			)}
			{d.searchBusy && !d.reading.length && (
				<span className="text-[12px] text-gray-500">Reading…</span>
			)}
		</span>
	)
}

/** A picked value in the status line, with its hue for tags, and × to take it off. */
export function ValueChip({
	chip,
	onRemove,
}: { chip: ActiveChip; onRemove: () => void }) {
	const m = chip.key.match(/^(mood|theme|style)-(.+)$/)
	const group = m
		? m[1] === "mood"
			? "moods"
			: m[1] === "theme"
				? "themes"
				: "styles"
		: null
	const color = group
		? TAGS.find((t) => t.group === group && t.key === m?.[2])?.color
		: undefined
	return (
		<motion.button
			type="button"
			whileTap={{ scale: 0.94 }}
			onClick={onRemove}
			aria-label={`Remove ${chip.label}`}
			className={`group inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full pr-2 pl-3 text-[13px] outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${color ? "font-semibold text-white" : "bg-white/[0.06] text-gray-100 hover:bg-white/10"}`}
			style={
				color
					? {
							background: `${color}2e`,
							boxShadow: `inset 0 0 0 1px ${color}99`,
						}
					: undefined
			}
		>
			{color && (
				<span className="h-2 w-2 rounded-full" style={{ background: color }} />
			)}
			{chip.label.replace(/^Produced in /, "Made in ")}
			<XMarkIcon
				className="h-3.5 w-3.5 text-gray-500 group-hover:text-white"
				aria-hidden
			/>
		</motion.button>
	)
}

export const PAGE_TITLE = "Discover movies and TV shows"
