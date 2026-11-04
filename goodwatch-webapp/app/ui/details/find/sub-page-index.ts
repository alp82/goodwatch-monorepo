// What find knows of the title's sub-pages, built in the browser from the same data the sub-pages draw from (nothing
// is rendered to be read):
// - Fingerprint: the effect lines, the eight sections (with what each measures), every effect inside a section, and the
//   twelve scales with their two ends.
// - At a glance: its rows, the Facts tiles, the Content ratings, levels, advisories and viewing guide.
// - Tropes: every trope with its meaning and this title's write-up (the tropes page's one request, loaded when find
//   is first used: useCrossFind).
// - More like this: the titles its shelves show on the page (shelfEntries).
import { strengthWord } from "~/domain/fingerprint-effects/effects"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	CONTENT_SCALES,
	ratings,
	severity,
} from "~/ui/details/at-a-glance/content"
import {
	bingeTime,
	boxOffice,
	genresOf,
	languages,
	madeIn,
	reach,
	released,
	runtimeVsGenre,
	spread,
} from "~/ui/details/at-a-glance/facts"
import type { GlanceRowId } from "~/ui/details/at-a-glance/rows"
import type { FindEntry } from "~/ui/details/find/find-index"
import {
	SECTION_MEANING,
	readSections,
} from "~/ui/details/fingerprint-section/print-model"
import { readTitle } from "~/ui/details/fingerprint-section/reading"
import { AT_A_GLANCE, type SubKind } from "~/ui/details/sub-page/paths"
import {
	ageWord,
	countryName,
	fingerprintInput,
} from "~/ui/details/title-words"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import { openText, rowId } from "~/ui/details/tropes/model"
import type { AllTropesResponse } from "~/ui/details/tropes/tropes-data"
import type { Go } from "./landing"

type Media = MovieResult | ShowResult

export interface SubEntry extends FindEntry {
	sub: SubKind
	go: Go
}

const cssValue = (s: string) => s.replace(/["\\]/g, "\\$&")

export function fingerprintEntries(media: Media): SubEntry[] {
	const t = fingerprintInput(media)
	if (!t) return []
	const reading = readTitle(t)
	const type = media.mediaType
	const out: SubEntry[] = []
	const add = (e: Omit<SubEntry, "key" | "sub" | "section">) =>
		out.push({
			...e,
			sub: "fingerprint",
			section: "sub:fingerprint",
			key: `fp:${out.length}`,
		})
	const lines = new Set<string>()
	for (const p of reading.rows) {
		const r = p.r
		lines.add(r.effect.id)
		add({
			title: r.effect.name,
			context: `What it does to you · ${strengthWord(r)}, ${r.strength.toFixed(1)}`,
			body: r.effect.meaning,
			aliases: "effect feeling",
			go: {
				scope: "fp-effects",
				needle: r.effect.name,
				fp: { kind: "effect", id: r.effect.id },
			},
			rank: 1,
		})
	}
	for (const sec of readSections(reading, type)) {
		add({
			title: sec.label,
			context: `Section · ${sec.word}, ${sec.strength.toFixed(1)}`,
			body: SECTION_MEANING[sec.id] ?? "",
			aliases: "section print",
			go: {
				scope: "fp-print",
				selector: "[data-fp-shown]",
				fp: { kind: "section", id: sec.id },
			},
			rank: 1,
		})
		for (const m of sec.members) {
			if (lines.has(m.r.effect.id)) continue
			add({
				title: m.r.effect.name,
				context: `Effect in ${sec.label} · ${strengthWord(m.r)}, ${m.r.strength.toFixed(1)}`,
				body: m.r.effect.meaning,
				aliases: "effect",
				go: {
					scope: "fp-print",
					selector: "[data-fp-shown]",
					fp: { kind: "effect", id: m.r.effect.id },
				},
				rank: 2,
			})
		}
	}
	for (const s of reading.scales)
		add({
			title: `${s.sc.name}: ${s.word}`,
			context: `Scale · ${s.sc.left} to ${s.sc.right}`,
			aliases: `scale ${s.sc.left} ${s.sc.right}`,
			go: {
				scope: "fp-scales",
				selector: `[data-fp-scale="${cssValue(s.sc.name)}"]`,
				fp: { kind: "scale", id: s.sc.name },
			},
			rank: 2,
		})
	return out
}

export function glanceEntries(
	media: Media,
	country: string,
	questions: TitleQuestion[],
): SubEntry[] {
	const out: SubEntry[] = []
	const add = (
		row: GlanceRowId,
		e: Omit<SubEntry, "key" | "sub" | "section" | "go">,
		needle?: string,
	) =>
		out.push({
			...e,
			sub: "at-a-glance",
			section: "sub:at-a-glance",
			key: `glance:${out.length}`,
			go: { scope: row, ...(needle ? { needle } : { selector: `#${row}-h` }) },
		})
	// The rows (the sub-page's parts).
	add("glance-facts", {
		title: "Facts",
		context: AT_A_GLANCE,
		aliases: "numbers",
		rank: 1,
	})
	add("glance-content", {
		title: "Content",
		context: `${AT_A_GLANCE} · age ratings, what's in it`,
		aliases: "age kids",
		rank: 1,
	})
	if (media.cast?.length)
		add("glance-cast", {
			title: "Starring",
			context: `${AT_A_GLANCE} · the cast`,
			aliases: "cast",
			rank: 1,
		})
	add("glance-crew", {
		title: "Made by",
		context: `${AT_A_GLANCE} · the crew`,
		aliases: "crew",
		rank: 1,
	})

	// Facts: the facts panel's tiles (at-a-glance/FactsPanel.tsx), each when it shows.
	const tile = (name: string, context: string, aliases = "") =>
		add(
			"glance-facts",
			{ title: name, context: `Facts · ${context}`, aliases, rank: 2 },
			name,
		)
	const s = spread(media)
	if (s)
		tile(
			"Critics vs audiences",
			"scores side by side",
			"critics audience score",
		)
	const b = boxOffice(media)
	if (b) tile("Box office", b.headline, "budget gross money")
	const bt = bingeTime(media)
	if (bt)
		tile(
			"Time to watch it all",
			`${bt.episodes} episodes`,
			"binge length hours",
		)
	if (runtimeVsGenre(media))
		tile("Running time", "against its genre", "runtime length minutes")
	if (reach(media)) tile("Reach", "where it streams", "countries")
	const rel = released(media)
	if (rel) tile(rel.label, rel.date, "release date year")
	const g = genresOf(media)
	if (g.length)
		tile(g.length === 1 ? "Genre" : "Genres", g.join(", "), g.join(" "))
	const l = languages(media)
	if (l)
		tile(
			"Language",
			[l.original, ...l.others].join(", "),
			[l.original, ...l.others].join(" "),
		)
	const made = madeIn(media)
	if (made.length)
		tile(
			"Made in",
			made.map(countryName).join(", "),
			made.map(countryName).join(" "),
		)

	// Content: the ratings, the levels and the viewing guide (at-a-glance/glance-rows.tsx).
	for (const r of ratings(media, country).slice(0, 6)) {
		const name = countryName(r.cc)
		add(
			"glance-content",
			{
				title: `Rated ${ageWord(r.cert)} in ${name}`,
				context: "Content · age rating",
				aliases: "age rating certificate",
				rank: 2,
			},
			name,
		)
	}
	const t = fingerprintInput(media)
	const scores = (t?.fingerprint.scores ?? {}) as unknown as Record<
		string,
		number
	>
	const advisories = media.details.content_advisories ?? []
	for (const c of CONTENT_SCALES)
		if (typeof scores[c.key] === "number")
			add(
				"glance-content",
				{
					title: `${c.label}: ${severity(scores[c.key])}`,
					context: "Content · what's in it",
					aliases: "content level",
					rank: 2,
				},
				c.label,
			)
	for (const adv of advisories)
		if (!CONTENT_SCALES.some((c) => c.advisory.test(adv)))
			add(
				"glance-content",
				{
					title: adv.charAt(0) + adv.slice(1).toLowerCase(),
					context: "Content · named in the advisories",
					aliases: "advisory",
					rank: 2,
				},
				adv.charAt(0) + adv.slice(1).toLowerCase(),
			)
	for (const name of [
		...(t?.fingerprint.socialSuitability ?? []),
		...(t?.fingerprint.viewingContext ?? []),
	].map((x) => x.name))
		add(
			"glance-content",
			{
				title: name,
				context: "Content · viewing guide",
				aliases: "good for guide",
				rank: 3,
			},
			name,
		)
	const kids = questions.find((q) => q.id === "kids")
	if (kids)
		add(
			"glance-content",
			{ title: kids.q, context: kids.a, aliases: "kids children", rank: 3 },
			kids.a.slice(0, 40),
		)
	return out
}

export function tropesEntries(data: AllTropesResponse): SubEntry[] {
	const signature = new Set(data.signature)
	return data.tropes.map((t, i) => ({
		key: `tr:${i}`,
		sub: "tropes" as const,
		section: "sub:tropes",
		title: t.name,
		context:
			t.teaser ??
			t.meaning ??
			(signature.has(t.id) ? "Signature trope" : "Trope"),
		body: `${t.meaning ?? ""} ${openText(t.paragraphs)}`,
		aliases: "trope",
		go: { trope: t.id, selector: `#${rowId(t.id)}`, needle: t.name },
		rank: signature.has(t.id) ? 1 : 2,
	}))
}

/**
 * More like this's titles as the page shows them (its shelves load on their own, so they are read off the page when
 * find starts: only the shelves that have loaded). Each is rung on its shelf (scrolled into the row first).
 */
export function shelfEntries(): FindEntry[] {
	if (typeof document === "undefined") return []
	const out: FindEntry[] = []
	const seen = new Set<string>()
	for (const li of document.querySelectorAll<HTMLElement>(
		"#more-like-this li[data-find-title]",
	)) {
		const title = li.dataset.findTitle ?? ""
		const shelf =
			li.closest("section")?.querySelector("h3")?.textContent?.trim() ??
			"More like this"
		const key = `${title}|${shelf}`
		if (!title || seen.has(key)) continue
		seen.add(key)
		out.push({
			key: `more:${out.length}`,
			section: "more-like-this",
			title,
			context: `${shelf}${li.dataset.findYear ? ` · ${li.dataset.findYear}` : ""}`,
			selector: `li[data-shelf-key="${cssValue(li.dataset.shelfKey ?? "")}"]`,
			aliases: "similar like",
			rank: 4,
		})
	}
	return out
}
