// The hue of a taste group by its number (1 is the largest), shared by Discover's Sides of you rows and the Discover
// bar's You tab. Telling groups apart starts with their names and posters; the hue only helps.
const HUES = ["#f59e0b", "#38bdf8", "#e879f9", "#4ade80", "#fb7185"]

/** The hue of the titles that fit no group. */
export const NO_SIDE_HUE = "#9ca3af"

/** A group's hue; null (no group) is gray. */
export const sideHue = (number: number | null): string =>
	number === null ? NO_SIDE_HUE : HUES[(number - 1) % HUES.length]
