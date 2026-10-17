import { availabilityLoaded } from "~/server/availability-index.server"
import { getTopFingerprintKeys } from "~/server/fingerprint-preview.server"
import { adjective, isWorded } from "~/server/taste-portrait/words.server"
import { NO_TASTE } from "~/server/taste/taste.server"
import { getTitleCards } from "~/server/title-cards.server"
import { type ViewerContext, getViewerContext } from "~/server/viewer.server"
import type { IntroCard } from "~/ui/living-room/intro/data"
// The intro film's data (docs/implementation/home-intro.md), for /api/intro. Two parts:
// - What is the same for everyone comes from content.json, a snapshot of the catalog taken when the film was made:
//   the intro's titles and their feeling words, the five numbers behind the score chapter's title, the search phrase
//   with its reading and results, the streaming wall, the Explorer's islands and combination, the filter steps and
//   their counts, the pick and its feelings. It never runs the site's search or other costly work per request.
// - What depends on the visitor is read per request and kept per country for ten minutes: the titles as cards with
//   their services where the visitor is (title-cards.server.ts), and the streaming chapter's title on Netflix there.
import type { IntroData } from "~/ui/living-room/intro/scene"
import type { TitleKey } from "~/utils/title-key"
import { MAX_CARDS } from "./cards-param"
import content from "./content.json"
import { netflixFor } from "./netflix.server"

const KEEP_MS = 10 * 60 * 1000
/** How long a request waits for the visitor's country's availability to load after a restart. */
const AVAILABILITY_WAIT_MS = 2500

const feelsOf = new Map(content.pool.map((t) => [t.key, t.feels]))

/** The visitor's country and services: the intro's data is the same for every visitor who shares them. */
const keyOf = (viewer: ViewerContext) =>
	`${viewer.country}|${viewer.services.join(",")}`

const kept = new Map<string, { at: number; data: Promise<IntroData> }>()

export async function loadIntro(request: Request): Promise<IntroData> {
	const viewer = await getViewerContext(request)
	const key = keyOf(viewer)
	const now = Date.now()
	const hit = kept.get(key)
	if (hit && now - hit.at < KEEP_MS) return hit.data
	const data = build(viewer)
	kept.set(key, { at: now, data })
	data.catch(() => kept.delete(key))
	// Old countries go once their time is up, so the map stays as small as the countries that visit.
	for (const [k, v] of kept) if (now - v.at >= KEEP_MS) kept.delete(k)
	return data
}

async function build(viewer: ViewerContext): Promise<IntroData> {
	await availabilityLoaded(viewer.country, AVAILABILITY_WAIT_MS)
	const keys = content.pool.map((t) => t.key as TitleKey)
	const cards = await getTitleCards(keys, viewer, NO_TASTE)
	const pool: IntroCard[] = cards.map((card) => ({
		...card,
		feels: feelsOf.get(Number(card.key)) ?? [],
	}))
	const netflix = await netflixFor(viewer.country, pool)
	const { pool: _snapshotPool, capturedAt: _capturedAt, ...extra } = content
	return { pool, extra: { ...extra, netflix } }
}

/**
 * Titles as intro cards for the quiz's pick: score, services where the visitor is, and the three feeling words their
 * title analysis is strongest in.
 */
export async function loadIntroCards(
	request: Request,
	keys: TitleKey[],
): Promise<IntroCard[]> {
	const viewer = await getViewerContext(request)
	await availabilityLoaded(viewer.country, AVAILABILITY_WAIT_MS)
	const cards = await getTitleCards(keys.slice(0, MAX_CARDS), viewer, NO_TASTE)
	return Promise.all(
		cards.map(async (card) => {
			const top = await getTopFingerprintKeys({
				likedItems: [{ tmdb_id: card.tmdb_id, media_type: card.media_type }],
				topN: 8,
			}).catch(() => [])
			return {
				...card,
				feels: top
					.filter((k) => isWorded(k.key))
					.slice(0, 3)
					.map((k) => adjective(k.key)),
			}
		}),
	)
}
