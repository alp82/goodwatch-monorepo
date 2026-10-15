import type { PresentedMedia } from "~/utils/media-presentation"
// My library (#385): one step of a status's list, with the counts of every status. The counts and the order are
// made from the member data map; the catalog is read by key only: the cards of the step's 60 titles (Q6), and, for
// the Title sort and a search, the titles of the status's keys, which are public and kept in memory
// (docs/implementation/tracking/data-model.md, "Reads": Library). The watch log is not read.
// The Want to See list also says which of its titles are new on one of the member's services (#489); the route
// passes that in, from the availability index.
import {
	type LibraryChoice,
	type LibraryKind,
	type LibrarySort,
	type LibraryStatus,
	libraryCounts,
	libraryKeys,
	libraryOrder,
	libraryStep,
	needsTitles,
} from "~/domain/my-library"
import type { NewOn } from "~/domain/newly-available-words"
import { getUserData } from "~/server/userData.server"
import {
	type MediaKey,
	type MediaType,
	type UserData,
	parseMediaKey,
} from "~/types/user-data"
import { query } from "~/utils/crate"
import { type TitleKey, titleKey } from "~/utils/title-key"

/** A title in a list of the library, with where the member stands with it. */
export interface LibraryItem extends PresentedMedia {
	key: MediaKey
	mediaType: MediaType
	tmdbId: number
	title: string
	poster_path: string | null
	release_year: number | null
	/** The member's score, 1 to 10; null when not rated. */
	score: number | null
	state: "watching" | "on_hold" | "dropped" | "seen" | null
	/** The latest dated watch (ISO); null without one. */
	watchedAt: string | null
	/** Log rows of the title: how often it was watched. */
	watches: number
	/** When it was added to the Wishlist (ISO); null when it is not on it. */
	addedAt: string | null
	/** A show: different regular episodes watched in the current pass, and how many have aired. */
	episodesWatched: number | null
	airedEpisodes: number | null
	/** On the Want to See list: the service the title landed on in the last 14 days (#489). Left out otherwise. */
	newOn?: NewOn
}

export interface LibraryPage {
	counts: Record<LibraryStatus, number>
	status: LibraryStatus
	sort: LibrarySort
	kind: LibraryKind
	q: string
	/** Titles of the status under the search, by kind. */
	kinds: Record<LibraryKind, number>
	total: number
	items: LibraryItem[]
	/** Where the next step starts; null at the end. */
	next: number | null
	left: number
}

const BATCH = 500
const TITLES_KEEP_MS = 6 * 60 * 60 * 1000
const TITLES_MAX_KEPT = 200_000
// A title's name is public and the same for everyone: kept per title, so a member's second Title sort reads nothing.
const titlesKept = new Map<MediaKey, { at: number; title: string }>()

const split = (keys: readonly MediaKey[]) => {
	const ids = { movie: [] as number[], show: [] as number[] }
	for (const key of keys) {
		const { mediaType, tmdbId } = parseMediaKey(key)
		ids[mediaType].push(tmdbId)
	}
	return ids
}
const marks = (ids: readonly number[]) => ids.map(() => "?").join(", ")

/** The names of some titles, by key. A title the catalog no longer has is missing from the result. */
export async function titlesOf(
	keys: readonly MediaKey[],
): Promise<Map<MediaKey, string>> {
	const now = Date.now()
	const found = new Map<MediaKey, string>()
	const missing: MediaKey[] = []
	for (const key of keys) {
		const kept = titlesKept.get(key)
		if (kept && now - kept.at < TITLES_KEEP_MS) found.set(key, kept.title)
		else missing.push(key)
	}
	const ids = split(missing)
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			for (let i = 0; i < ids[type].length; i += BATCH) {
				const batch = ids[type].slice(i, i + BATCH)
				const rows = await query<{ tmdb_id: number; title: string | null }>(
					`SELECT tmdb_id, title FROM ${type} WHERE tmdb_id IN (${marks(batch)})`,
					batch,
				)
				for (const row of rows) {
					const key: MediaKey = `${type}-${Number(row.tmdb_id)}`
					const title = row.title ?? ""
					titlesKept.set(key, { at: now, title })
					found.set(key, title)
				}
			}
		}),
	)
	if (titlesKept.size > TITLES_MAX_KEPT) titlesKept.clear()
	return found
}

/** For tests: forget the kept titles. */
export const forgetTitlesForTest = () => titlesKept.clear()

interface CardRow {
	tmdb_id: number
	title: string | null
	poster_path: string | null
	release_year: number | null
	aired_episode_count?: number | null
}

/** Q6. The cards of one step, by key. */
async function readCards(keys: readonly MediaKey[]) {
	const ids = split(keys)
	const cards = new Map<MediaKey, CardRow>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			if (!ids[type].length) return
			const rows = await query<CardRow>(
				`SELECT tmdb_id, title, poster_path, release_year${type === "show" ? ", aired_episode_count" : ""}
				 FROM ${type} WHERE tmdb_id IN (${marks(ids[type])})`,
				ids[type],
			)
			for (const row of rows) cards.set(`${type}-${Number(row.tmdb_id)}`, row)
		}),
	)
	return cards
}

const iso = (value: Date | string | number | null | undefined) =>
	value == null ? null : new Date(value).toISOString()

/** A status's list for a member's data: its order, one step of it as cards, and every status's count. */
export async function libraryPageOf(
	userData: Pick<UserData, "wishlist" | "watchState" | "scores">,
	choice: LibraryChoice,
	offset = 0,
	/** The services the member's titles are new on, by title: the Want to See list marks them. */
	newOn?: ReadonlyMap<TitleKey, NewOn>,
): Promise<LibraryPage> {
	const titles = needsTitles(choice)
		? await titlesOf(libraryKeys(userData, choice.status))
		: null
	const order = libraryOrder(
		userData,
		choice,
		titles ? (key) => titles.get(key) : undefined,
	)
	const step = libraryStep(order.keys, offset)
	const cards = await readCards(step.keys)
	const items = step.keys.flatMap((key): LibraryItem[] => {
		const card = cards.get(key)
		// A title the catalog no longer has (deleted on TMDB) has nothing to show.
		if (!card) return []
		const entry = userData.watchState[key]
		const { mediaType, tmdbId } = parseMediaKey(key)
		const show = mediaType === "show"
		const aired = show ? (card.aired_episode_count ?? null) : null
		const fresh =
			choice.status === "want"
				? newOn?.get(titleKey(mediaType, tmdbId))
				: undefined
		return [
			{
				key,
				mediaType,
				tmdbId,
				title: card.title ?? "",
				poster_path: card.poster_path,
				release_year: card.release_year,
				score: userData.scores[key]?.score ?? null,
				state: entry?.state ?? null,
				watchedAt: iso(entry?.watchedAt),
				watches: entry?.count ?? 0,
				addedAt: iso(userData.wishlist[key]?.createdAt),
				episodesWatched:
					show && entry
						? aired === null
							? entry.episodesWatched
							: Math.min(entry.episodesWatched, aired)
						: null,
				airedEpisodes: aired,
				...(fresh ? { newOn: fresh } : {}),
			},
		]
	})
	return {
		counts: libraryCounts(userData),
		status: choice.status,
		sort: order.sort,
		kind: choice.kind,
		q: choice.q,
		kinds: order.kinds,
		total: order.total,
		items,
		next: step.next,
		left: step.left,
	}
}

/** One step of a member's library, from their cached member data. */
export async function getLibraryPage(
	userId: string,
	choice: LibraryChoice,
	offset = 0,
	newOn?: ReadonlyMap<TitleKey, NewOn>,
): Promise<LibraryPage> {
	return libraryPageOf(
		await getUserData({ user_id: userId }),
		choice,
		offset,
		newOn,
	)
}
