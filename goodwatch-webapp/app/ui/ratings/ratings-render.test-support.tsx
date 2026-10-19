import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { MovieResult } from "~/server/types/details-types"
import { extractRatings } from "~/utils/ratings"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import RatingOverlay from "./RatingOverlay"
import Ratings from "./Ratings"

for (const score of [0, null, undefined, NaN, Infinity, -1, 85.9]) {
	const details = { goodwatch_overall_score_normalized_percent: score }
	const ratings = extractRatings(details)
	const overlay = renderToStaticMarkup(
		<RatingOverlay ratings={ratings}><span>82% match</span></RatingOverlay>,
	)
	const ring = renderToStaticMarkup(<ScoreRing media={{ details } as MovieResult} />)
	const panel = renderToStaticMarkup(<Ratings ratings={ratings} />)
	assert.ok(overlay.includes("82% match"), "taste match survives without a score")
	if (score === 85.9) {
		assert.match(overlay, /bg-vibe-80/)
		assert.match(overlay, />85<\/span>/)
		assert.doesNotMatch(ring, /Not rated yet/)
		assert.match(panel, />85<\/dd>/)
	} else {
		assert.doesNotMatch(overlay, /GoodWatch|bg-vibe-/)
		assert.match(ring, /Not rated yet/)
		assert.match(panel, />--<\/dd>/)
	}
}
console.log("Score rendering passed")
