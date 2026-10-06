// Names of regions and languages from their codes. Building an `Intl.DisplayNames` costs far more than asking it for a
// name, and a title page asks for a dozen names per render, so each formatter is built once per locale and kept.

type NameType = "region" | "language"

const formatters = new Map<string, Intl.DisplayNames | null>()

function formatter(type: NameType, locale: string): Intl.DisplayNames | null {
	const key = `${type}:${locale}`
	let names = formatters.get(key)
	if (names === undefined) {
		try {
			names = new Intl.DisplayNames([locale], { type })
		} catch {
			// A locale the runtime doesn't know: every name falls back to its code.
			names = null
		}
		formatters.set(key, names)
	}
	return names
}

function displayName(type: NameType, code: string, locale: string): string {
	try {
		return formatter(type, locale)?.of(code) ?? code
	} catch {
		// `of` throws on a code that isn't well formed.
		return code
	}
}

/** The name of a region, such as "Germany" for `DE`. Answers with the code when it has no name. */
export const regionName = (code: string, locale = "en") =>
	displayName("region", code, locale)

/** The name of a language, such as "Japanese" for `ja`. Answers with the code when it has no name. */
export const languageName = (code: string, locale = "en") =>
	displayName("language", code, locale)
