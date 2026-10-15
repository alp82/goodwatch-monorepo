import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/media-fact.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__MEDIA_FACT__")
		.at(-1) ?? "",
)

test("TV facts preserve canonical English markup and annotate only the localized media name", () => {
	assert.equal(rendered.english, "How was The Matrix?")
	assert.equal(
		rendered.arabic,
		'How was <span lang="ar" dir="rtl" data-media-script="tall">المصفوفة</span>?',
	)
	assert.equal(
		rendered.unknown,
		'How was <span lang="und" dir="auto">Pilot</span>?',
	)
})

test("numeric episode names do not annotate the English season code", () => {
	assert.equal(
		rendered.numeric,
		'Next: S2E4 · <span lang="ja">2</span> · 50 min',
	)
})
