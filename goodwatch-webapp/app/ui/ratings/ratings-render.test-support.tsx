import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { MovieResult } from "~/server/types/details-types"
import { extractRatings } from "~/utils/ratings"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { ScorePill } from "~/ui/poster-card/ScorePill"

for (const score of [0, null, undefined, NaN, Infinity, -1, 85.9]) {
	const details = { goodwatch_overall_score_normalized_percent: score }
	const ratings = extractRatings(details)
	const pill = renderToStaticMarkup(
		<ScorePill goodwatch={ratings.goodwatch_overall_score_normalized_percent} score={null} mark={null} size="L" />,
	)
	const ring = renderToStaticMarkup(<ScoreRing media={{ details } as MovieResult} />)
	if (score === 85.9) {
		assert.match(pill, /bg-vibe-80/)
		assert.match(pill, />85<\/span>/)
		assert.doesNotMatch(ring, /Not rated yet/)
	} else {
		assert.equal(pill, "", "no pill without a score")
		assert.match(ring, /Not rated yet/)
	}
}
console.log("Score rendering passed")
