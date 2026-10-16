// Every word a member sees or hears of their taste groups (CONTEXT.md) on the TV's home (#673), in one place, so a change of wording
// changes this file alone.
//
// The owner's direction (2026-10-16): no "side", no "just past", no "favorites"; everything is "taste". A group is
// named by its traits ("Dark, tense crime"), which are descriptive words: they reach the home only through `words`
// (server/living-room/home-sides.server.ts), off until the words gate (#656) passes. Until then a group is shown by
// its loved posters alone, without a caption. No share line. The Taste app's own line on home is the view's name
// (ui/taste/taste-groups-name.ts, used in tv-home.ts).

// The machine's module, imported for nothing it holds: it keeps this small module with the TV. A small module that
// several chunks share and whose imports are all on every page is moved into every page's shell (vite.config.js,
// rule 3), as tv-title.ts says too.
import "./tv-machine.ts"

/** Over the groups in home's list, under the apps. */
export const SIDES_HEADING = "Your taste"

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
