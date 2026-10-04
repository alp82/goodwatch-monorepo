// Loaded before the alias hook, which rewrites relative imports.
import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { titleQuestions } = await import("./titleQuestions.ts")

const show = (details: Record<string, unknown>) =>
	({
		mediaType: "show",
		details: {
			title: "DAS!",
			genres: [],
			keywords: [],
			tropes: [],
			age_certifications: [],
			number_of_seasons: 36,
			number_of_episodes: 4000,
			...details,
		},
		fingerprint: null,
		streaming_availabilities: [],
		streaming_services: [],
	}) as never

const lengthOf = (media: never) =>
	titleQuestions(media, "US").find((faq) => faq.id === "length")?.a

test("a show's length answer names the episode length from episode_runtime", () => {
	assert.equal(
		lengthOf(show({ episode_runtime: [45] })),
		"It has 36 seasons with 4000 episodes of about 45 minutes each.",
	)
})

test("a show without an episode length leaves that part out", () => {
	for (const episode_runtime of [null, undefined, []])
		assert.equal(
			lengthOf(show({ episode_runtime })),
			"It has 36 seasons with 4000 episodes.",
		)
})
