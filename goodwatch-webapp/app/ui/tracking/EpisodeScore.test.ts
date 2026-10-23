import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const ui = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/tracking/episode-score-interaction.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
		.split("__EPISODE_SCORE_UI__")
		.at(-1) ?? "",
)

test("an unscored episode asks for a score in the title control's face, and the season asks with a star", () => {
	assert.deepEqual(ui.unscored, {
		frame: "none",
		text: "Your scoreRate this episode",
		label: "Rate S1 E3",
		season: "Rate Season 2",
		part: "Your score for S1 E1–12· Spy x Family8",
	})
})

test("the episode's picker is the score dialog, titled with the episode; a score shows in the frame at once and is sent with the episode's TMDB id", () => {
	assert.equal(ui.dialogTitle, "S1 E3 · Bad Tradecraft")
	assert.deepEqual(ui.scored, {
		frame: "9",
		text: "9Your scoreExcellent",
		dialogOpen: false,
	})
	assert.deepEqual(ui.sent[0], { scope: "episode", episodeId: 62087, score: 9 })
})

test("Clear score takes the episode's score away", () => {
	assert.equal(ui.cleared, "none")
	assert.deepEqual(ui.sent[1], {
		scope: "episode",
		episodeId: 62087,
		score: null,
	})
})

test("a season score given in the open season's head never closes the season", () => {
	assert.deepEqual(ui.season, { shown: "7", closes: 0 })
	assert.deepEqual(ui.sent[2], { scope: "season", season: 2, score: 7 })
})
