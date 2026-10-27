// The rating flow: one title at a time on /taste/quiz and in the Taste page's start, and the taste view it opens.
// This file is its pure state: what the person's ratings add up to, when a milestone lands, the words of the top strip,
// the taste bar and the resume bar, the keys, and the rows of "Your ratings". No React and no I/O, so the tests run it
// as it is; `use-rating-flow.ts` binds it to the person's ratings and the save.
//
// Rules (owner, October 27, 2026; docs/design/rating-onboarding/README.md):
// - The taste is ready at the server's rule: MIN_LIKED liked titles, a score of LIKED_FROM or higher
//   (~/domain/taste-rules, shared with server/taste/formula.server.ts).
// - After that a milestone lands every MILESTONE_EVERY ratings. A milestone never stops rating: the taste bar turns
//   amber for MILESTONE_GLOW ratings, or until the taste view is opened.
// - "Haven't seen it" (don't ask me about this title again) and "Not interested" (don't recommend it) are two marks of
//   their own. Neither is a score, so neither counts as rated.
// - Counts are the person's totals: a member's account, a guest's browser progress. Earlier ratings count too.
import type { Score } from "~/server/scores.server"
import {
	LIKED_FROM,
	MILESTONE_EVERY,
	MIN_LIKED,
	isLikedScore,
} from "../../domain/taste-rules.ts"
import { isRepeatPress } from "../scoring/score-ack.ts"

/** The rating flow's page. */
export const FLOW_PATH = "/taste/quiz"
/** The flow's taste view: where "Save your taste" brings a new member back after sign-up. */
export const TASTE_VIEW_PATH = `${FLOW_PATH}?view=taste`

export type FlowView = "rate" | "taste"

/** The view an address asks for. `?show=picks` is the old quiz's return from sign-up and opens the taste view too. */
export function viewOf(params: URLSearchParams): FlowView {
	return params.get("view") === "taste" || params.get("show") === "picks"
		? "taste"
		: "rate"
}

/** How many more ratings a milestone keeps the taste bar amber, unless the taste view is opened sooner. */
export const MILESTONE_GLOW = 3

/** What the person's ratings add up to: every score they hold, and those that count as liked. */
export interface Tally {
	rated: number
	liked: number
}

export function tally(scores: Iterable<number | null | undefined>): Tally {
	let rated = 0
	let liked = 0
	for (const score of scores) {
		if (score == null) continue
		rated++
		if (isLikedScore(score)) liked++
	}
	return { rated, liked }
}

export const isReady = (t: Tally) => t.liked >= MIN_LIKED

/** "ready": the taste is ready. "picks": MILESTONE_EVERY more ratings since the last milestone. */
export type Milestone = { kind: "ready" | "picks"; rated: number }

export interface FlowState {
	/** The person's totals; null until they are known (guest progress after hydration, a member's data loaded). */
	tally: Tally | null
	/** The rated count at the last milestone, or when the flow found the taste ready already. Null before it's ready. */
	lastMilestoneAt: number | null
	/** The last milestone, until the taste view is opened. Rating goes on while it's marked. */
	milestone: Milestone | null
}

export type FlowAction =
	/** The person's totals, whenever they change. */
	| { type: "tally"; tally: Tally }
	/** The taste view was opened: the milestone has been seen. */
	| { type: "taste-opened" }

export const INITIAL_FLOW: FlowState = {
	tally: null,
	lastMilestoneAt: null,
	milestone: null,
}

export function ratingFlow(state: FlowState, action: FlowAction): FlowState {
	switch (action.type) {
		case "taste-opened":
			return state.milestone ? { ...state, milestone: null } : state
		case "tally": {
			const next = action.tally
			const before = state.tally
			if (before && before.rated === next.rated && before.liked === next.liked)
				return state
			// The first totals are where this visit starts: what was reached before is no milestone now.
			if (!before)
				return {
					tally: next,
					lastMilestoneAt: isReady(next) ? next.rated : null,
					milestone: null,
				}
			if (!isReady(next))
				return { tally: next, lastMilestoneAt: null, milestone: null }
			if (!isReady(before) || state.lastMilestoneAt == null)
				return {
					tally: next,
					lastMilestoneAt: next.rated,
					milestone: { kind: "ready", rated: next.rated },
				}
			if (next.rated >= state.lastMilestoneAt + MILESTONE_EVERY)
				return {
					tally: next,
					lastMilestoneAt: next.rated,
					milestone: { kind: "picks", rated: next.rated },
				}
			return { ...state, tally: next }
		}
	}
}

/** The milestone the taste bar lights for: not seen yet, and fewer than MILESTONE_GLOW ratings old. */
export function litMilestone(state: FlowState): Milestone | null {
	const m = state.milestone
	if (!m || !state.tally) return null
	return state.tally.rated - m.rated < MILESTONE_GLOW ? m : null
}

/** The milestone that landed on the latest rating: the moment the top dots show full before they reset. */
export function justLanded(state: FlowState): Milestone | null {
	const m = state.milestone
	return m && state.tally && m.rated === state.tally.rated ? m : null
}

/**
 * The next milestone and how far along it is, for the top strip's dots, which reset after each one. Before the taste
 * is ready: liked titles toward MIN_LIKED. After: ratings since the last milestone toward MILESTONE_EVERY.
 */
export interface NextStep {
	kind: "liked" | "rated"
	done: number
	of: number
	left: number
}

export function nextStep(t: Tally, lastMilestoneAt: number | null): NextStep {
	if (!isReady(t) || lastMilestoneAt == null) {
		const done = Math.min(t.liked, MIN_LIKED)
		return { kind: "liked", done, of: MIN_LIKED, left: MIN_LIKED - done }
	}
	const done = Math.min(Math.max(0, t.rated - lastMilestoneAt), MILESTONE_EVERY)
	return {
		kind: "rated",
		done,
		of: MILESTONE_EVERY,
		left: MILESTONE_EVERY - done,
	}
}

/** The next step in words: "3 more liked to your taste", "4 more to new picks". */
export const nextStepWords = (s: NextStep) =>
	s.kind === "liked"
		? `${s.left} more liked to your taste`
		: `${s.left} more to new picks`

/** The taste bar's words: its head (amber at a milestone) and the totals under it. */
export function tasteBarWords(t: Tally, lit: Milestone | null) {
	return {
		head:
			lit?.kind === "ready"
				? "Your taste is ready"
				: lit
					? "Your picks changed"
					: "Your taste",
		line: `${t.rated} rated · ${t.liked} liked${isReady(t) ? "" : ` (${LIKED_FROM} or higher)`}`,
	}
}

// ---------------------------------------------------------------------------------------------------------
// The resume bar: after sign-up a member lands back where they were, and a slim bar offers to pick the flow up again.

/** Where a dismissal of the resume bar is remembered, per browser. */
export const RESUME_DISMISSED_KEY = "goodwatch_rating_resume_dismissed"

/** Pages that are the flow already, or hold it (a member's Taste start). */
const ON_FLOW = /^\/taste(\/quiz)?\/?$/

/**
 * Whether to offer the resume bar: a member who has rated something and whose taste isn't ready, on a page other than
 * the flow, who hasn't dismissed it in this browser.
 */
export function offersResume({
	tally: t,
	pathname,
	dismissed,
}: { tally: Tally | null; pathname: string; dismissed: boolean }): boolean {
	return (
		!!t && t.rated > 0 && !isReady(t) && !dismissed && !ON_FLOW.test(pathname)
	)
}

/** The resume bar's sentence, after its bold "Pick up where you left off". */
export const resumeWords = (t: Tally) => nextStepWords(nextStep(t, null))

// ---------------------------------------------------------------------------------------------------------
// Keys: 1-9 score, 0 is 10, H is Haven't seen it, N is Not interested.

export type FlowKey =
	| { type: "score"; score: Score }
	| { type: "unseen" }
	| { type: "not-interested" }

export function readFlowKey(key: string): FlowKey | null {
	if (/^[0-9]$/.test(key))
		return { type: "score", score: (key === "0" ? 10 : Number(key)) as Score }
	if (key === "h" || key === "H") return { type: "unseen" }
	if (key === "n" || key === "N") return { type: "not-interested" }
	return null
}

/**
 * A keydown on the flow: what it asks for, "held" for a held key's repeat (it answers nothing, so a held key can't
 * answer the next title; the page still keeps the key to itself), or null for a key the flow doesn't take, also with a
 * modifier.
 */
export function readFlowPress(
	press: Pick<
		KeyboardEvent,
		"key" | "repeat" | "metaKey" | "ctrlKey" | "altKey"
	>,
): FlowKey | "held" | null {
	if (press.metaKey || press.ctrlKey || press.altKey) return null
	const intent = readFlowKey(press.key)
	if (!intent) return null
	return isRepeatPress(press) ? "held" : intent
}

// ---------------------------------------------------------------------------------------------------------
// "Your ratings": the person's own scores as compact rows, newest first. Never poster cards, so they never read as
// recommendations.

/** Rows shown before "Show all". */
export const RATINGS_SHOWN = 24

export interface RatedEntry {
	key: string
	score: Score
	/** When it was rated, in ms; 0 when unknown. */
	at: number
}

/** Newest first; a title once, with its latest score. */
export function ratingRows(entries: Iterable<RatedEntry>): RatedEntry[] {
	const byKey = new Map<string, RatedEntry>()
	for (const e of entries) {
		const had = byKey.get(e.key)
		if (!had || e.at >= had.at) byKey.set(e.key, e)
	}
	return [...byKey.values()].sort((a, b) => b.at - a.at)
}
