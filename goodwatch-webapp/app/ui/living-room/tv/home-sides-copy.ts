// Every word a member sees or hears of Sides of you on the TV's home (#673), in one place, so a change of wording
// changes this file alone.
//
// The owner's direction (2026-10-16): no "side", no "just past", no "favorites"; everything is "taste". A title in
// one of the member's groups is "In your taste", one near a group "Close to your taste". A group is named by its
// traits ("Dark, tense crime"), which are descriptive words: they reach the home only through `words`
// (server/living-room/home-sides.server.ts), off until the words gate (#656) passes. Until then a group is shown by
// its loved posters alone. No share line. The last details come after the owner sees this.

/** What home says of the Taste app while it is on, for a member with a taste. */
export const TASTE_APP_LINE = "What your taste is made of."

/** Over the groups in home's list, under the apps. */
export const SIDES_HEADING = "Your taste"

/** Beside a group's loved posters, on the right while the group is on. */
export const LOVED_LABEL = "In your taste"

/** What a screen reader hears for a group's entry in the list. With the words gate open, the group's name. */
export function sideEntryLabel(
	at: number,
	count: number,
	loved: readonly string[],
	name: string | null,
): string {
	const which = `Your taste, ${at + 1} of ${count}`
	if (name) return `${which}: ${name}`
	return loved.length ? `${which}, with ${listed(loved)}` : which
}

/** The key that opens Watch next with the group's moods. Their names show only with the words gate open. */
export function watchNextKey(moods: readonly string[] | null): string {
	return moods?.length ? `Watch next: ${moods.join(" + ")}` : "Watch next"
}

/** What a screen reader hears for the Watch next key. */
export const WATCH_NEXT_LABEL = "Watch next, in these moods"

/** Over the picks when the member has services and too few of the group's picks stream there. */
export const FEW_ON_SERVICES = "Few of these are on your services"

/** In place of the picks when a group has none. */
export const NO_PICKS = "Nothing new to suggest here yet."

/** "Se7en, Zodiac and Prisoners". */
function listed(titles: readonly string[]): string {
	if (titles.length < 2) return titles.join("")
	return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`
}
