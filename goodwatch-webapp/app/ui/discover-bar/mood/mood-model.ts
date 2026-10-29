// The Mood tab's model: the options of its four columns (Feel, About, Style, Genre), how a group's picks join (the "all
// of" / "any of" switch), what each option would leave, and the Combos grid's cards. Pure, no React.
//
// A column's switch is view state, on all of by default. `all=<group>` goes into the filter state only while the
// group has two picks or more and its switch is on all of; with fewer picks both modes filter the same, so the URL
// stays without it. A group with two picks or more and no `all` entry is any of (links written elsewhere).
//
// Counts: the results' option counts follow the filter state, so a group with `all` counts all of and any other
// group counts any of. A group on all of with one pick has no `all` entry yet, so its counts come from a second
// answer without the group's pick: P and X = P + X - (P or X).
import {
	type FilterOptionCounts,
	type FilterState,
	TAG_GROUPS,
	type TagGroup,
} from "~/domain/filter-state"
import { GENRE_FOLDS } from "~/domain/genre-fold"
import { type MoodMix, stateForMix } from "~/domain/mood-mixes"
import { MAX_MOODS, MOODS, MOOD_BY_KEY } from "~/domain/moods"
import { WORD_BY_ID, picksOf } from "~/domain/taste-picker"
import { MAX_STYLES, MAX_THEMES, STYLES, THEMES } from "~/domain/themes-styles"

export type Mode = "all" | "any"
/** Each column's switch as last set; a group without an entry is all of. */
export type ModePrefs = Partial<Record<TagGroup, Mode>>
export type Modes = Record<TagGroup, Mode>

/** One row of a column. */
export interface MoodOption {
	/** The mood, theme or style key, or a genre unit's label. */
	id: string
	group: TagGroup
	name: string
	hue: string
	/** What it puts into `state[group]`: one key, or a genre unit's names (Action is Action and Action & Adventure). */
	values: string[]
	/** The Explorer island whose picture it uses ("mood:cozy", "theme:crime"); null for genres. */
	island: string | null
}

export const COLUMNS: readonly { group: TagGroup; label: string }[] = [
	{ group: "moods", label: "Feel" },
	{ group: "themes", label: "About" },
	{ group: "styles", label: "Style" },
	{ group: "genres", label: "Genre" },
]

const GENRE_HUE = "#9ca3af"

export const CAPS: Record<TagGroup, number> = {
	moods: MAX_MOODS,
	themes: MAX_THEMES,
	styles: MAX_STYLES,
	genres: Number.POSITIVE_INFINITY,
}

const FOLDED = new Set(GENRE_FOLDS.flatMap((fold) => fold.names))

const moodOption = (key: (typeof MOODS)[number]["key"]): MoodOption => {
	const mood = MOOD_BY_KEY[key]
	return {
		id: key,
		group: "moods",
		name: mood.name,
		hue: mood.hue,
		values: [key],
		// The Explorer's mood islands are named like the feel moods ("cozy" is Cozy).
		island: mood.feel ? `mood:${mood.name.toLowerCase()}` : null,
	}
}

/**
 * Feel lists the feel moods; a topic mood (Crime & mystery, History, ...) shows only while picked, since About covers
 * it, so a link that has one can still drop it here.
 */
function moodOptions(state: FilterState): MoodOption[] {
	return MOODS.filter(
		(mood) => mood.feel || state.moods.includes(mood.key),
	).map((mood) => moodOption(mood.key))
}

/** Genre units: the folded pairs (as one row each), then every other genre the counts know or the state picks. */
export function genreOptions(
	state: FilterState,
	known: readonly string[],
): MoodOption[] {
	const names = [...new Set([...known, ...state.genres])]
	const folds = GENRE_FOLDS.filter((fold) =>
		fold.names.some((name) => names.includes(name)),
	)
	return [
		...folds.map((fold) => ({ label: fold.label, values: fold.names })),
		...names
			.filter((name) => !FOLDED.has(name))
			.map((name) => ({ label: name, values: [name] })),
	].map(({ label, values }) => ({
		id: label,
		group: "genres" as const,
		name: label,
		hue: GENRE_HUE,
		values,
		island: null,
	}))
}

/** Every column's options, in COLUMNS order. */
export function moodOptionsOf(
	state: FilterState,
	counts: Partial<FilterOptionCounts> | null,
): Record<TagGroup, MoodOption[]> {
	return {
		moods: moodOptions(state),
		themes: THEMES.map((theme) => ({
			id: theme.id,
			group: "themes" as const,
			name: theme.name,
			hue: theme.color,
			values: [theme.id],
			island: `theme:${theme.id}`,
		})),
		styles: STYLES.map((style) => ({
			id: style.id,
			group: "styles" as const,
			name: style.name,
			hue: style.color,
			values: [style.id],
			island: `style:${style.id}`,
		})),
		genres: genreOptions(state, Object.keys(counts?.genres ?? {})),
	}
}

const picksIn = (state: FilterState, group: TagGroup): readonly string[] =>
	state[group]

export const isPicked = (state: FilterState, option: MoodOption): boolean =>
	picksIn(state, option.group).includes(option.values[0])

/** How many picks a group holds; a folded genre pair is one. */
export function pickCount(state: FilterState, group: TagGroup): number {
	if (group !== "genres") return new Set(picksIn(state, group)).size
	const units = genreOptions(state, [])
	const counted = units.filter((unit) => isPicked(state, unit)).length
	// A combined TV genre picked on its own (an older link) is still a pick.
	const covered = new Set(
		units
			.filter((unit) => isPicked(state, unit))
			.flatMap((unit) => unit.values),
	)
	return counted + state.genres.filter((name) => !covered.has(name)).length
}

export const atCap = (state: FilterState, group: TagGroup): boolean =>
	pickCount(state, group) >= CAPS[group]

/** How a group's picks join now: from the filter state from two picks on, else the switch as last set. */
export function modeOf(
	state: FilterState,
	group: TagGroup,
	prefs: ModePrefs,
): Mode {
	if (pickCount(state, group) >= 2)
		return state.allOf?.includes(group) ? "all" : "any"
	return prefs[group] ?? "all"
}

export const modesOf = (state: FilterState, prefs: ModePrefs): Modes =>
	Object.fromEntries(
		TAG_GROUPS.map((group) => [group, modeOf(state, group, prefs)]),
	) as Modes

/** `allOf` for these modes: the groups on all of with two picks or more. */
export function withAllOf(state: FilterState, modes: Modes): FilterState {
	const allOf = TAG_GROUPS.filter(
		(group) => modes[group] === "all" && pickCount(state, group) >= 2,
	)
	return { ...state, allOf: allOf.length ? allOf : undefined }
}

export interface MoodChange {
	state: FilterState
	prefs: ModePrefs
}

/**
 * Picks or drops an option; null when the group is at its cap. Every group keeps the mode it shows, so a second pick
 * on an all-of column writes `all=<group>` and dropping to one pick removes it.
 */
export function togglePick(
	state: FilterState,
	option: MoodOption,
	prefs: ModePrefs,
): MoodChange | null {
	const { group, values } = option
	const on = isPicked(state, option)
	if (!on && atCap(state, group)) return null
	const modes = modesOf(state, prefs)
	let next: string[]
	if (on) {
		// Keep a name another picked unit still needs (Action & Adventure is in Action and in Adventure).
		const needed = new Set(
			genreOptions(state, [])
				.filter((unit) => unit.id !== option.id && isPicked(state, unit))
				.flatMap((unit) => unit.values),
		)
		next = picksIn(state, group).filter(
			(value) =>
				!values.includes(value) || (group === "genres" && needed.has(value)),
		)
	} else next = [...new Set([...picksIn(state, group), ...values])]
	return {
		state: withAllOf({ ...state, [group]: next } as FilterState, modes),
		prefs: { ...prefs, ...modes },
	}
}

/** Sets a column's switch. */
export function setMode(
	state: FilterState,
	group: TagGroup,
	mode: Mode,
	prefs: ModePrefs,
): MoodChange {
	const modes = { ...modesOf(state, prefs), [group]: mode }
	return { state: withAllOf(state, modes), prefs: { ...prefs, ...modes } }
}

/** The groups whose counts need the answer without their pick: one pick, on all of. */
export const groupsNeedingCleared = (
	state: FilterState,
	prefs: ModePrefs,
): TagGroup[] =>
	TAG_GROUPS.filter(
		(group) =>
			pickCount(state, group) === 1 && modeOf(state, group, prefs) === "all",
	)

/** The results parameters without a group's picks (and without its `all` entry). */
export function clearedQuery(query: string, group: TagGroup): string {
	const params = new URLSearchParams(query)
	params.delete(group)
	const all = (params.get("all") ?? "")
		.split(",")
		.filter((name) => name && name !== group)
	if (all.length) params.set("all", all.join(","))
	else params.delete("all")
	params.delete("page")
	return params.toString()
}

export interface CountInputs {
	state: FilterState
	prefs: ModePrefs
	/** The list's count; null while unknown. */
	total: number | null
	/** Titles recovered by clearing each group. */
	recoveries?: readonly { filter: string; titles: number }[]
	/** The results' option counts. */
	counts: Partial<FilterOptionCounts> | null
	/** Per group in groupsNeedingCleared: that group's option counts from the answer without its pick. */
	cleared: Partial<Record<TagGroup, Record<string, number> | null>>
}

/** Titles with any of the group's picks or the option (Discover's own any-of rule), for a genre unit. */
function anyOfUnit(
	option: MoodOption,
	state: FilterState,
	oc: Record<string, number>,
	total: number,
): number | null {
	// With picks, each name's count is the list plus what it adds; without, the titles that have it.
	const base = state.genres.length ? total : 0
	let n = base
	for (const name of option.values) {
		if (state.genres.includes(name)) continue
		const c = oc[name]
		if (c === undefined) continue
		n += c - base
	}
	return n
}

/**
 * What an option would leave, the rest as it is, under its column's mode: all of counts the titles with every pick and
 * the option, any of the widening. A picked option counts removing it; null while unknown.
 */
export function optionCount(
	option: MoodOption,
	inputs: CountInputs,
): number | null {
	const { state, prefs, total, counts, cleared } = inputs
	const { group } = option
	const oc = counts?.[group]
	if (!oc) return null
	const picks = pickCount(state, group)
	const mode = modeOf(state, group, prefs)
	const genre = group === "genres"
	if (isPicked(state, option)) {
		// The server counts removal of each picked all-of unit and each individual any-of name.
		if (!genre || state.allOf?.includes(group))
			return oc[option.values[0]] ?? null
		if (total === null) return null
		const next = togglePick(state, option, prefs)!.state.genres
		if (!next.length) {
			if (!inputs.recoveries) return null
			return (
				total + (inputs.recoveries.find((r) => r.filter === group)?.titles ?? 0)
			)
		}
		// Movie and TV names of a fold are disjoint. Subtract each removed name's exclusive loss,
		// keeping the combined TV name when another picked unit still needs it.
		let n = total
		for (const name of state.genres.filter((name) => !next.includes(name))) {
			if (oc[name] === undefined) return null
			n -= total - oc[name]
		}
		return Math.max(0, n)
	}
	if (picks === 1 && mode === "all") {
		const zero = cleared[group]
		if (!zero || total === null) return null
		const alone = genre
			? option.values.reduce((n, name) => n + (zero[name] ?? 0), 0)
			: zero[option.id]
		const either = genre ? anyOfUnit(option, state, oc, total) : oc[option.id]
		if (alone === undefined || either === undefined || either === null)
			return null
		return Math.max(0, total + alone - either)
	}
	if (!genre) return oc[option.id] ?? null
	// All of from two picks: the server counts the unit as one, under its first name.
	if (mode === "all" && picks >= 2) return oc[option.values[0]] ?? null
	if (total === null && state.genres.length) return null
	return anyOfUnit(option, state, oc, total ?? 0)
}

/** One row as the column shows it. */
export interface MoodRow extends MoodOption {
	on: boolean
	n: number | null
	/** Inert: it would leave nothing, or the group is at its cap. */
	dead: boolean
}

export function moodRows(
	options: readonly MoodOption[],
	inputs: CountInputs,
): MoodRow[] {
	const full = options.length ? atCap(inputs.state, options[0].group) : false
	return options
		.map((option) => {
			const on = isPicked(inputs.state, option)
			const n = optionCount(option, inputs)
			return { ...option, on, n, dead: !on && (full || n === 0) }
		})
		.sort(
			(a, b) =>
				Number(b.on) - Number(a.on) ||
				Number(a.dead) - Number(b.dead) ||
				(b.n ?? -1) - (a.n ?? -1) ||
				a.name.localeCompare(b.name),
		)
}

/** Bars share a scale large enough for additions and removals in either mode. */
export function barScale(
	rows: readonly MoodRow[],
	total: number | null,
	_mode: Mode,
): number {
	const widest = Math.max(0, ...rows.map((row) => row.n ?? 0))
	return Math.max(total ?? 0, widest, 1)
}

// ---------------------------------------------------------------------------------------------------------------
// Combos

export interface PanelMixCount extends MoodMix {
	count: number
	topTitle: { title: string; backdrop_path?: string | null } | null
}

export interface ComboCard {
	/** "mix:<id>" or "add:<group>:<id>". */
	id: string
	name: string
	hues: string[]
	/** A backdrop path; or, for a "+ X" card, the island whose picture it borrows. */
	path: string | null
	island: string | null
	n: number | null
	/** "+ X": the share of the list it keeps. */
	share: number | null
	on: boolean
	line: string | null
	mix?: MoodMix
	option?: MoodOption
}

export const mixName = (mix: MoodMix): string =>
	mix.tags.map((id) => WORD_BY_ID[id]?.name ?? id).join(" + ")

const sameSet = (a: readonly string[], b: readonly string[]) => {
	const x = new Set(a)
	const y = new Set(b)
	return x.size === y.size && [...x].every((value) => y.has(value))
}

/** A mix is on when Feel, About and Style hold exactly its tags. */
export function mixOn(state: FilterState, mix: MoodMix): boolean {
	const picks = picksOf(mix.tags)
	return (
		sameSet(state.moods, picks.moods) &&
		sameSet(state.themes, picks.themes) &&
		sameSet(state.styles, picks.styles)
	)
}

/** Applying a mix: its tags replace Feel, About and Style (genres stay); a mix that is on clears them. */
export function applyMix(
	state: FilterState,
	mix: MoodMix,
	prefs: ModePrefs,
): FilterState {
	const modes = modesOf(state, prefs)
	const next = mixOn(state, mix)
		? { ...state, moods: [], themes: [], styles: [] }
		: stateForMix(state, mix)
	return withAllOf(next, modes)
}

export const hasMoodPicks = (state: FilterState): boolean =>
	TAG_GROUPS.some((group) => state[group].length > 0)

/**
 * The Combos grid, `slots` cards. Nothing picked: the ready mixes. With picks: "+ X" (every unpicked mood, theme or
 * style that narrows without leaving nothing, most first), then ready mixes with titles, then ready mixes without
 * counts (the one that is on last). No card leads to nothing. While a search runs the mixes show no counts (they count
 * the catalog, not the search).
 */
export function comboCards({
	mixes,
	rows,
	state,
	total,
	searching,
	slots,
}: {
	mixes: readonly PanelMixCount[]
	/** Every column's rows (moodRows), for the "+ X" cards. */
	rows: readonly MoodRow[]
	state: FilterState
	total: number | null
	searching: boolean
	slots: number
}): ComboCard[] {
	const firstHue = (() => {
		for (const group of ["moods", "themes", "styles"] as const)
			for (const row of rows) if (row.group === group && row.on) return row.hue
		return null
	})()
	const mixCards = mixes.map(
		(mix): ComboCard => ({
			id: `mix:${mix.id}`,
			name: mixName(mix),
			hues: mix.tags.map((id) => WORD_BY_ID[id]?.hue ?? GENRE_HUE),
			path: mix.topTitle?.backdrop_path ?? null,
			island: null,
			n: searching ? null : mix.count,
			share: null,
			on: mixOn(state, mix),
			line: !searching && mix.topTitle ? `Like ${mix.topTitle.title}` : null,
			mix,
		}),
	)
	const leads = (card: ComboCard) =>
		card.n === null ? total !== 0 : card.n > 0
	const fill = (lead: ComboCard[]) => {
		const shown = new Set(lead.map((card) => card.id))
		const rest = mixCards
			.filter((card) => !shown.has(card.id))
			.sort((a, b) => Number(a.on) - Number(b.on))
		return [
			...lead,
			...rest.map((card) => ({ ...card, n: null, line: null })),
		].slice(0, slots)
	}
	if (!hasMoodPicks(state)) return fill(mixCards.filter(leads))
	const adds = rows
		.filter(
			(row) =>
				row.group !== "genres" &&
				row.island !== null &&
				!row.on &&
				!row.dead &&
				row.n !== null &&
				row.n > 0 &&
				(total === null || row.n < total),
		)
		.sort((a, b) => (b.n ?? 0) - (a.n ?? 0))
		.map(
			(row): ComboCard => ({
				id: `add:${row.group}:${row.id}`,
				name: `+ ${row.name}`,
				hues: [row.hue, firstHue ?? row.hue],
				path: null,
				island: row.island,
				n: row.n,
				share: total ? (row.n ?? 0) / total : null,
				on: false,
				line: null,
				option: row,
			}),
		)
	return fill([...adds, ...mixCards.filter((card) => !card.on && leads(card))])
}
