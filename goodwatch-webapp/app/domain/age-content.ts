// The age and content filter's rules, shared by the server (the title filter, title cards) and the browser (the
// filter bar's control). Pure.
//
// The age limit is a step of the viewer's country's own rating ladder; off by default. A title passes when its rating
// in that country is at or below the step; a title without a rating there goes by its estimate (the median age across
// the countries that rated it); a title rated nowhere is hidden while the limit is on.
//
// Content comes in five kinds, each either OK to show or hidden. The age limit sets the defaults, and the person's
// choices are kept as overrides, as given: a choice stays when the limit changes, also where the new limit sets the
// same by itself, so going on to a higher limit doesn't show again what the person hid. An override goes away only
// when the person sets the kind back, resets, or clears the filters. Only what is shown as changed (chips, the count
// on Filters, the amber dot, the closed control's words) leaves out the overrides the limit sets anyway.

/** The kinds of content, in the order of the bits of a title's content byte in the snapshot's ratings. */
export const CONTENT_KINDS = [
	"violence",
	"sex",
	"disturbing",
	"language",
	"drugs",
] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

/** The kind's bit in a title's content byte. */
export const contentBit = (kind: ContentKind) =>
	1 << CONTENT_KINDS.indexOf(kind)

export type ContentChoice = "hide" | "show"
/** The person's choices; a kind without one follows the age limit. A choice may equal what the limit sets. */
export type ContentOverrides = Partial<Record<ContentKind, ContentChoice>>

/** Ratings are ages 0 to 18. */
export const MAX_AGE = 18

/** One step of a rating ladder: titles rated up to `age`. */
export interface LadderStep {
	age: number
	label: string
	/** The show rating at the same step, where the country rates shows on another ladder (US: "TV-14"). */
	show?: string
}

/** The ladder the age limit's control draws for the viewer. */
export interface ViewerLadder {
	/** The viewer's country, whose ratings decide. */
	country: string
	/** Lowest first, at least two. */
	steps: LadderStep[]
	/**
	 * Whether the steps are the country's own ratings. False for a country without ratings of its own: the steps are
	 * PLAIN_LADDER, and every title goes by its estimate.
	 */
	local: boolean
}

/** The ladder for a country without ratings of its own: plain ages. */
export const PLAIN_LADDER: readonly LadderStep[] = [0, 6, 12, 16, 18].map(
	(age) => ({ age, label: `${age}+` }),
)

const HIDDEN_UP_TO_6: readonly ContentKind[] = CONTENT_KINDS
const HIDDEN_UP_TO_12: readonly ContentKind[] = ["violence", "sex"]
const NOTHING_HIDDEN: readonly ContentKind[] = []

/**
 * The kinds an age limit hides by itself: all five up to age 6, violence and sex up to 12, none above or with the
 * limit off.
 */
export function defaultHiddenKinds(
	ageLimit: number | undefined,
): readonly ContentKind[] {
	if (ageLimit === undefined || ageLimit > 12) return NOTHING_HIDDEN
	return ageLimit <= 6 ? HIDDEN_UP_TO_6 : HIDDEN_UP_TO_12
}

/** The kinds hidden under an age limit and the person's overrides, in CONTENT_KINDS order. */
export function hiddenKinds(
	ageLimit: number | undefined,
	content: ContentOverrides | undefined,
): ContentKind[] {
	const defaults = defaultHiddenKinds(ageLimit)
	return CONTENT_KINDS.filter((kind) => {
		const choice = content?.[kind]
		return choice ? choice === "hide" : defaults.includes(kind)
	})
}

/** The same as bits: a title is hidden when its content byte has one of them. */
export const hiddenContentBits = (
	ageLimit: number | undefined,
	content: ContentOverrides | undefined,
) =>
	hiddenKinds(ageLimit, content).reduce(
		(bits, kind) => bits | contentBit(kind),
		0,
	)

/**
 * The overrides that differ from what the age limit sets, in CONTENT_KINDS order; undefined when none does. For
 * display alone (what counts as changed): the state and the URL keep every override.
 */
export function changedContent(
	ageLimit: number | undefined,
	content: ContentOverrides | undefined,
): ContentOverrides | undefined {
	if (!content) return undefined
	const defaults = defaultHiddenKinds(ageLimit)
	const out: ContentOverrides = {}
	for (const kind of CONTENT_KINDS) {
		const choice = content[kind]
		if (choice && (choice === "hide") !== defaults.includes(kind))
			out[kind] = choice
	}
	return Object.keys(out).length ? out : undefined
}

/** The overrides without one kind's, which then follows the age limit again; undefined when none is left. */
export function withoutContentChoice(
	content: ContentOverrides | undefined,
	kind: ContentKind,
): ContentOverrides | undefined {
	const out = { ...content }
	delete out[kind]
	return Object.keys(out).length ? out : undefined
}

/**
 * The overrides after the person sets one kind. A choice that differs from what the age limit sets is kept; setting
 * the kind back to what the limit sets takes its override away. The other kinds' overrides stay as they are.
 */
export function withContentChoice(
	ageLimit: number | undefined,
	content: ContentOverrides | undefined,
	kind: ContentKind,
	choice: ContentChoice,
): ContentOverrides | undefined {
	if ((choice === "hide") === defaultHiddenKinds(ageLimit).includes(kind))
		return withoutContentChoice(content, kind)
	return { ...content, [kind]: choice }
}

/** The overrides that show every kind under an age limit: the content filter at its widest. */
export function showAllContent(
	ageLimit: number | undefined,
): ContentOverrides | undefined {
	const hidden = defaultHiddenKinds(ageLimit)
	if (!hidden.length) return undefined
	return Object.fromEntries(
		hidden.map((kind) => [kind, "show"]),
	) as ContentOverrides
}

/**
 * The step an age limit stands for on a ladder. A shared link may carry an age that isn't a step in the viewer's
 * country: then it is the highest step at or below it, or the lowest step when there is none.
 */
export function ladderStepFor(
	steps: readonly LadderStep[],
	ageLimit: number,
): LadderStep {
	let found = steps[0]
	for (const step of steps) if (step.age <= ageLimit) found = step
	return found
}

/**
 * The step a title's age falls under: the lowest step at or above it (the highest step for an age above them all).
 * A show takes the step's show rating where the ladder has one.
 */
export function ratingLabel(
	steps: readonly LadderStep[],
	age: number,
	isShow: boolean,
): string {
	const step =
		steps.find((candidate) => candidate.age >= age) ?? steps[steps.length - 1]
	return (isShow && step.show) || step.label
}

/** What a title card shows of the title's rating while an age limit is on. */
export interface RatingBadge {
	label: string
	/** From the title's ratings in other countries, not the viewer's own: the label is `~<age>`. */
	estimated: boolean
}

/**
 * The card's badge: the ladder step for a title rated in the viewer's country, `~<age>` for one that goes by its
 * estimate, null for a title rated nowhere. `localAge` is null without a rating in the country (and always for a
 * ladder that isn't local).
 */
export function ratingBadge(
	steps: readonly LadderStep[],
	localAge: number | null,
	estimate: number | null,
	isShow: boolean,
): RatingBadge | null {
	if (localAge !== null)
		return { label: ratingLabel(steps, localAge, isShow), estimated: false }
	if (estimate !== null) return { label: `~${estimate}`, estimated: true }
	return null
}
