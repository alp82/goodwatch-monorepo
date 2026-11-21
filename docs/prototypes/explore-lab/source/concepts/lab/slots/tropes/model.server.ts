// PROTOTYPE - throwaway (prototype/explore-r6, reworked r7). Loaders behind the tropes index and a trope page (both
// slots). Read-only.
import { type Ingredient, ing } from "../../../../kit/address"
import type { Kit } from "../../../../kit/data.server"
import {
	TROPES,
	TROPE_GROUPS,
	groupOf,
	tropeById,
	tropeBySlug,
	type Trope,
} from "../../../../kit/tropes"
import {
	ensureTropes,
	tropeBent,
	tropeExamples,
	tropeMembers,
	tropeOpening,
	tropesVersion,
} from "../../../../kit/tropes.server"
import type { ShowTitle, Suggestion } from "../../../../kit/types"
import type {
	Example,
	GroupBlock,
	TropeLink,
	TropePageData,
	TropeRow,
	TropesIndexData,
	TwistBand,
} from "./model"
import { fitsSpotlight } from "./model"

const part = (t: Trope): Ingredient => ing("trope", t.slug)
/** A trope needs this many well-known titles of the kind to get a card. */
const MIN = 6

/** Runs `work` over `items`, `n` at a time, keeping their order. */
async function pool<T, R>(items: T[], n: number, work: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = new Array(items.length)
	let next = 0
	const run = async () => {
		for (let i = next++; i < items.length; i = next++) out[i] = await work(items[i])
	}
	await Promise.all(Array.from({ length: Math.min(n, items.length) }, run))
	return out
}

/** A teaser: the first short write-up among its best-known titles that hides nothing and isn't a twist. */
async function teaserOf(kit: Kit, t: Trope): Promise<Example | null> {
	const keys = kit.knownKeys(tropeMembers(t.id) ?? new Set()).slice(0, 10)
	if (!keys.length) return null
	const ex = await tropeExamples(t.id, keys)
	const pick =
		ex.find(
			(e) =>
				!e.spoilers.length && e.play === "straight" && e.text.length >= 50 && e.text.length <= 170,
		) ?? ex.find((e) => !e.spoilers.length && e.text.length <= 220)
	if (!pick) return null
	const [title] = await kit.titlesOf([pick.key])
	return title ? { title, as: pick.as, play: pick.play, text: pick.text, spoilers: [] } : null
}

/** The index: every trope with a page, in its named index, with a poster fan and a teaser. */
export async function loadIndex(kit: Kit): Promise<TropesIndexData> {
	await ensureTropes()
	const counted = TROPES.map((t) => ({ t, n: kit.count([part(t)]) })).filter((x) => x.n >= MIN)
	// The most common tropes pick their posters first, so the familiar titles land where people look; never one twice.
	const order = [...counted].sort((a, b) => b.n - a.n)
	const pics = new Map<string, ShowTitle[]>()
	for (const { t } of order) pics.set(t.id, await kit.showcase([part(t)], 3, { by: "popular" }))
	const teasers = await pool(counted, 8, ({ t }) => teaserOf(kit, t).catch(() => null))
	const rows = new Map<string, TropeRow>(
		counted.map(({ t, n }, i) => [
			t.id,
			{
				id: t.id,
				slug: t.slug,
				label: t.label,
				line: t.line,
				group: t.group,
				color: groupOf(t.group).color,
				n,
				posters: pics.get(t.id) ?? [],
				teaser: teasers[i],
			},
		]),
	)
	const groups: GroupBlock[] = TROPE_GROUPS.map((g) => ({
		...g,
		tropes: TROPES.filter((t) => t.group === g.id && rows.has(t.id)).map(
			(t) => rows.get(t.id) as TropeRow,
		),
	})).filter((g) => g.tropes.length)
	// Up front: a trope that is well known but not everywhere, with a teaser, picked by the day so it changes.
	const all = [...rows.values()]
	const candidates = all.filter((r) => r.n >= 40 && r.n <= 900 && fitsSpotlight(r))
	const day = Math.floor(Date.now() / 86_400_000)
	const feature = candidates[day % Math.max(1, candidates.length)] ?? all[0] ?? null
	return { kind: kit.kind, groups, feature, slugs: all.map((r) => r.slug) }
}

/**
 * Where the trope turns up more than usual: moods, genres and countries (decades have their own row), ranked by lift
 * against the whole kind, at most three per family, each still a page with a few titles. Round 9: the kit's `blend`
 * wants a full page (24 titles) per pair, which left most tropes with one or two suggestions.
 */
async function waysOf(kit: Kit, me: Ingredient, n: number): Promise<Suggestion[]> {
	const all = Math.max(
		1,
		kit.catalog.decade.reduce((sum, d) => sum + kit.count([ing("decade", d.slug)]), 0),
	)
	const scored = (["mood", "genre", "country"] as const).flatMap((family) =>
		kit.catalog[family].map((v) => {
			const p = ing(family, v.slug)
			const theirs = kit.count([p])
			const both = theirs ? kit.count([me, p]) : 0
			const lift = theirs ? both / n / (theirs / all) : 0
			return { p, both, lift }
		}),
	)
	const top: typeof scored = []
	const per = new Map<string, number>()
	for (const x of scored
		.filter((x) => x.both >= Math.max(6, n * 0.04) && x.lift >= 1.25 && x.both < n * 0.9)
		.sort((a, b) => b.lift * Math.log10(b.both) - a.lift * Math.log10(a.both))) {
		const k = per.get(x.p.family) ?? 0
		if (k >= 3) continue
		if (top.some((t) => kit.ref(t.p).label === kit.ref(x.p).label)) continue
		per.set(x.p.family, k + 1)
		top.push(x)
		if (top.length >= 8) break
	}
	return Promise.all(
		top.map(async (x) => ({
			place: kit.ref(x.p),
			count: x.both,
			titles: await kit.showcase([x.p, me], 3, { by: "popular" }),
		})),
	)
}

const documentedCache = new Map<string, number>()
/** Well-known titles of the kind that carry at least one trope of the directory. */
function documented(kit: Kit): number {
	const id = `${kit.kind}|${tropesVersion()}`
	const hit = documentedCache.get(id)
	if (hit) return hit
	const union = new Set<number>()
	for (const t of TROPES) for (const k of tropeMembers(t.id) ?? []) union.add(k)
	const n = Math.max(1, kit.knownKeys(union).length)
	documentedCache.set(id, n)
	return n
}

const link = (t: Trope): TropeLink => ({
	slug: t.slug,
	label: t.label,
	line: t.line,
	color: groupOf(t.group).color,
})

/**
 * How often it's twisted: the share of every write-up of the trope (all titles in the table, not only the well-known
 * ones) whose first words say it is subverted, inverted, averted, lampshaded, exaggerated, downplayed or played with.
 */
function bandOf(twisted: number, total: number): TwistBand {
	const share = total ? twisted / total : 0
	return share < 0.08 ? "rare" : share < 0.2 ? "sometimes" : share < 0.4 ? "often" : "half"
}

/** One trope's page. */
export async function loadTrope(kit: Kit, slug: string): Promise<TropePageData | null> {
	await ensureTropes()
	const t = tropeBySlug(kit.canon("trope", slug))
	if (!t) return null
	const me = part(t)
	const n = kit.count([me])
	// Chance is measured among titles that have trope write-ups at all: most well-known titles have none, and against
	// all of them every pair of tropes would look like close friends.
	const total = documented(kit)
	const members = tropeMembers(t.id) ?? new Set()
	const known = kit.knownKeys(members)
	const knownSet = new Set(known)
	const twistedAll = await tropeBent(t.id)
	const twisted = [...twistedAll.keys()].filter((k) => knownSet.has(k))
	// Write-ups: the 40 most watched, then the twisted ones among well-known titles (they are rare and the best part).
	const keys = [...new Set([...known.slice(0, 40), ...kit.knownKeys(twisted).slice(0, 40)])]
	const [raw, opening, list] = await Promise.all([
		tropeExamples(t.id, keys),
		tropeOpening(t.id),
		kit.list([me], { size: 60 }),
	])
	const titles = await kit.titlesOf(raw.map((e) => e.key))
	const byKey = new Map(titles.map((x) => [x.card.key, x]))
	const examples: Example[] = raw.flatMap((e) => {
		const title = byKey.get(e.key)
		return title ? [{ title, as: e.as, play: e.play, text: e.text, spoilers: e.spoilers }] : []
	})
	const shown = new Set(examples.map((e) => e.title.card.key))
	const others = list.titles.filter((x) => !shown.has(x.card.key)).slice(0, 14)
	// Which tropes it meets more, or less, than chance would have it (among well-known titles of the kind).
	const pairs = TROPES.filter((o) => o.id !== t.id)
		.map((o) => {
			const no = kit.count([part(o)])
			const both = no ? kit.count([me, part(o)]) : 0
			const expected = (n * no) / Math.max(1, total)
			return { o, no, both, expected, lift: expected ? both / expected : 0 }
		})
		.filter((p) => p.no >= MIN)
	const travels = pairs
		.filter((p) => p.both >= Math.max(4, n * 0.06) && p.lift >= 1.6 && p.o.id !== t.vs)
		.sort((a, b) => b.lift - a.lift)
		.slice(0, 6)
		.map((p) => link(p.o))
	const rarely = pairs
		.filter((p) => p.expected >= 6 && p.lift < 0.8 && p.o.id !== t.vs)
		.sort((a, b) => a.lift - b.lift)
		.slice(0, 4)
		.map((p) => link(p.o))
	const vs = t.vs ? tropeById(t.vs) : undefined
	const decades = kit.catalog.decade
		.map((d) => ({ label: d.label, slug: d.slug, n: kit.count([me, ing("decade", d.slug)]) }))
		.filter((d) => Number.parseInt(d.label, 10) >= 1930)
	const rate = (d: { slug: string; n: number }) =>
		d.n / Math.max(1, kit.count([ing("decade", d.slug)]))
	const peak = Math.max(1e-9, ...decades.map(rate))
	const [timelineTitles, blend, people] = await Promise.all([
		Promise.all(
			decades.map((d) =>
				d.n >= 2
					? kit.showcase([me, ing("decade", d.slug)], 3, { by: "popular" }).catch(() => [])
					: Promise.resolve([] as ShowTitle[]),
			),
		),
		waysOf(kit, me, n).catch(() => []),
		kit.people([me], 12).catch(() => []),
	])
	return {
		trope: {
			id: t.id,
			slug: t.slug,
			label: t.label,
			line: t.line,
			group: t.group,
			color: groupOf(t.group).color,
			n,
			posters: list.titles.slice(0, 5),
			opening,
			say: t.say,
		},
		group: { id: t.group, name: groupOf(t.group).name, color: groupOf(t.group).color },
		twist: bandOf(twistedAll.size, members.size),
		examples,
		contrast: vs ? link(vs) : null,
		travels,
		rarely,
		feels: kit.traits([me], { n: 4 }).more,
		decades: decades.map((d) => ({ ...d, share: rate(d) / peak })),
		others,
		siblings: TROPES.filter((o) => o.group === t.group && o.id !== t.id)
			.filter((o) => kit.count([part(o)]) >= MIN)
			.map((o) => ({ slug: o.slug, label: o.label })),
		timeline: decades.map((d, i) => ({ ...d, share: rate(d) / peak, titles: timelineTitles[i] })),
		ways: blend,
		people,
	}
}
