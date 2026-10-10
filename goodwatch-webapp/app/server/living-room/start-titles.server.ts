// The titles a guest's start page links to below the living room (#352).
//
// They come from the title snapshot and the display fields alone: no viewer and no country. The guest HTML of the
// start page therefore stays the same for everyone, which the page cache and a crawler both rely on.
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
	if (!snapshot) return []
	try {
		const keys = startTitleKeys(poolCandidates(snapshot, today))
		const displays = await displayFields(keys)
		return keys.flatMap((key) => {
			const display = displays.get(key)
			return display
				? [
						{
							media_type: display.media_type,
							tmdb_id: display.tmdb_id,
							title: display.title,
							release_year: display.release_year,
							poster_path: display.poster_path,
						},
					]
				: []
		})
	} catch (error) {
		console.error("Living room: loading the start titles failed", error)
		return []
	}
}
