// My shows, a member's: the shows with a Next episode, then the Want to See shows to start, in the list every app
// shows its titles in (../TitleList.tsx). The show with the focus is named above the row, with its Next episode or
// what starting it takes, and its backdrop is the picture. A show opens its title screen, where Seen it marks the
// Next episode. A chunk the TV asks for on first use (screen-code.tsx).
//
// The rows are the member's loader's (tv-shows.ts, `showRows`). A show the New episodes signal counts carries
// "New" on its poster, and the line under the screen's name says what is new.
//
// A poster says where a press leads: the Next episode with its length ("S2 E4 · 50 min"), or "Start". On the
// phone a poster is too small for that, and the line of the focused show says it.
//
// My shows has no key of its own beside the row: the list's last row on the phone is the Expand key's corner.
import { TitleList, type TvListTitle } from "../TitleList"
import { useReport } from "../kit"
import {
	NO_SIGNAL,
	SHOWS_EMPTY,
	type TvShows,
	type TvShowsSignal,
	showRows,
	showSays,
	showsCrumb,
} from "../tv-shows"
import { type TvShowsReport, useTvShows } from "../use-tv-shows"

/**
 * What is new for the member's shows (use-tv-shows.ts). Draws nothing. The scene mounts it once for a member and
 * gets what it holds through `report`. It is in this chunk, so the signal's words cost nothing in the page's
 * first view.
 */
export function ShowsData({
	report,
}: { report: (signal: TvShowsReport | null) => void }) {
	useReport(report, useTvShows())
	return null
}

export default function Shows({
	items,
	shows,
	signal,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	/** The member's shows on the TV, from the loader. */
	shows: TvShows | null
	/** What is new for them; null until its data component has reported. */
	signal: TvShowsSignal | null
}) {
	const news = signal ?? NO_SIGNAL
	const titles: TvListTitle[] = showRows(shows, news).map((row) => ({
		key: row.key,
		title: row.title,
		poster: row.poster_path,
		backdrop: row.backdrop_path,
		facts: row.facts,
		label: row.label,
		mark: row.fresh ? "New" : undefined,
		says: showSays(row),
	}))
	return (
		<TitleList
			name="My shows"
			crumb={showsCrumb(shows, news)}
			items={items}
			titles={titles}
			empty={SHOWS_EMPTY}
		/>
	)
}
