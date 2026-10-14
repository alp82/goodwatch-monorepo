import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
	overlayProsePayload,
	proseBatchKey,
	proseFieldLanguage,
	type ProseSource,
	type ProseTranslation,
} from "./prose-overlay-core.ts"
import { readFileSync } from "node:fs"
const hash = (text: string) => createHash("sha256").update(text).digest("hex")
const translated = (
	source: ProseSource,
	language = "de",
	text = "Eine atmosphärische Reise.",
): ProseTranslation => ({
	source_id: source.sourceId,
	source_revision: source.sourceRevision,
	language,
	text,
	status: "valid",
	validation_revision: "prose-v1",
})
const movie = () => ({
	mediaType: "movie",
	details: { tmdb_id: 603, title: "The Matrix" },
	fingerprint: {
		essenceTags: ["Dark future"],
		essenceText: "An atmospheric journey.",
	},
})

test("prose revisions match Python SHA-256 and stale translations fall back", async () => {
	assert.equal(
		hash("Hello"),
		"185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969",
	)
	const result = await overlayProsePayload(
		movie(),
		"de",
		hash,
		async (sources) =>
			sources.map((s) => ({
				...translated(s),
				source_revision: hash("old source"),
			})),
	)
	assert.equal(result.fingerprint.essenceText, "An atmospheric journey.")
	assert.equal(proseFieldLanguage(result.fingerprint, "essenceText"), "en")
})
test("essence fields carry language without mutating canonical sources", async () => {
	const source = movie(),
		snapshot = JSON.stringify(source)
	const result = await overlayProsePayload(
		source,
		"de",
		hash,
		async (sources) => sources.map((s) => translated(s)),
	)
	assert.equal(result.fingerprint.essenceText, "Eine atmosphärische Reise.")
	assert.equal(proseFieldLanguage(result.fingerprint, "essenceTags", 0), "de")
	assert.equal(JSON.stringify(source), snapshot)
	assert.notEqual(result.fingerprint, source.fingerprint)
})
test("blank, wrong-language, failed and obsolete validation rows fall back", async () => {
	for (const patch of [
		{ text: " " },
		{ language: "fr" },
		{ status: "failed" },
		{ validation_revision: "old" },
	]) {
		const result = await overlayProsePayload(
			movie(),
			"de",
			hash,
			async (sources) => sources.map((s) => ({ ...translated(s), ...patch })),
		)
		assert.equal(result.fingerprint.essenceTags[0], "Dark future")
		assert.equal(proseFieldLanguage(result.fingerprint, "essenceTags"), "en")
	}
})
test("source batches deduplicate and every key includes the full locale", async () => {
	const rows = Array.from({ length: 401 }, (_, index) => ({
		mediaType: "movie",
		tmdbId: index + 1,
		essence_text: `Source ${index}`,
	}))
	const calls: number[] = []
	await overlayProsePayload(
		[...rows, rows[0]],
		"pt-BR",
		hash,
		async (sources, language) => {
			assert.equal(language, "pt-BR")
			calls.push(sources.length)
			return []
		},
	)
	assert.deepEqual(calls, [200, 200, 1])
	const sources = [
		{
			sourceId: "movie:1:essence_text",
			sourceRevision: hash("Source"),
			text: "Source",
		},
	]
	assert.notDeepEqual(
		proseBatchKey(sources, "pt-BR"),
		proseBatchKey(sources, "pt-PT"),
	)
})
test("missing schema never hides entities; English does not query translations", async () => {
	const en = await overlayProsePayload(movie(), "en", hash, async () => {
		throw Error("must not query")
	})
	const de = await overlayProsePayload(movie(), "de", hash, async () => {
		throw Error("missing table")
	})
	assert.equal(en.fingerprint.essenceText, "An atmospheric journey.")
	assert.equal(de.details.tmdb_id, 603)
	assert.equal(de.fingerprint.essenceText, en.fingerprint.essenceText)
})
test("re-overlay uses the canonical prose instead of another locale's translation", async () => {
	const de = await overlayProsePayload(movie(), "de", hash, async (sources) =>
		sources.map((s) => translated(s)),
	)
	const fr = await overlayProsePayload(de, "fr", hash, async (sources) => {
		assert.ok(sources.some((s) => s.text === "An atmospheric journey."))
		return sources.map((s) => translated(s, "fr", "Un voyage atmosphérique."))
	})
	assert.equal(fr.fingerprint.essenceText, "Un voyage atmosphérique.")
})
test("portrait templates use content identity and preserve controls/title inputs", async () => {
	const source = {
		tab: "fingerprint",
		subject: { kind: "member", rated: 20 },
		line: "You love unexpected stories.",
		identity: { name: "The originality seeker" },
		titles: { "movie:1": { title: "Original Title" } },
		attributes: [{ label: "Tension" }],
	}
	const result = await overlayProsePayload(
		source,
		"de",
		hash,
		async (sources) => {
			assert.ok(sources.every((s) => s.sourceId === `template:${hash(s.text)}`))
			return sources.map((s) => translated(s))
		},
	)
	assert.equal(result.line, "Eine atmosphärische Reise.")
	assert.equal(result.titles["movie:1"].title, "Original Title")
	assert.equal(result.attributes[0].label, "Tension")
	assert.equal(proseFieldLanguage(result.identity, "name"), "de")
})
test("14 locale drafts have the same fields and preserve placeholders", () => {
	const resources = JSON.parse(
		readFileSync(
			new URL("../locales/media/templates.json", import.meta.url),
			"utf8",
		),
	)
	const keys = Object.keys(resources.locales.en)
	assert.equal(resources.reviewStatus, "owner-review-required")
	assert.equal(Object.keys(resources.locales).length, 14)
	for (const [locale, pack] of Object.entries(resources.locales) as [
		string,
		Record<string, string>,
	][]) {
		assert.deepEqual(Object.keys(pack), keys, locale)
		for (const key of keys) {
			assert.ok(pack[key].trim(), `${locale}:${key}`)
			assert.deepEqual(
				pack[key].match(/\{[a-zA-Z]+\}/g)?.sort(),
				resources.locales.en[key].match(/\{[a-zA-Z]+\}/g)?.sort(),
				`${locale}:${key}`,
			)
		}
	}
})

test("category facts and FAQ use exact template identities while navigation labels stay English", async () => {
	const payload = {
		pageData: {
			label: "Detective",
			subtitle: "Mystery solvers",
			description: "Every clue matters.",
			faq: [{ q: "Why mysteries?", a: "The clues reward attention." }],
		},
	}
	const result = await overlayProsePayload(
		payload,
		"de",
		hash,
		async (sources) => sources.map((s) => translated(s)),
	)
	assert.equal(result.pageData.label, "Detective")
	assert.equal(result.pageData.subtitle, "Eine atmosphärische Reise.")
	assert.equal(result.pageData.faq[0].a, "Eine atmosphärische Reise.")
	assert.equal(proseFieldLanguage(result.pageData.faq[0], "q"), "de")
})

test("registered prose blocks retain canonical source through a locale switch", async () => {
 const source = {sourceId:"movie:1:other-prose",sourceRevision:hash("Canonical text"),text:"Canonical text"}
 const de=await overlayProsePayload(source,"de",hash,async sources=>sources.map(s=>translated(s)))
 const en=await overlayProsePayload(de,"en",hash,async ()=>{throw Error("English queries")})
 assert.equal(en.text,"Canonical text")
 assert.equal(proseFieldLanguage(en,"text"),"en")
})
