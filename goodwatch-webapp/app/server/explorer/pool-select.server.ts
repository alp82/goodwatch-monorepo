// Which snapshot rows make the Explorer's pool: the most voted presentable movies and shows with a backdrop. It reads
// the snapshot's columns only. A facts object per row (238,000 of them) blocked the event loop for 500 to 850 ms after
// every snapshot reload.
import { FLAG_BACKDROP } from "~/server/title-snapshot/format.server"
import { FLAG_ADULT, presentableAt } from "~/server/title-snapshot/index.server"
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"

const POOL = {
	movie: { minVotes: 800, size: 9000 },
	show: { minVotes: 200, size: 3000 },
}

/** Selects pool rows by votes descending, then snapshot row ascending, without creating title facts. */
export function selectCandidateRows(snapshot: TitleSnapshot): {
	movie: number[]
	show: number[]
} {
	const columns = snapshot.columns
	const { pointIds, flags, votes } = columns
	const found = { movie: [] as number[], show: [] as number[] }
	for (let row = 0; row < pointIds.length; row++) {
		const mediaType = pointIds[row] >= 2e12 ? "show" : "movie"
		if (
			presentableAt(columns, row) &&
			(flags[row] & FLAG_BACKDROP) !== 0 &&
			(flags[row] & FLAG_ADULT) === 0 &&
			votes[row] >= POOL[mediaType].minVotes
		)
			found[mediaType].push(row)
	}
	const top = (list: number[], size: number) =>
		list.sort((a, b) => votes[b] - votes[a] || a - b).slice(0, size)
	return {
		movie: top(found.movie, POOL.movie.size),
		show: top(found.show, POOL.show.size),
	}
}
