import {
	episodeLayoutOf,
	type EpisodeLayout,
} from "~/domain/tracking/episode-layout"
import { getEpisodePresentation } from "./episode-presentation.server"
import { getSourceEpisodeList } from "./tracking.server"

/** The same canonical/presented seasons as tracking, without reading any member's history. */
export async function getEpisodeLayout(
	showId: number,
): Promise<EpisodeLayout | null> {
	const presentation = await getEpisodePresentation(showId)
	const layout = presentation
		? episodeLayoutOf(presentation.episodes, presentation.note)
		: episodeLayoutOf(
				(await getSourceEpisodeList(showId)).map((row) => ({
					season: row.season_number,
				})),
			)
	return layout.seasons.length ? layout : null
}
