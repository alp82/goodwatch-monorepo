// PROTOTYPE - throwaway (#659, round 4). The research behind round 4, as JSON (?research=1): how the filters' moods,
// themes, and styles overlap over the whole catalog, and how well each kind of word describes each member's taste
// groups. Read-only; members appear only by slot.
import { protoPerson } from "~/server/prototype-better-sides/person.server"
import { KEYS } from "~/server/taste-portrait/person.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import {
	type Masks,
	WORDS,
	WORD_BY_ID,
	type Word,
	hasWord,
} from "~/ui/prototype-sides-watch-next/words"
import type { TitleKey } from "~/utils/title-key"
import { swnMembers } from "./members.server"
import { buildSides, placeOfTitle } from "./production-sides.server"

// The fingerprint attributes each word's rule asks for (as at least a score), from domain/moods.ts and
// domain/themes-styles.ts. A taste group trait from another attribute has no word in the filters.
const WORD_ATTRIBUTES: Record<string, string[]> = {
	"m:funny": [
		"situational_comedy",
		"wit_wordplay",
		"physical_comedy",
		"absurdist_humor",
		"satire_parody",
	],
	"m:feelgood": ["wholesome", "hopefulness"],
	"m:romance": ["romance"],
	"m:action": ["adrenaline", "spectacle"],
	"m:scary": ["scare"],
	"m:crime": ["mystery", "crime", "intrigue"],
	"m:mind": [
		"surrealism",
		"complexity",
		"philosophical",
		"non_linear_narrative",
	],
	"m:heavy": ["pathos", "melancholy"],
	"m:worlds": ["fantasy", "futuristic"],
	"m:history": ["biographical", "historical"],
	"m:growing": ["coming_of_age"],
	"t:crime": ["crime"],
	"t:mystery": ["mystery"],
	"t:war": ["warfare"],
	"t:politics": ["political"],
	"t:true": ["biographical"],
	"t:history": ["historical"],
	"t:family": ["family_dynamics"],
	"t:mind": ["psychological"],
	"t:showbiz": ["showbiz"],
	"t:sports": ["sports"],
	"t:money": ["class_and_capitalism"],
	"t:future": ["futuristic", "technology_and_humanity"],
	"t:fantasy": ["fantasy"],
	"s:spectacle": ["spectacle"],
	"s:stylized": ["visual_stylization"],
	"s:music": ["music_centrality", "sound_centrality"],
	"s:slow": ["slow_burn"],
	"s:fast": ["fast_pace"],
	"s:talky": ["dialogue_centrality"],
	"s:nonlinear": ["non_linear_narrative"],
	"s:graphic": ["grotesque", "violence"],
}
// The nouns of taste group names (group-names.server.ts) and the filter word that says the same.
const NOUN_WORDS: Record<string, string | null> = {
	documentaries: "s:documentary",
	westerns: null,
	"sports stories": "t:sports",
	"family movies": "t:family",
	horror: "m:scary",
	animation: "s:animated",
	biopics: "t:true",
	"sci-fi": "t:future",
	"war stories": "t:war",
	"period pieces": "t:history",
	fantasy: "t:fantasy",
	romances: "m:romance",
	comedies: "m:funny",
	action: "m:action",
	mysteries: "t:mystery",
	crime: "t:crime",
	thrillers: null,
	adventures: null,
	dramas: null,
	stories: null,
}
const nounOf = (name: string) =>
	Object.keys(NOUN_WORDS)
		.sort((a, b) => b.length - a.length)
		.find((n) => name.toLowerCase().endsWith(n)) ?? null

const SHARE = 0.4
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0)

export async function swnResearch() {
	const snapshot = getTitleSnapshot()
	if (!snapshot) return null
	const { columns } = snapshot
	const masksOf = (key: TitleKey): Masks | null => {
		const row = snapshot.rowOf(key)
		return row < 0
			? null
			: {
					moods: columns.moods[row],
					themes: columns.themes[row],
					styles: columns.styles[row],
				}
	}

	// ---- the catalog: how many titles each word holds, and which words hold mostly the same titles ----
	const sets = WORDS.map(() => [] as number[])
	let analysed = 0
	for (let row = 0; row < snapshot.count; row++) {
		const m = {
			moods: columns.moods[row],
			themes: columns.themes[row],
			styles: columns.styles[row],
		}
		if (!m.moods && !m.themes && !m.styles) continue
		analysed++
		WORDS.forEach((w, i) => {
			if (hasWord(m, w)) sets[i].push(row)
		})
	}
	const lookup = sets.map((s) => new Set(s))
	const overlaps: {
		a: string
		b: string
		both: number
		aInB: number
		bInA: number
	}[] = []
	WORDS.forEach((a, i) =>
		WORDS.forEach((b, j) => {
			if (j <= i) return
			let both = 0
			for (const row of sets[i]) if (lookup[j].has(row)) both++
			const aInB = pct(both, sets[i].length)
			const bInA = pct(both, sets[j].length)
			if (Math.max(aInB, bInA) >= 50)
				overlaps.push({ a: a.id, b: b.id, both, aInB, bInA })
		}),
	)
	overlaps.sort((x, y) => Math.max(y.aInB, y.bInA) - Math.max(x.aInB, x.bInA))

	// ---- members: each taste group read in the three kinds of words ----
	const members = await swnMembers()
	const out = []
	for (const member of members) {
		const [proto, ctx] = await Promise.all([
			protoPerson(member.userId),
			getMemberViewerContext(member.userId, "US"),
		])
		if (!proto) continue
		const { person } = proto
		const built = buildSides(person)
		const listed = [...ctx.wishlist.keys()].filter(
			(k) => snapshot.facts(k)?.mediaType === "movie",
		)
		const groupOfListed = new Map<TitleKey, string | null>()
		for (const key of listed) {
			const z = person.zOf(key)
			const place = z ? placeOfTitle(z, built.protoGroups) : null
			groupOfListed.set(key, place?.how === "in" ? place.side : null)
		}
		const allLoved = built.protoGroups.flatMap((g) =>
			g.members.flatMap((k) => masksOf(k) ?? []),
		)
		const baseOf = (w: Word) =>
			allLoved.length
				? allLoved.filter((m) => hasWord(m, w)).length / allLoved.length
				: 0
		const groups = built.sides.map((side) => {
			const proto = built.protoGroups.find((g) => g.side === side.id)
			const loved = (proto?.members ?? []).flatMap((k) => masksOf(k) ?? [])
			const share = (w: Word) =>
				loved.length
					? loved.filter((m) => hasWord(m, w)).length / loved.length
					: 0
			const shares = WORDS.map((w) => ({ id: w.id, share: share(w) }))
				.filter((s) => s.share > 0)
				.sort((a, b) => b.share - a.share)
			// Per kind, the word that most sets the group apart from the member's other loved titles (lift), held by at
			// least SHARE of the group.
			const best = (kind: Word["kind"]) => {
				const top = shares
					.filter((s) => s.share >= SHARE)
					.map((s) => ({ ...s, w: WORD_BY_ID[s.id] }))
					.filter((s) => s.w.kind === kind)
					.map((s) => ({ ...s, lift: s.share / Math.max(0.01, baseOf(s.w)) }))
					.filter((s) => s.lift >= 1.15)
					.sort((a, b) => b.lift - a.lift)[0]
				return top ? top.id : null
			}
			const recipe = [best("mood"), best("theme"), best("style")].filter(
				(x): x is string => x !== null,
			)
			const inGroup = listed.filter((k) => groupOfListed.get(k) === side.id)
			const masks = new Map(listed.map((k) => [k, masksOf(k)]))
			const fitsRecipe = (k: TitleKey) => {
				const m = masks.get(k)
				return (
					!!m &&
					recipe.length > 0 &&
					recipe.every((id) => hasWord(m, WORD_BY_ID[id]))
				)
			}
			const recipeHits = listed.filter(fitsRecipe)
			// The single mood that holds the most of the group on the list (round 3's place for it).
			const moodCover = WORDS.filter((w) => w.kind === "mood")
				.map((w) => {
					const n = inGroup.filter((k) => {
						const m = masks.get(k)
						return m && hasWord(m, w)
					}).length
					const all = listed.filter((k) => {
						const m = masks.get(k)
						return m && hasWord(m, w)
					}).length
					return { id: w.id, n, all }
				})
				.sort((a, b) => b.n - a.n)[0]
			// The ceiling: the one word, and the two words together, that best pick out the group on the list (F1).
			const f1 = (hit: (m: Masks) => boolean) => {
				const hits = listed.filter((k) => {
					const m = masks.get(k)
					return m && hit(m)
				})
				const tp = hits.filter((k) => groupOfListed.get(k) === side.id).length
				return {
					f1: tp ? Math.round((200 * tp) / (hits.length + inGroup.length)) : 0,
					recall: pct(tp, inGroup.length),
					precision: pct(tp, hits.length),
				}
			}
			const singles = WORDS.map((w) => ({
				id: w.id,
				...f1((m) => hasWord(m, w)),
			})).sort((a, b) => b.f1 - a.f1)
			const pairs = WORDS.flatMap((a, i) =>
				WORDS.slice(i + 1).map((b) => ({
					id: `${a.id}+${b.id}`,
					...f1((m) => hasWord(m, a) && hasWord(m, b)),
				})),
			).sort((a, b) => b.f1 - a.f1)
			const nameKeys = proto?.keys ?? []
			const noun = nounOf(side.name)
			return {
				name: side.name,
				loved: loved.length,
				top: shares
					.slice(0, 8)
					.map((s) => `${s.id} ${Math.round(100 * s.share)}%`),
				recipe,
				nameTraits: nameKeys.map((k) => ({
					trait: k,
					words: Object.entries(WORD_ATTRIBUTES)
						.filter(([, attrs]) => attrs.includes(k))
						.map(([id]) => id),
				})),
				noun,
				nounWord: noun ? NOUN_WORDS[noun] : null,
				listedInGroup: inGroup.length,
				oneMood: moodCover
					? {
							mood: moodCover.id,
							holdsOfGroup: pct(moodCover.n, inGroup.length),
							groupShareOfMood: pct(moodCover.n, moodCover.all),
						}
					: null,
				bestWord: singles[0],
				bestPair: pairs[0],
				recipeOnList: {
					titles: recipeHits.length,
					inGroup: recipeHits.filter((k) => groupOfListed.get(k) === side.id)
						.length,
					recall: pct(
						recipeHits.filter((k) => groupOfListed.get(k) === side.id).length,
						inGroup.length,
					),
					precision: pct(
						recipeHits.filter((k) => groupOfListed.get(k) === side.id).length,
						recipeHits.length,
					),
				},
			}
		})
		out.push({
			slot: member.slot,
			listedMovies: listed.length,
			inAnyGroup: [...groupOfListed.values()].filter(Boolean).length,
			groups,
		})
	}
	return {
		catalog: {
			titles: snapshot.count,
			withWords: analysed,
			words: WORDS.map((w, i) => ({
				id: w.id,
				name: w.name,
				titles: sets[i].length,
			})),
			overlaps,
		},
		attributesWithAWord: [...new Set(Object.values(WORD_ATTRIBUTES).flat())]
			.length,
		attributes: KEYS.length,
		members: out,
	}
}
