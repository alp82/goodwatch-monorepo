// What Find finds in every tab and how its results group, without React. useFind gathers the sources (the filter
// state, the title and person searches, the Mood rows, the services, the taste groups) and the setters the tabs use;
// findHits turns typed text into results that each know their sub-tab, whether they are on, and how to toggle with the
// tab's own setter, so the tab, badges, status line and footer agree. groupHits lays them out as FindResults draws
// them: columns in tab order, sub-tabs in their order, titles and people as rows that grow with More.
import { type LadderStep, ladderStepFor } from "~/domain/age-content"
import {
	FIND_MIN_NAME,
	type FindSetting,
	findValues,
	keepBest,
	nameScore,
	normalizeFind,
	settingKey,
} from "~/domain/discover-find"
import { INDUSTRIES, REGIONS } from "~/domain/film-industries"
import {
	type FilterOptionCounts,
	type FilterRange,
	type FilterState,
	SCORE_GAPS,
	type SourceKey,
	TAG_GROUPS,
	type TagGroup,
	dropFilter,
} from "~/domain/filter-state"
import type { MoodMix } from "~/domain/mood-mixes"
import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { productionCountryName } from "~/domain/production-country"
import { WORD_BY_ID } from "~/domain/taste-picker"
import {
	BOX_OFFICE_PRESETS,
	BUDGET_PRESETS,
	EPISODE_LENGTH_PRESETS,
	GOODWATCH_SCORE_STEPS,
	HOURS_PRESETS,
	MOVIE_LENGTH_PRESETS,
	POPULARITY_RANK_PRESETS,
	RETURNS_LABELS,
	SCORE_SOURCES,
	SCORE_STEPS,
	SEASONS_PRESETS,
	SHOW_STATUS_LABELS,
	VOTES_PRESETS,
	afterYearPresets,
	decadeLabel,
	decadeStarts,
	decadeYears,
	formatSourceStep,
	newYearPresets,
	rangeKey,
	sameRange,
} from "~/domain/title-scales"
import { ANIME_LABELS, TYPE_LABELS } from "~/ui/filter-bar/labels"
import type { TitleKey } from "~/utils/title-key"
import type { MoodOption, MoodRow, PanelMixCount } from "../mood/mood-model"
import { mixName, mixOn } from "../mood/mood-model"
import {
	moreCount,
	moreRows,
	roleOf,
	togglePerson,
	toggleSteer,
} from "../search/search-tab"
import {
	MAIN_TABS,
	type MainTab,
	SUB_TABS,
	type SubTabId,
	subTabOfFind,
} from "../tabs"
import {
	kindRange,
	lengthCount,
	toggleLengthPatch,
} from "../watch/length-choices"
import {
	originCount,
	setOn,
	toggleCountryPatch,
	toggleRestOfWorldPatch,
	toggleSetPatch,
} from "../watch/made-in-choices"
import {
	sameSpan,
	spanOf,
	togglePresetPatch,
	yearSpan,
	yearsCount,
} from "../watch/released-choices"
import {
	SCORE_GAP_NAMES,
	pickServicePatch,
	serviceName,
	servicesMode,
	servicesModePatch,
	servicesOn,
	sourceScorePatch,
} from "../watch/watch-choices"
import {
	LISTS,
	MATCH_ROWS,
	groupCount,
	groupOn,
	groupsFull,
	listOn,
	listPatch,
	matchCount,
	matchPatch,
	matchStepOf,
	toggleGroup,
} from "../you/you-choices"

export type FindKind = "chip" | "title" | "person"
export type RowKind = "title" | "person"

/** What a result shows before its label. */
export type FindArt =
	| { kind: "hues"; hues: string[] }
	| { kind: "logo"; path: string }
	| { kind: "flag"; code: string }

export interface FindHit {
	/** One per setting: a value reading and a name match of the same setting share it. */
	key: string
	kind: FindKind
	subTab: SubTabId
	label: string
	/** A quiet detail: a year and kind, a role. */
	note?: string
	/** What picking it would leave; null when unknown. */
	count?: number | null
	on: boolean
	/** A guest's You: shown faint with a lock, not usable. */
	locked?: boolean
	art?: FindArt
	/** How well it fits the text; Enter without a highlight picks the highest. */
	score: number
	/** Read from the text as a value ("Released in 1999"), not found by name. */
	value?: boolean
	/** The title or person a row stands for. */
	title?: FindTitle
	person?: FindPerson
	pick: () => void
}

/** The setters Find picks with, the same ones the tabs use. */
export interface FindActs {
	update: (change: (state: FilterState) => FilterState) => void
	/** Mood's pick, with its column switches. */
	toggleMood: (option: MoodOption) => void
	/** A ready mix, as Combos applies it. */
	applyMix: (mix: MoodMix) => void
	setForYou?: (on: boolean) => void
	setBestFirst: (on: boolean) => void
}

export interface FindTitle {
	key: TitleKey
	title: string
	year: string
	poster: string | null
	mediaType: "movie" | "show"
}

export interface FindPerson {
	id: number
	name: string
	profile: string | null
	department: string
}

export interface FindGroup {
	key: string
	name: string
	number: number
	hues: string[]
}

export interface FindSources {
	state: FilterState
	/** The current year. */
	now: number
	member: boolean
	/** The results' rating ladder; null without one (Age and content hides). */
	ladder: readonly LadderStep[] | null
	/** Whether a sub-tab shows for this list (Budget with movies, Shows with shows, Age with a ladder). */
	shown: (id: SubTabId) => boolean
	counts: FilterOptionCounts | null
	/** The title name search's answer, best first. */
	titles: readonly FindTitle[]
	/** The person search's answer, best first. */
	people: readonly FindPerson[]
	/** Mood's rows per column, as the tab shows them (with counts). */
	moods: Record<TagGroup, readonly MoodRow[]>
	/** The ready mixes (the member's own for members); null while they load. */
	mixes: readonly PanelMixCount[] | null
	/** A search runs: the mixes count the catalog, not the search, so their counts stay out. */
	searching: boolean
	services: {
		/** Every service of the streaming country. */
		country: readonly { id: number; name: string; logo_path?: string | null }[]
		/** The viewer's saved services. */
		mine: readonly number[]
	}
	/** Country codes Made in can pick. */
	countries: readonly string[]
	/** The member's taste groups; empty for guests. */
	groups: readonly FindGroup[]
	/** For you's switch; null where the page has none. */
	forYou: boolean | null
	bestFirst: boolean
	acts: FindActs
}

// ---------------------------------------------------------------------------------------------------------------
// Settings a value reading names, on and toggled the way their tabs do it

const toggleRange = (current: FilterRange | undefined, range: FilterRange) =>
	sameRange(current, range) ? undefined : range

/** Whether a reading's setting is on now. */
export function settingOn(
	state: FilterState,
	setting: FindSetting,
	now: number,
	ladder: readonly LadderStep[] | null,
): boolean {
	switch (setting.kind) {
		case "years":
			return sameSpan(yearSpan(state, now), spanOf(setting.years, now))
		case "runtime":
			return sameRange(kindRange(state, "movie"), setting.runtime)
		case "episodeRuntime":
			return sameRange(kindRange(state, "episode"), setting.episodeRuntime)
		case "hours":
			return sameRange(state.hours, setting.hours)
		case "budget":
		case "boxOffice":
			return sameRange(state[setting.kind], setting.millions)
		case "seasons":
			return sameRange(state.seasons, setting.seasons)
		case "returns":
			return state.returns === setting.returns
		case "showStatus":
			return state.showStatus === setting.showStatus
		case "ageLimit":
			return (
				state.ageLimit !== undefined &&
				Boolean(ladder?.length) &&
				ladderStepFor(ladder ?? [], state.ageLimit).age === setting.age
			)
		case "minScore":
			return state.minScore === setting.score
		case "sourceScore":
			return state.sourceScores?.[setting.source] === setting.score
	}
}

/** Turns a setting on, or off again when it is on, through the same patches as its tab. */
export function toggleSetting(
	state: FilterState,
	setting: FindSetting,
	now: number,
	ladder: readonly LadderStep[] | null,
): FilterState {
	const on = settingOn(state, setting, now, ladder)
	switch (setting.kind) {
		case "years":
			return { ...state, ...togglePresetPatch(state, setting.years, now) }
		case "runtime":
			return {
				...state,
				...toggleLengthPatch(state, "movie", setting.runtime),
			}
		case "episodeRuntime":
			return {
				...state,
				...toggleLengthPatch(state, "episode", setting.episodeRuntime),
			}
		case "hours":
			return { ...state, hours: toggleRange(state.hours, setting.hours) }
		case "budget":
		case "boxOffice":
			return {
				...state,
				[setting.kind]: toggleRange(state[setting.kind], setting.millions),
			}
		case "seasons":
			return { ...state, seasons: toggleRange(state.seasons, setting.seasons) }
		case "returns":
			return { ...state, returns: on ? undefined : setting.returns }
		case "showStatus":
			return { ...state, showStatus: on ? undefined : setting.showStatus }
		case "ageLimit":
			return on
				? dropFilter(state, "ageLimit")
				: { ...state, ageLimit: setting.age }
		case "minScore":
			return { ...state, minScore: on ? 0 : setting.score }
		case "sourceScore":
			return {
				...state,
				...sourceScorePatch(state, setting.source, on ? 0 : setting.score),
			}
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Finding

/** Title and person rows never outrank a whole-name choice or a value: `1999` picks Released in 1999. */
const ROW_SCORE_CAP = 80
/** Every row the searches send shows, the server's best first. */
const ROW_SCORE_FLOOR = 30
/** Countries match by a word's start or better (or by their code), so "an" doesn't list half the world. */
const COUNTRY_MIN_SCORE = 70

type Draft = Omit<FindHit, "score"> & { extra?: string }

const hues = (ids: readonly string[]) =>
	ids.map((id) => WORD_BY_ID[id]?.hue ?? "#9ca3af")

/**
 * Every result for the text: the choices of every tab matched by name (two letters or more), the settings the text
 * names as a value (from one character), and the title and person search's rows. One per setting, results of hidden
 * sub-tabs dropped. Unsorted; groupHits orders them.
 */
export function findHits(text: string, sources: FindSources): FindHit[] {
	const { state, now, ladder, counts, acts } = sources
	const q = normalizeFind(text)
	const names = q.length >= FIND_MIN_NAME
	const out: FindHit[] = []
	const add = ({ extra, ...hit }: Draft) => {
		if (!names) return
		const score = nameScore(q, hit.label, extra)
		if (score > 0) out.push({ ...hit, score })
	}
	const toggle = (change: (s: FilterState) => FilterState) => () =>
		acts.update(change)
	const settingHit = (
		setting: FindSetting,
		subTab: SubTabId,
		label: string,
		extra: string,
		count: number | null = null,
		note?: string,
	) =>
		add({
			key: settingKey(setting),
			kind: "chip",
			subTab,
			label,
			note,
			count,
			extra,
			on: settingOn(state, setting, now, ladder),
			pick: toggle((s) => toggleSetting(s, setting, now, ladder)),
		})

	// Search: Movies, Shows, Anime only, Hide anime; then the found titles and people.
	for (const [type, extra] of [
		["movie", "movie film films"],
		["show", "show series tv"],
	] as const)
		add({
			key: `type:${type}`,
			kind: "chip",
			subTab: "titles",
			label: TYPE_LABELS[type],
			extra,
			count: counts?.type?.[type] ?? null,
			on: state.type === type,
			pick: toggle((s) => ({ ...s, type: s.type === type ? "all" : type })),
		})
	for (const [anime, extra] of [
		["only", "anime"],
		["none", "anime no without"],
	] as const)
		add({
			key: `anime:${anime}`,
			kind: "chip",
			subTab: "titles",
			label: ANIME_LABELS[anime],
			extra,
			count: counts?.anime?.[anime] ?? null,
			on: state.anime === anime,
			pick: toggle((s) => ({
				...s,
				anime: s.anime === anime ? "any" : anime,
			})),
		})
	const rowScore = (name: string, i: number) =>
		Math.max(Math.min(nameScore(q, name), ROW_SCORE_CAP), ROW_SCORE_FLOOR) -
		i * 0.5
	if (names) {
		sources.titles.forEach((title, i) => {
			out.push({
				key: `title:${title.key}`,
				kind: "title",
				subTab: "titles",
				label: title.title,
				note: [title.year, title.mediaType === "movie" ? "Movie" : "Show"]
					.filter(Boolean)
					.join(" · "),
				on: (state.similarTo ?? []).includes(title.key),
				title,
				score: rowScore(title.title, i),
				pick: toggle((s) => toggleSteer(s, "similarTo", title.key)),
			})
		})
		sources.people.forEach((person, i) => {
			out.push({
				key: `person:${person.id}`,
				kind: "person",
				subTab: "people",
				label: person.name,
				note: roleOf(person.department),
				on: (state.people ?? []).includes(person.id),
				person,
				score: rowScore(person.name, i),
				pick: toggle((s) => togglePerson(s, person.id)),
			})
		})
	}

	// Mood: the ready mixes, then every row of the four columns. Moods also answer to their old names.
	for (const mix of sources.mixes ?? [])
		add({
			key: `mix:${mix.id}`,
			kind: "chip",
			subTab: "combos",
			label: mixName(mix),
			extra: "mix combo",
			count: sources.searching ? null : mix.count,
			on: mixOn(state, mix),
			art: { kind: "hues", hues: hues(mix.tags) },
			pick: () => acts.applyMix(mix),
		})
	for (const group of TAG_GROUPS)
		for (const row of sources.moods[group])
			add({
				key: `${group}:${row.id}`,
				kind: "chip",
				subTab: "everything",
				label: row.name,
				extra:
					group === "moods"
						? `${MOOD_BY_KEY[row.id as MoodKey]?.aliases.join(" ") ?? ""} mood`
						: group === "genres"
							? "genre"
							: "",
				count: row.n,
				on: row.on,
				art: { kind: "hues", hues: [row.hue] },
				pick: () => acts.toggleMood(row),
			})

	// Watch > Services
	const mode = servicesMode(state)
	const hasMine = sources.services.mine.length > 0 || state.onMyServices
	const serviceCount = (key: string | number) =>
		counts?.services?.[String(key)] ?? null
	if (hasMine)
		add({
			key: "services:mine",
			kind: "chip",
			subTab: "services",
			label: "On my services",
			extra: "my services mine streaming",
			count: serviceCount("mine"),
			on: mode === "mine",
			pick: toggle((s) => ({
				...s,
				...servicesModePatch(servicesMode(s) === "mine" ? "any" : "mine"),
			})),
		})
	add({
		key: "services:any",
		kind: "chip",
		subTab: "services",
		label: "Any service",
		extra: "streaming services",
		count: serviceCount("any"),
		on: Boolean(state.anyService),
		pick: toggle((s) => ({
			...s,
			...servicesModePatch(s.anyService ? "any" : "pick"),
		})),
	})
	const servicesNow = servicesOn(state, sources.services.mine)
	for (const provider of sources.services.country)
		add({
			key: `service:${provider.id}`,
			kind: "chip",
			subTab: "services",
			label: serviceName(provider.name),
			count: serviceCount(provider.id),
			on: servicesNow.includes(provider.id),
			art: provider.logo_path
				? { kind: "logo", path: provider.logo_path }
				: undefined,
			pick: toggle((s) => ({ ...s, ...pickServicePatch(s, provider.id) })),
		})

	// Watch > Scores: the GoodWatch score, each source's steps, Critics vs audiences.
	for (const score of GOODWATCH_SCORE_STEPS)
		settingHit(
			{ kind: "minScore", score },
			"scores",
			`GoodWatch ${score}+`,
			"goodwatch score rating good",
			counts?.minScore?.[String(score)] ?? null,
		)
	for (const source of SCORE_SOURCES)
		for (const score of SCORE_STEPS)
			settingHit(
				{ kind: "sourceScore", source: source.key as SourceKey, score },
				"scores",
				`${source.name} ${formatSourceStep(source.notation, score)}`,
				`${source.words} score`,
				counts?.sourceScores?.[`${source.key}:${score}`] ?? null,
			)
	for (const gap of SCORE_GAPS)
		add({
			key: `gap:${gap}`,
			kind: "chip",
			subTab: "scores",
			label: SCORE_GAP_NAMES[gap],
			extra: "critics vs audiences",
			count: counts?.scoreGap?.[gap] ?? null,
			on: state.scoreGap === gap,
			pick: toggle((s) => ({
				...s,
				scoreGap: s.scoreGap === gap ? undefined : gap,
			})),
		})

	// Watch > Popularity
	const presetHit = (
		field:
			| "votes"
			| "popularityRank"
			| "budget"
			| "boxOffice"
			| "seasons"
			| "hours",
		subTab: SubTabId,
		preset: { key: string; label: string; note?: string; range: FilterRange },
		extra: string,
		label = preset.label,
	) =>
		add({
			key: `${field}:${rangeKey(preset.range)}`,
			kind: "chip",
			subTab,
			label,
			note: preset.note,
			extra,
			on: sameRange(state[field], preset.range),
			pick: toggle((s) => ({
				...s,
				[field]: toggleRange(s[field], preset.range),
			})),
		})
	for (const preset of VOTES_PRESETS)
		presetHit("votes", "popularity", preset, "ratings votes popular")
	for (const preset of POPULARITY_RANK_PRESETS)
		presetHit("popularityRank", "popularity", preset, "popularity popular")

	// Watch > Shows: seasons, time to finish, status.
	for (const preset of SEASONS_PRESETS)
		presetHit(
			"seasons",
			"shows",
			preset,
			"seasons show",
			/^\d/.test(preset.label) ? `${preset.label} seasons` : preset.label,
		)
	for (const preset of HOURS_PRESETS)
		presetHit("hours", "shows", preset, "time to finish binge hours")
	for (const status of ["running", "ended", "canceled"] as const)
		settingHit(
			{ kind: "showStatus", showStatus: status },
			"shows",
			SHOW_STATUS_LABELS[status],
			"status show",
		)

	// Watch > Budget: budget and box office presets, Hit, Flop.
	for (const preset of BUDGET_PRESETS)
		presetHit("budget", "budget", preset, "budget money")
	for (const preset of BOX_OFFICE_PRESETS)
		presetHit(
			"boxOffice",
			"budget",
			preset,
			"box office revenue money",
			`Box office ${preset.label}`,
		)
	for (const returns of ["hit", "flop"] as const)
		settingHit(
			{ kind: "returns", returns },
			"budget",
			RETURNS_LABELS[returns].label,
			"box office money",
			null,
			RETURNS_LABELS[returns].note,
		)

	// Watch > Made in: film industries, Rest of the world, regions, then countries.
	const originCounts = counts?.productionCountries
	for (const set of [...INDUSTRIES, ...REGIONS]) {
		const industry = INDUSTRIES.includes(set)
		add({
			key: `set:${set.id}`,
			kind: "chip",
			subTab: "madeIn",
			label: set.name,
			extra: industry ? "film industry made in" : "region made in",
			count: originCount(originCounts, `set:${set.id}`),
			on: setOn(state, set.codes),
			art: industry ? { kind: "flag", code: set.codes[0] } : undefined,
			pick: toggle((s) => ({ ...s, ...toggleSetPatch(s, set.codes) })),
		})
	}
	add({
		key: "set:world",
		kind: "chip",
		subTab: "madeIn",
		label: "Rest of the world",
		extra: "made in",
		count: originCount(originCounts, "world"),
		on: Boolean(state.restOfWorld),
		pick: toggle((s) => ({ ...s, ...toggleRestOfWorldPatch(s) })),
	})
	if (names)
		for (const code of new Set(sources.countries)) {
			const name = productionCountryName(code)
			const score = Math.max(
				nameScore(q, name),
				q === code.toLowerCase() ? COUNTRY_MIN_SCORE : 0,
			)
			if (score < COUNTRY_MIN_SCORE) continue
			out.push({
				key: `country:${code}`,
				kind: "chip",
				subTab: "madeIn",
				label: name,
				count: originCount(originCounts, code),
				on: (state.productionCountries ?? []).includes(code),
				art: { kind: "flag", code },
				score,
				pick: toggle((s) => ({ ...s, ...toggleCountryPatch(s, code) })),
			})
		}

	// Watch > Released: New, After, the decades.
	const yearCounts = counts?.years
	for (const preset of [...newYearPresets(now), ...afterYearPresets(now)])
		settingHit(
			{ kind: "years", years: preset.years },
			"released",
			preset.label,
			"released year new recent",
			yearsCount(yearCounts, preset.years),
		)
	for (const start of decadeStarts(now)) {
		const years = decadeYears(start, now)
		settingHit(
			{ kind: "years", years },
			"released",
			decadeLabel(start),
			`released decade ${String(start).slice(2)}s old`,
			yearsCount(yearCounts, years),
		)
	}

	// Watch > Length: the Movies and Episodes tiles.
	const runtimeCounts = counts?.runtime
	for (const preset of MOVIE_LENGTH_PRESETS)
		settingHit(
			{ kind: "runtime", runtime: preset.range },
			"length",
			`Movies ${lowerFirst(preset.label)}`,
			`length runtime long short ${preset.note}`,
			lengthCount(runtimeCounts, "movie", preset.range),
		)
	for (const preset of EPISODE_LENGTH_PRESETS)
		settingHit(
			{ kind: "episodeRuntime", episodeRuntime: preset.range },
			"length",
			`Episodes ${lowerFirst(preset.label)}`,
			`length runtime long short ${preset.note}`,
			lengthCount(runtimeCounts, "episode", preset.range),
		)

	// Watch > Age and content: the ladder's steps.
	for (const step of ladder ?? [])
		settingHit(
			{ kind: "ageLimit", age: step.age },
			"age",
			`Up to ${step.label}${step.show ? ` · ${step.show}` : ""}`,
			"age rating kids family",
			counts?.ageLimit?.[String(step.age)] ?? null,
		)

	// You: everything needs an account, so a guest sees it locked.
	const locked = !sources.member
	const you = (hit: Omit<Draft, "kind" | "subTab">) =>
		add({
			...hit,
			kind: "chip",
			subTab: "taste",
			locked: locked || undefined,
			count: locked ? null : hit.count,
			on: locked ? false : hit.on,
			pick: locked ? () => {} : hit.pick,
		})
	if (sources.member) {
		const full = groupsFull(state, sources.groups)
		for (const group of sources.groups) {
			const on = groupOn(state, group)
			if (full && !on) continue
			you({
				key: `group:${group.key}`,
				label: group.name,
				extra: "taste group",
				count: groupCount(counts, group.key),
				on,
				art: { kind: "hues", hues: group.hues },
				pick: () =>
					acts.update((s) => {
						const patch = toggleGroup(s, group, sources.groups)
						return patch ? { ...s, ...patch } : s
					}),
			})
		}
	} else
		you({
			key: "groups",
			label: "Your taste groups",
			extra: "taste",
			on: false,
			pick: () => {},
		})
	const match = matchStepOf(state)
	for (const step of MATCH_ROWS) {
		if (step === 0) continue
		you({
			key: `match:${step}`,
			label: step === "outside" ? "Outside your usual" : `Match ${step}%+`,
			extra: "taste match fit",
			count: matchCount(counts, step),
			on: match === step,
			pick: toggle((s) => ({
				...s,
				...matchPatch(matchStepOf(s) === step ? 0 : step),
			})),
		})
	}
	if (sources.forYou !== null) {
		const forYou = sources.forYou
		you({
			key: "order:forYou",
			label: "For you",
			extra: "order taste",
			on: forYou,
			pick: () => acts.setForYou?.(!forYou),
		})
	}
	you({
		key: "order:best",
		label: "Best match first",
		extra: "order sort taste match",
		on: sources.bestFirst,
		pick: () => acts.setBestFirst(!sources.bestFirst),
	})
	const LIST_WORDS = {
		notSeenYet: "unseen new watched list",
		seenBefore: "watched rewatch list",
		onWishlist: "wishlist watchlist want list",
	} as const
	for (const list of LISTS)
		you({
			key: `list:${list.id}`,
			label: list.label,
			extra: LIST_WORDS[list.id],
			on: listOn(state, list.id),
			pick: toggle((s) => ({
				...s,
				...listPatch(list.id, !listOn(s, list.id)),
			})),
		})

	// Values: what the text names as a setting, in plain words, set the way the tab sets it.
	for (const reading of findValues(text, {
		now,
		ladder,
		shown: (sub) => sources.shown(subTabOfFind(sub)),
	}))
		out.push({
			key: reading.key,
			kind: "chip",
			subTab: subTabOfFind(reading.subTab),
			label: reading.label,
			on: settingOn(state, reading.setting, now, ladder),
			score: reading.score,
			value: true,
			pick: toggle((s) => toggleSetting(s, reading.setting, now, ladder)),
		})

	return keepBest(out).filter((hit) => sources.shown(hit.subTab))
}

const lowerFirst = (label: string) =>
	`${label.charAt(0).toLowerCase()}${label.slice(1)}`

// ---------------------------------------------------------------------------------------------------------------
// Grouping

/** Choices a sub-tab shows at most. */
export const FIND_CHIPS = 12
/** Titles and people at first. */
export const FIND_ROWS = 4

export type RowCounts = Record<RowKind, number>
export const FIRST_ROWS: RowCounts = { title: FIND_ROWS, person: FIND_ROWS }

/** One more tap on More: 4, then 12, then 12 more each tap. */
export const growRows = (rows: RowCounts, kind: RowKind): RowCounts => ({
	...rows,
	[kind]: moreRows(rows[kind]),
})

export interface FindSubGroup {
	subTab: SubTabId
	/** Titles or people, as rows, the best first. */
	rows: FindHit[]
	/** Choices, the best first. */
	chips: FindHit[]
	/** Under the rows: their kind and "4 of 13" while more are found; null without rows. */
	more: { kind: RowKind; count: string | null } | null
}

export interface FindColumn {
	tab: MainTab
	subs: FindSubGroup[]
}

/** How many rows each search found, and whether it answered a full page (so there may be more). */
export type RowTotals = Record<RowKind, { n: number; full: boolean }>

const byScore = (a: FindHit, b: FindHit) => b.score - a.score

/** Results as columns in tab order (empty tabs left out), sub-tabs in their order, rows capped at `rows`. */
export function groupHits(
	hits: readonly FindHit[],
	rows: RowCounts,
	totals: RowTotals,
): FindColumn[] {
	return MAIN_TABS.map((tab) => ({
		tab,
		subs: SUB_TABS.filter((sub) => sub.tab === tab)
			.map((sub): FindSubGroup => {
				const mine = hits.filter((hit) => hit.subTab === sub.id)
				const chips = mine
					.filter((hit) => hit.kind === "chip")
					.sort(byScore)
					.slice(0, FIND_CHIPS)
				const found = mine.filter((hit) => hit.kind !== "chip")
				const kind = (found[0]?.kind ?? null) as RowKind | null
				// Rows keep the search's order: its best first.
				const shown = kind ? found.slice(0, rows[kind]) : []
				return {
					subTab: sub.id,
					rows: shown,
					chips,
					more: kind
						? {
								kind,
								count: moreCount(
									shown.length,
									Math.max(found.length, totals[kind].n),
									totals[kind].full,
								),
							}
						: null,
				}
			})
			.filter((group) => group.rows.length + group.chips.length > 0),
	})).filter((column) => column.subs.length > 0)
}

/** The results in the order they show and the arrow keys move: column by column, rows before chips. */
export const flatHits = (columns: readonly FindColumn[]): FindHit[] =>
	columns.flatMap((column) =>
		column.subs.flatMap((sub) => [...sub.rows, ...sub.chips]),
	)

/** What Enter picks: the highlighted result, else the best-scoring one that can be used (the first of equals). */
export function enterPick(
	flat: readonly FindHit[],
	active: number,
): FindHit | null {
	const hit = flat[active]
	if (hit) return hit.locked ? null : hit
	let best: FindHit | null = null
	for (const candidate of flat)
		if (!candidate.locked && (!best || candidate.score > best.score))
			best = candidate
	return best
}

/** The highlight after an arrow key: from none, Down goes to the first and Up to the last; it wraps. */
export function moveActive(active: number, delta: 1 | -1, count: number) {
	if (!count) return -1
	if (active < 0 || active >= count) return delta > 0 ? 0 : count - 1
	return (active + delta + count) % count
}
