import assert from "node:assert/strict"
import { test } from "node:test"
import { signalWords } from "./new-episodes-signal.ts"

test("the navigation signal uses approved labels and explicit catalog labels for additional episodes", () => {
	const fresh = {
		shows: 1,
		only: {
			title: "MF GHOST",
			season: 1,
			number: 13,
			displaySeason: 2,
			displayNumber: 1,
			episodes: 1,
		},
	}
	assert.match(signalWords(fresh)?.tile ?? "", /S2 E1/)
	assert.match(
		signalWords({
			...fresh,
			only: { ...fresh.only, number: 38, displaySeason: -1 },
		})?.tile ?? "",
		/TMDB S1 E38/,
	)
})
