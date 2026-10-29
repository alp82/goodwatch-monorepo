// PROTOTYPE (Discover lab, round 21; values round 22): what the header search finds, across all four tabs. One flat list of hits, each
// knowing its tab and sub-tab, whether it is on, and how to toggle it with the same state the tab itself uses (so the
// tab, the badges and the footer chips agree). Local choices are matched by name (lab names, old names as extra
// words); titles and people come live from the same title and person search Search's sections use. Round 22: text
// that reads as a value (1999, 90s, 90 min, pg-13, 80, $100m) also offers the settings it names (values.ts).
import { LockClosedIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import { MIN_SCORES } from "~/domain/filter-state"
import { compactCount } from "~/ui/filter-bar/labels"
import type { ProtoDiscover, Tag } from "../../kit"
import type { Layout, SegKey, SubId } from "../layouts"
import { type Pieces, PosterThumb, segOf, useQuickTitles } from "../shell-parts"
import type { Viewer } from "../types"
import { useAge } from "../sections/age/parts"
import { EPISODE_PICKS, LEN_MAX, MOVIE_PICKS, runtimeOf } from "../sections/length/parts"
import { episodeRange } from "../sections/length/two"
import { readyMixes } from "../sections/mood/andview"
import { MOOD_CHOICES, STYLE_TAGS, THEME_TAGS, genreOptions, mixName, useMoods } from "../sections/mood/parts"
import { toggleRange } from "../sections/more/parts"
import { type Idx, type MoreKey, PRESETS, ROI_LABEL, SCALES, STATUS_LABEL, type ShowStatus, last, sameIdx, setMore, useMore } from "../sections/more/store"
import { Flag, INDUSTRIES, REGIONS, useAllCountries, useOrigin } from "../sections/origin/parts"
import { Face, roleOf, usePeople } from "../sections/people/shared"
import { eras } from "../sections/released/art"
import { sameRange, toggleYears, yearRange } from "../sections/released/parts"
import { mcUsers, setMcUsers } from "../sections/scores/mc-users"
import { GAP_WORDS, SOURCES, setGap, setSource, sourceValue } from "../sections/scores/parts"
import { cleanName, logo, useServices } from "../sections/services/parts"
import { GROUPS, MATCH_STEPS, useTaste } from "../sections/taste/parts"
import { useTitleUses } from "../sections/titles/shared"
import { type Want, parseValues } from "./values"

export type HitKind = "chip" | "title" | "person"

export interface Hit {
	key: string
	kind: HitKind
	seg: SegKey
	sub: SubId
	/** A finer group inside the sub-tab (Feel, About, Box office), shown quietly. */
	part?: string
	label: string
	/** A quiet detail: a count, a year, a role. */
	note?: string | null
	on: boolean
	/** A guest's You: shown, not usable. */
	locked?: boolean
	art?: ReactNode
	score: number
	/** Round 22: read from the text as a value ("Released in 1999"), not found by name. */
	value?: boolean
	toggle: () => void
}

/** Text the search needs before it shows results; shorter text leaves the tab as it is. */
export const MIN_FIND = 2

export const norm = (s: string) =>
	s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[’']/g, "")
		.replace(/\s+/g, " ")
		.trim()

const wordsOf = (s: string) => s.split(/[^a-z0-9$%+]+/).filter(Boolean)

/** How well a choice fits the text: its name first (whole, start, a word's start, inside), then its extra words. */
function scoreOf(q: string, label: string, extra = ""): number {
	const l = norm(label)
	if (l === q) return 100
	if (l.startsWith(q)) return 85
	const ws = wordsOf(l)
	if (ws.some((w) => w.startsWith(q))) return 70
	const qs = q.split(" ")
	if (qs.length > 1 && qs.every((x) => ws.some((w) => w.startsWith(x)))) return 65
	if (q.length >= 3 && l.includes(q)) return 50
	const e = norm(extra)
	if (!e) return 0
	const ew = wordsOf(e)
	if (ew.some((w) => w.startsWith(q)) || (qs.length > 1 && qs.every((x) => ew.some((w) => w.startsWith(x))))) return 35
	return 0
}

const Dot = ({ color }: { color: string }) => <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
const Dots = ({ colors }: { colors: string[] }) => (
	<span className="flex shrink-0 -space-x-1" aria-hidden>
		{colors.map((c, i) => (
			<span key={i} className="h-2.5 w-2.5 rounded-full ring-1 ring-[#0b1120]" style={{ background: c }} />
		))}
	</span>
)
const Lock = () => <LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/70" aria-hidden />
const n = (v: number | null | undefined) => (v == null ? null : compactCount(v))

type Range = [number, number]
const pair = (r: { min?: number; max?: number } | undefined): Range => [r?.min ?? 0, r?.max ?? LEN_MAX]
const ANY_LEN: Range = [0, LEN_MAX]

/** At most this many value readings show, the likeliest first. */
export const VALUE_CAP = 4

/** The cast search answers at most this many people. */
const PEOPLE_PAGE = 100

/** The last stop at or below `v`, -1 when none. */
const lastAtMost = (stops: number[], v: number) => stops.reduce((i, x, j) => (x <= v ? j : i), -1)

const money = (n: number) => (n >= 1e9 ? `$${n / 1e9}B` : `$${n / 1e6}M`)

/** Every hit for `text` (MIN_FIND letters or more, or a value of any length), unsorted; titles and people while their searches answer. */
export function useHits(d: ProtoDiscover, pieces: Pieces, viewer: Viewer, L: Layout, text: string) {
	const q = norm(text)
	const wants = parseValues(q)
	// Names need two letters; a value ("8", "r") counts from one.
	const names = q.length >= MIN_FIND
	const active = names || wants.length > 0
	// The same searches and state the tabs use.
	const titles = useQuickTitles(names ? text : "")
	const people = usePeople(d, names ? text : "")
	const uses = useTitleUses(d)
	const moods = useMoods(d)
	const sv = useServices(d, pieces, viewer)
	const origin = useOrigin(d)
	const countries = useAllCountries(origin.chosen)
	const age = useAge(d, pieces)
	const taste = useTaste(d, viewer)
	const more = useMore()
	const totals = {
		title: { n: titles.found.length, complete: titles.complete },
		person: { n: people.found.length, complete: people.found.length < PEOPLE_PAGE },
	}
	if (!active) return { hits: [] as Hit[], active, loading: false, totals }

	const s = d.filters.state
	const out: Hit[] = []
	const add = (h: Omit<Hit, "seg" | "score">, extra = "") => {
		if (!names) return
		const score = scoreOf(q, h.label, extra)
		if (score > 0) out.push({ ...h, seg: segOf(h.sub, L), score })
	}

	// Search: Titles (Movies or shows, anime), the found titles, then Cast and crew.
	const type = (t: "movie" | "show", label: string, extra: string) =>
		add({ key: `type:${t}`, kind: "chip", sub: "titles", part: "Movies or shows", label, on: s.type === t, toggle: () => d.filters.set({ type: s.type === t ? "all" : t }), note: n(d.counts?.optionCounts.type?.[t]) }, extra)
	type("movie", "Movies", "movie film films")
	type("show", "Shows", "show series tv")
	add({ key: "anime:only", kind: "chip", sub: "titles", part: "Anime", label: "Anime only", on: s.anime === "only", toggle: () => d.filters.set({ anime: s.anime === "only" ? "any" : "only" }) }, "anime")
	add({ key: "anime:none", kind: "chip", sub: "titles", part: "Anime", label: "Hide anime", on: s.anime === "none", toggle: () => d.filters.set({ anime: s.anime === "none" ? "any" : "none" }) }, "anime no without")
	titles.found.forEach((t, i) => {
		const base = scoreOf(q, t.title)
		out.push({
			key: `title:${t.key}`,
			kind: "title",
			seg: segOf("titles", L),
			sub: "titles",
			label: t.title,
			note: [t.year, t.mediaType === "movie" ? "Movie" : "Show"].filter(Boolean).join(" · "),
			on: uses.has("similarTo", t.key),
			toggle: () => uses.toggle("similarTo", t.key),
			art: <PosterThumb poster={t.poster} title={t.title} className="h-[34px] w-[23px]" />,
			score: Math.max(base, 30) - i * 0.5,
		})
	})
	people.found.forEach((p, i) => {
		out.push({
			key: `person:${p.id}`,
			kind: "person",
			seg: segOf("people", L),
			sub: "people",
			label: p.name,
			note: roleOf(p.department),
			on: people.has(p.id),
			toggle: () => people.toggle(p),
			art: <Face src={p.profile} size={30} />,
			score: Math.max(scoreOf(q, p.name), 30) - i * 0.5,
		})
	})

	// Mood: the ready mixes, then every single choice (lab names; Discover's own names find them too).
	const mixes = readyMixes(viewer)
	const mixOn = (tags: Tag[]) => d.picked.length === tags.length && tags.every((t) => d.isOn(t))
	for (const mix of mixes) {
		const on = mixOn(mix.tags)
		add(
			{
				key: `mix:${mix.id}`,
				kind: "chip",
				sub: "mixes",
				label: mixName(mix),
				on,
				art: <Dots colors={mix.tags.map((t) => t.color)} />,
				toggle: () =>
					d.filters.update((st) => {
						const next = { ...st, moods: [], themes: [], styles: [] } as typeof st
						if (!on) for (const t of mix.tags) (next[t.group] as string[]).push(t.key)
						return next
					}),
			},
			mix.tags.map((t) => t.name).join(" "),
		)
	}
	for (const c of MOOD_CHOICES)
		add(
			{
				key: `mood:${c.id}`,
				kind: "chip",
				sub: "choose",
				part: "Feel",
				label: c.name,
				on: moods.isOn(c),
				art: <Dot color={c.color} />,
				note: c.tag ? n(d.countFor(c.tag)) : null,
				toggle: () => moods.toggle(c),
			},
			`${c.alias ?? ""} mood`,
		)
	const tagHits = (list: Tag[], part: string) => {
		for (const t of list)
			add({ key: `${t.group}:${t.key}`, kind: "chip", sub: "choose", part, label: t.name, on: d.isOn(t), art: <Dot color={t.color} />, note: n(d.countFor(t)), toggle: () => d.toggle(t) })
	}
	tagHits(THEME_TAGS, "About")
	tagHits(STYLE_TAGS, "Style")
	for (const o of genreOptions(d))
		add({ key: `genre:${o.id}`, kind: "chip", sub: "choose", part: "Genre", label: o.label, on: o.active, note: n(o.count), toggle: o.toggle }, "genre")

	// Watch: Services
	if (sv.hasMine)
		add(
			{ key: "services:mine", kind: "chip", sub: "services", label: "On my services", on: sv.mode === "mine", toggle: () => sv.setMode(sv.mode === "mine" ? "any" : "mine"), note: n(sv.totals.mine) },
			"my services mine streaming",
		)
	add({ key: "services:any", kind: "chip", sub: "services", label: "Any service", on: sv.anyService, toggle: () => sv.setMode(sv.anyService ? "any" : "pick"), note: n(sv.totals.any) }, "streaming services")
	for (const p of sv.providers)
		add({
			key: `service:${p.id}`,
			kind: "chip",
			sub: "services",
			label: cleanName(p.name),
			on: sv.isOn(p.id),
			note: n(sv.countOf(p.id)),
			art: p.logo_path ? <img src={logo(p.logo_path)} alt="" className="h-5 w-5 shrink-0 rounded-[5px]" /> : null,
			toggle: () => sv.pick(p.id),
		})

	// Scores
	for (const v of MIN_SCORES.filter((x) => x > 0))
		add(
			{
				key: `score:${v}`,
				kind: "chip",
				sub: "scores",
				part: "GoodWatch score",
				label: `GoodWatch ${v}+`,
				on: s.minScore === v,
				note: n(d.counts?.optionCounts.minScore?.[String(v)]),
				toggle: () => d.filters.set({ minScore: s.minScore === v ? 0 : v }),
			},
			"score rating good",
		)
	for (const src of SOURCES)
		for (const v of src.steps)
			add(
				{
					key: `source:${src.key}:${v}`,
					kind: "chip",
					sub: "scores",
					part: "By source",
					label: `${src.name} ${src.fmt(v)}+`,
					on: sourceValue(d, src.key) === v,
					note: n(d.counts?.optionCounts.sourceScores?.[`${src.key}:${v}`]),
					toggle: () => setSource(d, src.key, sourceValue(d, src.key) === v ? 0 : v),
				},
				`${src.site} ${src.who} score`,
			)
	for (const v of [60, 70, 80, 90])
		add(
			{ key: `mcu:${v}`, kind: "chip", sub: "scores", part: "By source", label: `User score ${(v / 10).toFixed(1)}+`, on: mcUsers() === v, toggle: () => setMcUsers(mcUsers() === v ? 0 : v) },
			"metacritic users audience score",
		)
	for (const g of ["agree", "critics", "audience"] as const)
		add(
			{ key: `gap:${g}`, kind: "chip", sub: "scores", part: "Critics vs audiences", label: GAP_WORDS[g].label, on: s.scoreGap === g, note: n(d.counts?.optionCounts.scoreGap?.[g]), toggle: () => setGap(d, g) },
			`${GAP_WORDS[g].short} critics audiences`,
		)

	// Popularity, Shows, Budget (round 16's lab-only choices)
	const preset = (k: MoreKey, sub: SubId, part: string, extra: string, label = (l: string) => l) => {
		for (const p of PRESETS[k])
			add(
				{ key: `more:${k}:${p.range.join("-")}`, kind: "chip", sub, part, label: label(p.label), note: p.sub, on: sameIdx(more[k], p.range), toggle: () => toggleRange(more, k, p.range) },
				extra,
			)
	}
	preset("votes", "reach", "How many ratings", "ratings votes popular")
	preset("rank", "reach", "Popularity", "popularity popular rank")
	preset("seasons", "shows", "Seasons", "seasons show", (l) => (/^\d/.test(l) ? `${l} seasons` : l))
	preset("finish", "shows", "Time to finish", "finish binge hours")
	for (const st of Object.keys(STATUS_LABEL) as ShowStatus[])
		add({ key: `status:${st}`, kind: "chip", sub: "shows", part: "Status", label: STATUS_LABEL[st], on: more.status === st, toggle: () => setMore({ status: more.status === st ? null : st }) }, "status show")
	preset("budget", "money", "Budget", "budget money")
	preset("revenue", "money", "Box office", "box office revenue money", (l) => `${l} box office`)
	for (const r of ["hit", "flop"] as const)
		add({ key: `roi:${r}`, kind: "chip", sub: "money", part: "Box office", label: ROI_LABEL[r].label, note: ROI_LABEL[r].sub, on: more.roi === r, toggle: () => setMore({ roi: more.roi === r ? null : r }) }, "box office money")

	// Made in
	for (const g of INDUSTRIES)
		add({ key: `industry:${g.id}`, kind: "chip", sub: "origin", part: "Film industries", label: g.name, on: origin.allOf(g.codes), art: <Flag code={g.codes[0]} className="h-3.5 w-5" />, toggle: () => origin.toggleAll(g.codes) }, "film industry made")
	for (const r of REGIONS)
		add({ key: `region:${r.id}`, kind: "chip", sub: "origin", part: "Regions", label: r.name, on: origin.allOf(r.codes), toggle: () => origin.toggleAll(r.codes) }, "region made")
	for (const c of names ? countries.list : []) {
		if (scoreOf(q, c.name) < 70 && norm(c.code) !== q) continue
		out.push({
			key: `country:${c.code}`,
			kind: "chip",
			seg: segOf("origin", L),
			sub: "origin",
			part: "Countries",
			label: c.name,
			on: origin.has(c.code),
			art: <Flag code={c.code} className="h-3.5 w-5" />,
			toggle: () => origin.toggle(c.code),
			score: Math.max(scoreOf(q, c.name), 70),
		})
	}

	// Released
	const years = yearRange(s)
	for (const g of eras())
		for (const e of g.items)
			add({ key: `years:${e.range.join("-")}`, kind: "chip", sub: "released", part: g.label, label: e.label, on: sameRange(years, e.range), toggle: () => toggleYears(d, e.range) }, "released year new recent decade old")

	// Length, as Length d writes it: movies in the real runtime, episodes in the lab's own range.
	const ranges = { movie: pair(s.runtime), show: pair(episodeRange(s)) }
	const setKind = (kind: "movie" | "show", r: Range) =>
		d.filters.update((x) =>
			kind === "movie" ? { ...x, runtime: runtimeOf(r), episodeRuntime: episodeRange(x) ?? null } : { ...x, episodeRuntime: runtimeOf(r) ?? null },
		)
	for (const [kind, picks, word] of [
		["movie", MOVIE_PICKS, "Movies"],
		["show", EPISODE_PICKS, "Episodes"],
	] as const)
		for (const p of picks) {
			const on = sameRange(ranges[kind], p.range)
			add(
				{ key: `len:${kind}:${p.range.join("-")}`, kind: "chip", sub: "length", part: word, label: `${word} ${p.label.charAt(0).toLowerCase()}${p.label.slice(1)}`, note: p.sub, on, toggle: () => setKind(kind, on ? ANY_LEN : p.range) },
				`length runtime long short ${p.sub}`,
			)
		}

	// Age and content (only with a rating ladder, as the sub-tab)
	if (age.ladder)
		for (const step of age.steps)
			add(
				{
					key: `age:${step.age}`,
					kind: "chip",
					sub: "age",
					part: "Age rating",
					label: step.show ? `${step.label} · ${step.show}` : step.label,
					note: `Up to ${step.age}`,
					on: age.selected?.age === step.age,
					toggle: () => (age.selected?.age === step.age ? age.off() : age.pick(step.age)),
				},
				"age rating kids family",
			)

	// You: everything needs an account, so a guest sees it locked.
	const locked = !taste.member
	const you = (h: Omit<Hit, "seg" | "score" | "kind" | "sub">, extra: string) =>
		add({ ...h, kind: "chip", sub: "taste", locked, art: locked ? <Lock /> : h.art, toggle: locked ? () => {} : h.toggle }, extra)
	if (taste.member)
		for (const g of GROUPS)
			you({ key: `group:${g.id}`, part: "Your taste groups", label: g.name, on: taste.groups.isOn(g), art: <Dots colors={g.words.map((w) => w.color)} />, toggle: () => taste.groups.toggle(g) }, `taste group ${g.words.map((w) => w.name).join(" ")}`)
	else you({ key: "groups", part: "Your taste groups", label: "Your taste groups", on: false, toggle: () => {} }, "taste groups")
	for (const v of MATCH_STEPS.filter((x) => x !== 0))
		you(
			{ key: `match:${v}`, part: "Taste match", label: v === "outside" ? "Outside your usual" : `Match ${v}%+`, on: taste.match.value === v, toggle: () => taste.match.set(taste.match.value === v ? 0 : v) },
			"taste match fit",
		)
	you({ key: "order:foryou", part: "Order", label: "For you", on: taste.order.forYou && !locked, toggle: () => taste.order.setForYou(!taste.order.forYou) }, "order taste")
	you({ key: "order:best", part: "Order", label: "Best match first", on: taste.order.best, toggle: () => taste.order.setBest(!taste.order.best) }, "order sort taste match")
	for (const [id, label, extra] of [
		["unseen", "Not seen yet", "unseen new watched list"],
		["seen", "Seen before", "watched rewatch list"],
		["wishlist", "On your wishlist", "wishlist watchlist want list"],
	] as const)
		you({ key: `list:${id}`, part: "Your lists", label, on: taste.list.has(id), toggle: () => taste.list.turn(id, !taste.list.has(id)) }, extra)

	// Values: what the text names as a setting, in plain words, set the way the tab sets it.
	const val = (h: Omit<Hit, "seg" | "kind" | "value">) => out.push({ ...h, kind: "chip", seg: segOf(h.sub, L), value: true })
	const steps = age.ladder ? age.steps : []
	const nearest = (a: number) => (steps.length ? steps.reduce((b, x) => (Math.abs(x.age - a) < Math.abs(b.age - a) ? x : b), steps[0]) : null)
	const plain = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "")
	const ageHit = (step: { age: number; label: string; show?: string } | null, score: number) => {
		if (!step) return
		const on = age.selected?.age === step.age
		val({
			key: `age:${step.age}`,
			sub: "age",
			label: `Up to ${step.label}${step.show ? ` · ${step.show}` : ""}`,
			on,
			score,
			toggle: () => (on ? age.off() : age.pick(step.age)),
		})
	}
	const moreHit = (k: MoreKey, r: Idx, sub: SubId, label: string, score: number) =>
		val({ key: `more:${k}:${r.join("-")}`, sub, label, on: sameIdx(more[k], r), score, toggle: () => toggleRange(more, k, r) })
	const scoreHits = (w: Extract<Want, { kind: "score" }>) => {
		let sc = w.score
		if (w.scale === "plain" && (MIN_SCORES as readonly number[]).includes(w.v) && w.v > 0) {
			const v = w.v as (typeof MIN_SCORES)[number]
			val({ key: `score:${v}`, sub: "scores", label: `GoodWatch ${v}+`, on: s.minScore === v, score: sc, toggle: () => d.filters.set({ minScore: s.minScore === v ? 0 : v }) })
			sc -= 1
		}
		for (const src of SOURCES) {
			const pct = src.key === "rtCritics" || src.key === "rtAudience"
			if (!src.steps.includes(w.v) || (w.scale === "pct" && !pct) || (w.scale === "ten" && src.key !== "imdb")) continue
			const on = sourceValue(d, src.key) === w.v
			val({ key: `source:${src.key}:${w.v}`, sub: "scores", label: `${src.name} ${src.fmt(w.v)}+`, on, score: sc, toggle: () => setSource(d, src.key, on ? 0 : w.v) })
			sc -= 0.5
		}
		if (w.scale === "ten" && [60, 70, 80, 90].includes(w.v))
			val({ key: `mcu:${w.v}`, sub: "scores", label: `User score ${(w.v / 10).toFixed(1)}+`, on: mcUsers() === w.v, score: sc - 1, toggle: () => setMcUsers(mcUsers() === w.v ? 0 : w.v) })
	}
	for (const w of wants) {
		if (w.kind === "years") {
			const r = w.range
			val({ key: `years:${r.join("-")}`, sub: "released", label: w.label, on: sameRange(years, r), score: w.score, toggle: () => toggleYears(d, r) })
		} else if (w.kind === "age") {
			const step = nearest(w.age)
			if (step && Math.abs(step.age - w.age) <= 3) ageHit(step, w.score)
		} else if (w.kind === "rating") {
			// The ladder's own names first ("PG-13", "TV-MA", "FSK 16", "12A"), else the age the name stands for.
			const own = steps.find((x) => plain(x.label) === w.code || (x.show && plain(x.show) === w.code))
			if (own) ageHit(own, w.score)
			else if (w.age !== null && w.code.length >= 2) ageHit(nearest(w.age), w.score - 2)
		} else if (w.kind === "seasons") {
			const st = SCALES.seasons.stops
			if (w.mode === "one") moreHit("seasons", [0, 1], "shows", "One season", w.score)
			else if (w.mode === "min" && st.indexOf(w.n) > 0) moreHit("seasons", [st.indexOf(w.n), last("seasons")], "shows", `${w.n}+ seasons`, w.score)
			else if (w.mode === "max" && st.indexOf(w.n + 1) > 0) moreHit("seasons", [0, st.indexOf(w.n + 1)], "shows", `Up to ${w.n} seasons`, w.score)
		} else if (w.kind === "length") {
			const on = sameRange(ranges[w.who], w.range)
			val({ key: `len:${w.who}:${w.range.join("-")}`, sub: "length", label: w.label, on, score: w.score, toggle: () => setKind(w.who, on ? ANY_LEN : w.range) })
		} else if (w.kind === "finish") {
			const st = SCALES.finish.stops
			if (w.mode === "max") {
				const j = st.findIndex((x) => x >= w.hours)
				if (j > 0) moreHit("finish", [0, j], "shows", `Under ${st[j]} h to finish`, w.score)
			} else {
				const i = lastAtMost(st, w.hours)
				if (i > 0 && i < last("finish")) moreHit("finish", [i, last("finish")], "shows", `${st[i]} h or more to finish`, w.score)
			}
		} else if (w.kind === "money") {
			const k = w.what
			const st = SCALES[k].stops
			const word = k === "budget" ? "Budget" : "Box office"
			if (w.mode === "min") {
				const i = lastAtMost(st, w.dollars)
				if (i > 0 && i < last(k)) moreHit(k, [i, last(k)], "money", `${word} ${money(st[i])}+`, w.score)
			} else {
				const j = st.findIndex((x) => x >= w.dollars)
				if (j > 0) moreHit(k, [0, j], "money", `${word} under ${money(st[j])}`, w.score)
			}
		} else scoreHits(w)
	}

	// One hit per setting: a value reading and a name match of the same thing keep the better one.
	const best = new Map<string, Hit>()
	for (const h of out) {
		const b = best.get(h.key)
		if (!b || h.score > b.score) best.set(h.key, h)
	}
	// A lone letter that names no rating here ("a") leaves the tab as it is.
	if (!names && best.size === 0) return { hits: [] as Hit[], active: false, loading: false, totals }
	return { hits: [...best.values()], active, loading: titles.loading || people.loading, totals }
}
export type Hits = ReturnType<typeof useHits>
