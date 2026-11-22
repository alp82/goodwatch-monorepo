// What the tropes index and a trope page load. Read-only. Which titles carry a trope, and how they play it, come
// from the shared trope members cache (trope-members.server.ts), never from a request-time read of the trope table;
// the write-ups themselves are read per trope with a short cache (tropes.server.ts).
// docs/implementation/explore-rethink/spec.md
import { type Ingredient, ing } from "~/domain/browse/address"
import type { ShowTitle, Suggestion } from "~/domain/browse/types"
import {
	TROPES,
	TROPE_GROUPS,
	type Trope,
	groupOf,
	tropeById,
	tropeBySlug,
} from "~/domain/tropes/catalog"
import {
	type Example,
	type GroupBlock,
	type TropeLink,
	type TropePageData,
	type TropeRow,
	type TropesIndexData,
	fitsSpotlight,
	twistBand,
} from "~/domain/tropes/pages"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { TitleKey } from "~/utils/title-key"
import type { Places } from "./places.server"
import { tropeMembers, tropeMembersVersion } from "./trope-members.server"
import { ensureTropes, tropeExamples, tropeOpening } from "./tropes.server"
import { cachedPage } from "./page-cache.server"
import { createVersionMemo } from "./version-memo"

const part = (t: Trope): Ingredient => ing("trope", t.slug)
/** A trope needs this many well-known titles of the kind to get a card. */
const MIN = 6

const memberKeys = (id: string): TitleKey[] => [...(tropeMembers(id)?.keys() ?? [])]
const versionOf = () => `${getTitleSnapshot()?.version ?? "none"}|${tropeMembersVersion()}`

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
async function teaserOf(atlas: Places, t: Trope): Promise<Example | null> {
	const keys = atlas.knownKeys(memberKeys(t.id)).slice(0, 10)
	if (!keys.length) return null
	const ex = await tropeExamples(t.id, keys)
	const pick =
		ex.find(
			(e) =>
				!e.spoilers.length && e.play === "straight" && e.text.length >= 50 && e.text.length <= 170,
		) ?? ex.find((e) => !e.spoilers.length && e.text.length <= 220)
	if (!pick) return null
	const [title] = await atlas.titlesOf([pick.key])
	return title ? { title, as: pick.as, play: pick.play, text: pick.text, spoilers: [] } : null
}

/** The most common tropes claim posters first. With over a hundred overlapping tropes, each
 * group ranks after the previous one has claimed its titles. This keeps promoted candidates
 * in the same bounded card read as their neighbors. */
async function tropePosters(atlas: Places, order: Trope[]): Promise<Map<string, ShowTitle[]>> {
	const pics = new Map<string, ShowTitle[]>()
	// Each 3-poster row considers up to 14 entries. Sixteen rows fit in four 60-card queries.
	const groupSize = 16
	for (let i = 0; i < order.length; i += groupSize) {
		const group = order.slice(i, i + groupSize)
		await atlas.readShowcaseCandidates(
			group.map((t) => [part(t)]),
			3,
			"popular",
		)
		for (const t of group) pics.set(t.id, await atlas.showcase([part(t)], 3, { by: "popular" }))
	}
	return pics
}

async function indexOf(atlas: Places): Promise<TropesIndexData> {
	const counted = TROPES.map((t) => ({ t, n: atlas.count([part(t)]) })).filter((x) => x.n >= MIN)
	const order = [...counted].sort((a, b) => b.n - a.n).map(({ t }) => t)
	// Teasers look up the write-ups of the best-known titles. They never reserve a showcase poster.
	const [pics, teasers] = await Promise.all([
		tropePosters(atlas, order),
		pool(counted, 8, ({ t }) => teaserOf(atlas, t).catch(() => null)),
	])
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
		id: g.id,
		name: g.name,
		line: g.line,
		color: g.color,
		tropes: TROPES.filter((t) => t.group === g.id && rows.has(t.id)).map(
			(t) => rows.get(t.id) as TropeRow,
		),
	})).filter((g) => g.tropes.length)
	// Up front: a trope that is well known but not everywhere, with a teaser that fits the card, picked by the day.
	const all = [...rows.values()]
	const candidates = all.filter((r) => r.n >= 40 && r.n <= 900 && fitsSpotlight(r))
	const day = Math.floor(Date.now() / 86_400_000)
	const feature = candidates[day % Math.max(1, candidates.length)] ?? all[0] ?? null
	return { kind: atlas.kind, groups, feature }
}

/**
 * The index: every trope with a page for the kind, in its named index, with a poster fan and a teaser. It reads a
 * teaser per trope (about a hundred small reads), so it is built once per data version and shared (page-cache.server).
 */
export async function loadTropesIndex(atlas: Places): Promise<TropesIndexData> {
	await ensureTropes()
	return cachedPage(atlas, {
		name: "tropes-index",
		key: atlas.kind,
		build: () => indexOf(atlas),
		complete: () => tropeMembersVersion() > 0,
		shared: true,
	})
}

/**
 * Where the trope turns up more than usual: moods, genres and countries (decades have their own row), ranked by lift
 * against the whole kind, at most three per family, each still a page with a few titles.
 */
async function waysOf(atlas: Places, me: Ingredient, n: number): Promise<Suggestion[]> {
	const all = Math.max(
		1,
		atlas.catalog.decade.reduce((sum, d) => sum + atlas.count([ing("decade", d.slug)]), 0),
	)
	const scored = (["mood", "genre", "country"] as const).flatMap((family) =>
		atlas.catalog[family].map((v) => {
			const p = ing(family, v.slug)
			const theirs = atlas.count([p])
			const both = theirs ? atlas.count([me, p]) : 0
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
		if (top.some((t) => atlas.ref(t.p).label === atlas.ref(x.p).label)) continue
		per.set(x.p.family, k + 1)
		top.push(x)
		if (top.length >= 8) break
	}
	const groups = top.map((x) => [x.p, me])
	await atlas.readShowcaseCandidates(groups, 3, "popular")
	const ways: Suggestion[] = []
	for (const { p, both } of top)
		ways.push({
			place: atlas.ref(p),
			count: both,
			titles: await atlas.showcase([p, me], 3, { by: "popular" }),
		})
	return ways
}

const documentedMemo = createVersionMemo<number>(6)
/** Well-known titles of the kind that carry at least one trope of the directory. */
function documented(atlas: Places): number {
	return documentedMemo.get(versionOf(), atlas.kind, () => {
		const union = new Set<TitleKey>()
		for (const t of TROPES) for (const k of tropeMembers(t.id)?.keys() ?? []) union.add(k)
		return Math.max(1, atlas.knownKeys(union).length)
	})
}

const link = (t: Trope): TropeLink => ({
	slug: t.slug,
	label: t.label,
	line: t.line,
	color: groupOf(t.group).color,
})

/** One trope's page, or null when the slug names no trope of the directory. */
export async function loadTropePage(atlas: Places, slug: string): Promise<TropePageData | null> {
	await ensureTropes()
	const t = tropeBySlug(atlas.canon("trope", slug))
	if (!t) return null
	return cachedPage(atlas, {
		name: "trope",
		key: `${atlas.kind}|${t.slug}`,
		build: () => buildTropePage(atlas, t),
		complete: () => tropeMembersVersion() > 0,
		shared: true,
	})
}

async function buildTropePage(atlas: Places, t: Trope): Promise<TropePageData> {
	const me = part(t)
	const n = atlas.count([me])
	// Chance is measured among titles that have trope write-ups at all: most well-known titles have none, and against
	// all of them every pair of tropes would look like close friends.
	const total = documented(atlas)
	const members = tropeMembers(t.id)
	const known = atlas.knownKeys(memberKeys(t.id))
	const knownSet = new Set(known)
	const twisted = [...(members?.bent().keys() ?? [])].filter((k) => knownSet.has(k))
	// Write-ups: the 40 most watched, then the twisted ones among well-known titles (they are rare and the best part).
	const keys = [...new Set([...known.slice(0, 40), ...atlas.knownKeys(twisted).slice(0, 40)])]
	const [raw, opening, list] = await Promise.all([
		tropeExamples(t.id, keys),
		tropeOpening(t.id),
		atlas.list([me], { size: 60 }),
	])
	const titles = await atlas.titlesOf(raw.map((e) => e.key))
	const byKey = new Map(titles.map((x) => [x.card.key, x]))
	const examples: Example[] = raw.flatMap((e) => {
		const title = byKey.get(e.key)
		return title ? [{ title, as: e.as, play: e.play, text: e.text, spoilers: e.spoilers }] : []
	})
	// Which tropes it meets more, or less, than chance would have it (among well-known titles of the kind).
	const pairs = TROPES.filter((o) => o.id !== t.id)
		.map((o) => {
			const no = atlas.count([part(o)])
			const both = no ? atlas.count([me, part(o)]) : 0
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
	const decades = atlas.catalog.decade
		.map((d) => ({ label: d.label, slug: d.slug, n: atlas.count([me, ing("decade", d.slug)]) }))
		.filter((d) => Number.parseInt(d.label, 10) >= 1930)
	const rate = (d: { slug: string; n: number }) =>
		d.n / Math.max(1, atlas.count([ing("decade", d.slug)]))
	const peak = Math.max(1e-9, ...decades.map(rate))
	// Ways overlap one another and the timeline. Reserve in rank order before the decades
	// choose from the remaining titles, independent of when the database returns cards.
	const [blend, people] = await Promise.all([
		waysOf(atlas, me, n).catch(() => []),
		atlas.people([me], 12).catch(() => []),
	])
	// Each title belongs to exactly one decade, so these groups can reserve concurrently.
	const timelineTitles = await Promise.all(
		decades.map((d) =>
			d.n >= 2
				? atlas.showcase([me, ing("decade", d.slug)], 3, { by: "popular" }).catch(() => [])
				: Promise.resolve([] as ShowTitle[]),
		),
	)
	const group = groupOf(t.group)
	return {
		trope: {
			id: t.id,
			slug: t.slug,
			label: t.label,
			line: t.line,
			group: t.group,
			color: group.color,
			n,
			posters: list.titles.slice(0, 5),
			opening,
			say: t.say,
		},
		group: { id: t.group, name: group.name, color: group.color },
		twist: twistBand(members?.twistShare ?? 0),
		examples,
		contrast: vs ? link(vs) : null,
		travels,
		rarely,
		feels: atlas.traits([me], { n: 4 }).more,
		siblings: TROPES.filter((o) => o.group === t.group && o.id !== t.id)
			.filter((o) => atlas.count([part(o)]) >= MIN)
			.map((o) => ({ slug: o.slug, label: o.label })),
		timeline: decades.map((d, i) => ({ ...d, share: rate(d) / peak, titles: timelineTitles[i] })),
		ways: blend,
		people,
	}
}
