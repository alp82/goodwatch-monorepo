/** Reject mislabeled non-Latin text; allow numbers and mixed-script proper names.
 * This proves script compatibility, not translation quality or Chinese script variant.
 */
const scripts: Record<string, RegExp> = {
	ar: /\p{Script_Extensions=Arabic}/u,
	ru: /\p{Script_Extensions=Cyrillic}/u,
	ja: /[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u,
	ko: /\p{Script_Extensions=Hangul}/u,
	zh: /\p{Script_Extensions=Han}/u,
}
export function hasExpectedMediaScript(text: string, locale: string): boolean {
	const expected = scripts[locale.trim().toLowerCase().split(/[-_]/)[0]]
	if (!expected) return true
	// Modifier letters such as tatweel/length marks cannot prove a native-script name.
	const letters = /[\p{Lu}\p{Ll}\p{Lt}\p{Lo}]/u
	if (!expected.test(text)) return !letters.test(text)
	let hasLetters = false
	for (const char of text) {
		if (!letters.test(char)) continue
		hasLetters = true
		if (expected.test(char)) return true
	}
	return !hasLetters
}
