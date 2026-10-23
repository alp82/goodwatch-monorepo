// The comparison between a signed-in visitor ("you") and a profile's owner ("them"), for the profile's match card,
// the Taste tab's "Where your tastes meet", the fingerprint's Vs me, and the "You" tags.
//
// Everything follows the owner's visibility as a member sees it: pulls need their Taste, titles both rated and their
// favorites need their Scores, "on their wishlist" needs their Wishlist. The match itself is always shown.
// Cost: the match (two stored tastes, two members' data), two fingerprint portraits (cached 10 minutes each), and one
// display read for at most a few dozen titles.
import type { ProfileTitle } from "~/domain/profile"
import { type ProfileVisibility, canSee } from "~/domain/profile"
import type { MemberCompare } from "~/domain/profile-taste"
import { titleDisplays } from "~/server/taste-portrait/display.server"
import type { FingerprintView } from "~/server/taste-portrait/index.server"
import { loadMemberTaste } from "~/server/taste/member.server"
import { getMemberMatch } from "~/server/taste/member-match.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getUserData } from "~/server/userData.server"
import type { MediaKey } from "~/types/user-data"
import { titlePath } from "~/utils/helpers"
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"
import { bothLove, comparePulls, sharedScores, yourEdgesOnTheirScale } from "./compare-model"
import { getProfilePortrait } from "./portrait.server"

/** How many titles each list carries; the counts say how many there are in all. */
const SHARED_MAX = 60
const LIST_MAX = 12
/** The visitor's scores sent for the "You" tags. */
const YOUR_SCORES_MAX = 2_000

const toTitleKey = (key: string): TitleKey => {
	const [mediaType, id] = key.split("-")
	return titleKey(mediaType as "movie" | "show", Number(id))
}
const mediaKey = (key: TitleKey) => {
	const { mediaType, tmdbId } = parseTitleKey(key)
	return `${mediaType}-${tmdbId}`
}

function scoresOf(data: Awaited<ReturnType<typeof getUserData>>) {
	const scores = new Map<string, number>()
	for (const [key, entry] of Object.entries(data.scores)) if (entry.score) scores.set(key, Number(entry.score))
	return scores
}

/**
 * The comparison, or null when there is nothing to compare (no visitor, or the visitor is the owner). `thin` when
 * either taste has fewer than 5 liked titles.
 */
export async function getMemberCompare(
	viewerId: string | null,
	ownerId: string,
	ownerVisibility: ProfileVisibility,
): Promise<MemberCompare | null> {
	if (!viewerId || viewerId === ownerId) return null
	const match = await getMemberMatch(viewerId, ownerId)
	if ("thin" in match) return { status: "thin", liked: match.liked }

	const seesTaste = canSee(ownerVisibility, "taste", "member")
	const seesScores = canSee(ownerVisibility, "scores", "member")
	const seesWishlist = canSee(ownerVisibility, "wishlist", "member")
	const [yourData, theirData, yourPrint, theirPrint, yourTaste] = await Promise.all([
		getUserData({ user_id: viewerId }),
		getUserData({ user_id: ownerId }),
		getProfilePortrait(viewerId, "fingerprint", { audience: "owner" }),
		seesTaste ? getProfilePortrait(ownerId, "fingerprint", { scores: seesScores }) : Promise.resolve(null),
		loadMemberTaste(viewerId),
	])
	const yours = scoresOf(yourData)
	const theirs = seesScores ? scoresOf(theirData) : new Map<string, number>()
	const shared = sharedScores(yours, theirs)
	const both = bothLove(shared)

	// Their 9s and 10s you haven't rated, the best fit for your taste first.
	const candidates = [...theirs.entries()].filter(([key, score]) => score >= 9 && !yours.has(key)).map(([key]) => key)
	const percentiles = yourTaste.percentile(candidates.map(toTitleKey))
	const onlyThem = candidates
		.map((key, i) => ({ key, fit: percentiles[i] ?? -1 }))
		.sort((a, b) => b.fit - a.fit || a.key.localeCompare(b.key))
	// Your 8s and up they haven't rated (only knowable with their scores), the ones on their wishlist first.
	const wished = new Set(seesWishlist ? Object.keys(theirData.wishlist) : [])
	const onlyYou = seesScores
		? [...yours.entries()]
				.filter(([key, score]) => score >= 8 && !theirs.has(key))
				.map(([key, score]) => ({ key, score, wished: wished.has(key) }))
				.sort((a, b) => Number(b.wished) - Number(a.wished) || b.score - a.score || a.key.localeCompare(b.key))
		: []

	const shown = [
		...shared.slice(0, SHARED_MAX).map((s) => s.key),
		...both.slice(0, LIST_MAX).map((s) => s.key),
		...onlyThem.slice(0, LIST_MAX).map((s) => s.key),
		...onlyYou.slice(0, LIST_MAX).map((s) => s.key),
	]
	const titles = await profileTitles(shown, theirs)
	const labelOf = new Map((yourPrint.status === "ready" ? yourPrint.attributes : []).map((a) => [a.key, a.label]))
	const edges = (view: FingerprintView | null) =>
		view?.status === "ready" ? view.attributes.map((a) => ({ key: a.key, label: a.label, edge: a.edge, tier: a.tier })) : []
	const theirEdges = edges(theirPrint)
	const yourEdges = edges(yourPrint)

	const pick = <T extends { key: string }>(list: T[]) => list.flatMap((item) => (titles.has(item.key) ? [item] : []))
	const yourScores: Record<string, number> = {}
	for (const [key, score] of [...yours.entries()].slice(0, YOUR_SCORES_MAX)) yourScores[key] = score

	return {
		status: "ready",
		percent: match.percent,
		pulls: seesTaste && theirEdges.length && yourEdges.length ? comparePulls(theirEdges, yourEdges) : { both: [], onlyThem: [], onlyYou: [] },
		shared: pick(shared.slice(0, SHARED_MAX)).map((s) => ({ ...(titles.get(s.key) as ProfileTitle), yours: s.yours, theirs: s.theirs })),
		overlap: {
			both: pick(both.slice(0, LIST_MAX)).map((s) => titles.get(s.key) as ProfileTitle),
			bothCount: both.length,
			onlyThem: pick(onlyThem.slice(0, LIST_MAX)).map((s) => {
				const reason = yourTaste.reasons(toTitleKey(s.key), 1)[0]
				return { ...(titles.get(s.key) as ProfileTitle), why: reason ? (labelOf.get(reason) ?? null) : null }
			}),
			onlyThemCount: onlyThem.length,
			onlyYou: pick(onlyYou.slice(0, LIST_MAX)).map((s) => ({
				...(titles.get(s.key) as ProfileTitle),
				yours: s.score,
				wished: s.wished,
			})),
			onlyYouCount: onlyYou.length,
		},
		yourEdges: theirEdges.length && yourEdges.length ? yourEdgesOnTheirScale(theirEdges, yourEdges) : {},
		yourIdentity: yourPrint.status === "ready" ? (yourPrint.identity?.name ?? null) : null,
		yourUsual: yourPrint.subject.usual,
		yourScores,
	}
}

/** Profile titles by media key, with the owner's score where they rated it. */
async function profileTitles(keys: string[], theirs: ReadonlyMap<string, number>): Promise<Map<string, ProfileTitle>> {
	const unique = [...new Set(keys)]
	const displays = await titleDisplays(unique.map(toTitleKey))
	const snapshot = getTitleSnapshot()
	const out = new Map<string, ProfileTitle>()
	for (const [key, display] of displays) {
		const id = mediaKey(key) as MediaKey
		const { mediaType, tmdbId } = parseTitleKey(key)
		out.set(id, {
			key: id,
			mediaType,
			tmdbId,
			title: display.title,
			year: display.year,
			poster: display.poster,
			backdrop: display.backdrop,
			href: titlePath(mediaType, tmdbId, display.title),
			score: theirs.get(id) ?? null,
			gw: snapshot?.facts(key)?.score ?? null,
			date: null,
		})
	}
	return out
}
