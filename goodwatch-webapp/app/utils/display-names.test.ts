import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"

const { languageName, regionName } = await import("./display-names.ts")

const RealDisplayNames = Intl.DisplayNames
// The property is read-only in the type, and writable in the runtime.
const intl = Intl as { DisplayNames: typeof Intl.DisplayNames }
let built: string[] = []

beforeEach(() => {
	built = []
	class CountingDisplayNames extends RealDisplayNames {
		constructor(
			locales: Intl.LocalesArgument,
			options: Intl.DisplayNamesOptions,
		) {
			super(locales, options)
			built.push(`${String(locales)}:${options.type}`)
		}
	}
	intl.DisplayNames = CountingDisplayNames as typeof Intl.DisplayNames
})

afterEach(() => {
	intl.DisplayNames = RealDisplayNames
})

test("names a region and a language in English", () => {
	assert.equal(regionName("DE"), "Germany")
	assert.equal(regionName("US"), "United States")
	assert.equal(languageName("ja"), "Japanese")
})

test("builds the formatter once per locale and type, however many names are asked for", () => {
	for (const code of ["FR", "GB", "FR", "JP", "BR"]) regionName(code, "fr")
	for (const code of ["en", "de", "en"]) languageName(code, "fr")
	assert.deepEqual(built, ["fr:region", "fr:language"])
})

test("keeps one formatter per locale", () => {
	assert.equal(regionName("DE", "de"), "Deutschland")
	assert.equal(regionName("DE", "es"), "Alemania")
	assert.equal(regionName("AT", "de"), "Österreich")
	assert.deepEqual(built, ["de:region", "es:region"])
})

test("answers with the code when it isn't a valid code", () => {
	assert.equal(regionName("not a region"), "not a region")
	assert.equal(languageName(""), "")
})
