// The titles the start page links to below the living room (#352).
//
// They come from the title snapshot and the display fields alone: no viewer and no country. A guest's HTML of the
// start page therefore stays the same for everyone, which the page cache and a crawler both rely on.
//
// A member gets the same list. It is a list of what is popular, not a recommendation, so it isn't filtered by what
// the member has seen or hidden: that would need the member's whole viewer context on the first paint, and could
// leave the list short or empty.
import type { TitleDisplay } from "~/server/title-cards.server"
import type { TitleSnapshot } from "~/server/title-snapshot/snapshot.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { poolCandidates, startTitleKeys } from "./pool-keys.server"

/**
 * The start titles, most popular first. Empty while the snapshot loads or when the titles can't be read: the page
 * then shows the section below the room without them. A title without display fields is left out.
 */
export async function loadStartTitles(
	snapshot: Pick<TitleSnapshot, "version" | "forEach" | "factsAt"> | null,
	displayFields: (keys: number[]) => Promise<Map<number, TitleDisplay>>,
	today = Math.floor(Date.now() / 86_400_000),
): Promise<StartTitle[]> {
	return (await loadStartTitlesAndPicture(snapshot, displayFields, today))
		.titles
}

/**
 * The start titles with the first one's backdrop: the new TV's home shows it as its first picture. For a visitor
 * nobody knows anything about, the first start title is the pool's best title, so the picture in the HTML is the
 * real first pick. One field for one title, because the start page's HTML has a byte budget. Null without titles,
 * and when the first title has no backdrop.
 */
export async function loadStartTitlesAndPicture(
	snapshot: Pick<TitleSnapshot, "version" | "forEach" | "factsAt"> | null,
	displayFields: (keys: number[]) => Promise<Map<number, TitleDisplay>>,
	today = Math.floor(Date.now() / 86_400_000),
): Promise<{ titles: StartTitle[]; picture: string | null }> {
	if (!snapshot) return { titles: [], picture: null }
	try {
		const keys = startTitleKeys(poolCandidates(snapshot, today))
		const displays = await displayFields(keys)
		const found = keys.flatMap((key) => displays.get(key) ?? [])
		return {
			titles: found.map((display) => ({
				media_type: display.media_type,
				tmdb_id: display.tmdb_id,
				title: display.title,
				release_year: display.release_year,
				poster_path: display.poster_path,
			})),
			picture: found[0]?.backdrop_path ?? null,
		}
	} catch (error) {
		console.error("Living room: loading the start titles failed", error)
		return { titles: [], picture: null }
	}
}
