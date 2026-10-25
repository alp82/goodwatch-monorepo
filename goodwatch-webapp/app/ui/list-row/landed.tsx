// What the opened rows of "New on your services" (my-pages/LandedRow) show from the poster parts: the service's logo,
// ringed in sky blue, in the row's words, and the score pill at the row's end. Handed to LandedRow by the page, so
// that LandedRow's own chunk (the words of "newly available", rule 5 in vite.config.js) doesn't carry them.
import { useMemo } from "react"
import type { LandedRowParts } from "~/ui/my-pages/LandedRow"
import { RowLogos, RowScores, rowMark, useRowMarks } from "./RowScores"

export function useLandedRowParts(): LandedRowParts {
	const marksOf = useRowMarks()
	return useMemo(
		() => ({
			logo: (_title, service) => (
				<RowLogos
					services={[
						{ id: service.id, name: service.name, logoPath: service.logo_path },
					]}
					newOn={service.id}
					max={1}
				/>
			),
			end: (title) => {
				const marks = marksOf(title.mediaType, title.tmdbId)
				// What landed is what the member wants to see: the Wishlist bookmark would be on every row.
				return (
					<RowScores
						goodwatch={title.goodwatch}
						score={marks.score}
						mark={rowMark(marks, { want: true })}
					/>
				)
			},
		}),
		[marksOf],
	)
}
