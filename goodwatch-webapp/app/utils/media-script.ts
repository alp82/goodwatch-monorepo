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
	const expected = scripts[locale.split("-")[0]]
	if (!expected) return true
	const letters = text.match(/\p{L}/gu) ?? []
	return !letters.length || letters.some((letter) => expected.test(letter))
}
