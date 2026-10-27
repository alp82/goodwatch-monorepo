// The rating flow: one title at a time on /taste/quiz and in the Taste page's start, and the taste view it opens.
// This file is its pure state: what the person's ratings add up to, when a milestone lands, the words of the top strip,
// the taste bar and the resume bar, the keys, and the rows of "Your ratings". No React and no I/O, so the tests run it
// as it is; `use-rating-flow.ts` binds it to the person's ratings and the save.
//
// Rules (owner, October 27, 2026; docs/design/rating-onboarding/README.md):
// - The taste is ready at the server's rule: MIN_LIKED liked titles, a score of LIKED_FROM or higher
//   (~/domain/taste-rules, shared with server/taste/formula.server.ts).
// - After that a milestone lands at 5, 10, 15 and 20 ratings (MILESTONE_STEPS), then every MILESTONE_EVERY for a
//   member (owner, October 28, 2026). The taste bar turns amber for MILESTONE_GLOW ratings, or until the taste view is
//   opened, and the picks update.
// - A guest's ratings stop at GUEST_RATING_LIMIT until sign-up: the flow shows its locked panel in place of the score
//   control (never the site's limit dialog), and the marks, the taste view and the picks stay. Members are never locked.
// - "Haven't seen it" (don't ask me about this title again) and "Not interested" (don't recommend it) are two marks of
//   their own. Neither is a score, so neither counts as rated.
// - Counts are the person's totals: a member's account, a guest's browser progress. Earlier ratings count too.
import type { Score } from "~/server/scores.server"
import {
	LIKED_FROM,
	MIN_LIKED,
	isLikedScore,
	isRatingLocked,
	nextMilestoneAt,
} from "../../domain/taste-rules.ts"
import type { InteractionType } from "../taste/types.ts"
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

/**
 * "ready": the taste is ready. "picks": the next step of the schedule (~/domain/taste-rules, `nextMilestoneAt`).
 * `of`: the dots the top strip shows full when it lands (MIN_LIKED for "ready", the ratings the step took for "picks").
 */
export type Milestone = { kind: "ready" | "picks"; rated: number; of: number }

export interface FlowState {
	/** The person's totals; null until they are known (guest progress after hydration, a member's data loaded). */
	tally: Tally | null
	/** The rated count at the last milestone, or when the flow found the taste ready already. Null before it's ready. */
	lastMilestoneAt: number | null
	/** The last milestone, until the taste view is opened. Rating goes on while it's marked. */
	milestone: Milestone | null
}

export type FlowAction =
	/** The person's totals, whenever they change. A guest's milestones end at the guest limit; a member's go on. */
	| { type: "tally"; tally: Tally; member: boolean }
	/** The taste view was opened: the milestone has been seen. */
	| { type: "taste-opened" }

export const INITIAL_FLOW: FlowState = {
	tally: null,
	lastMilestoneAt: null,
	milestone: null,
}

/** The last step of the milestone schedule at or below `rated` (0 below the first). */
export function milestoneAtOrBelow(rated: number, member: boolean): number {
	let last = 0
	for (
		let at = nextMilestoneAt(0, member);
		at != null && at <= rated;
		at = nextMilestoneAt(at, member)
	)
		last = at
	return last
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
					milestone: { kind: "ready", rated: next.rated, of: MIN_LIKED },
				}
			// Fewer ratings than the last milestone (a score cleared): it is taken back. The glow ends, the strip steps
			// back to the milestone before, and reaching the count again lands it again.
			if (next.rated < state.lastMilestoneAt)
				return {
					tally: next,
					lastMilestoneAt: milestoneAtOrBelow(next.rated, action.member),
					milestone: null,
				}
			const at = nextMilestoneAt(state.lastMilestoneAt, action.member)
			if (at != null && next.rated >= at)
				return {
					tally: next,
					lastMilestoneAt: next.rated,
					milestone: {
						kind: "picks",
						rated: next.rated,
						of: at - state.lastMilestoneAt,
					},
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
 * is ready: liked titles toward MIN_LIKED. After: ratings since the last milestone toward the next one of the schedule.
 * "done": there is no next one (a guest at the limit, whose picks are as good as they get before sign-up).
 */
export interface NextStep {
	kind: "liked" | "rated" | "done"
	done: number
	of: number
	left: number
}

/** `member` matters only once a milestone has passed: a guest's last one is at the guest limit. */
export function nextStep(
	t: Tally,
	lastMilestoneAt: number | null,
	member = false,
): NextStep {
	if (!isReady(t) || lastMilestoneAt == null) {
		const done = Math.min(t.liked, MIN_LIKED)
		return { kind: "liked", done, of: MIN_LIKED, left: MIN_LIKED - done }
	}
	const at = nextMilestoneAt(lastMilestoneAt, member)
	if (at == null) return { kind: "done", done: 0, of: 0, left: 0 }
	const of = at - lastMilestoneAt
	const done = Math.min(Math.max(0, t.rated - lastMilestoneAt), of)
	return { kind: "rated", done, of, left: of - done }
}

/** The next step in words: "3 more liked to your taste", "4 more to new picks", "Your picks are ready". */
export const nextStepWords = (s: NextStep) =>
	s.kind === "liked"
		? `${s.left} more liked to your taste`
		: s.kind === "done"
			? "Your picks are ready"
			: `${s.left} more to new picks`

/** Whether the person's next rating waits for sign-up (~/domain/taste-rules): a guest at the limit. */
export const isLocked = (t: Tally | null, member: boolean) =>
	!!t && isRatingLocked(t.rated, member)

/** Ratings from which a guest sees the quiet sign-up line under the taste bar ("only on value"). */
export const SIGN_UP_LINE_FROM = 5

/** Whether the quiet sign-up line shows: a guest with SIGN_UP_LINE_FROM ratings, until the locked panel says it. */
export const showsSignUpLine = (t: Tally | null, member: boolean) =>
	!member && !!t && t.rated >= SIGN_UP_LINE_FROM && !isLocked(t, member)

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

/**
 * After "Haven't seen it" the two marks become the Want to See question (parts.tsx, `WantToSee`): "yes" saves Haven't
 * seen it with Want to See, "no" saves Haven't seen it alone, "back" returns to the marks and saves nothing. Its keys:
 * Y or W, N, Escape or Backspace. Any other key, a modifier, or a held key's repeat: null, so the page treats it as it
 * would without the question.
 */
export type WantKey = "yes" | "no" | "back"

export function readWantPress(
	press: Pick<
		KeyboardEvent,
		"key" | "repeat" | "metaKey" | "ctrlKey" | "altKey"
	>,
): WantKey | null {
	if (press.metaKey || press.ctrlKey || press.altKey || isRepeatPress(press))
		return null
	const key = press.key.toLowerCase()
	if (key === "y" || key === "w") return "yes"
	if (key === "n") return "no"
	if (key === "escape" || key === "backspace") return "back"
	return null
}

/** How soon after the Want to See question appears a press counts: earlier ones are the tail of the first press. */
export const WANT_GUARD_MS = 400

/**
 * Whether a press on the Want to See question counts: not within WANT_GUARD_MS of it appearing, and not the second
 * click of a double click (`detail` counts the clicks; 0 for a key press on a button).
 */
export const takesWantPress = (shownAt: number, now: number, detail: number) =>
	shownAt > 0 && now - shownAt >= WANT_GUARD_MS && detail <= 1

// ---------------------------------------------------------------------------------------------------------
// The top row's last answers: the newest few, tapping one opens its title again to change or clear the answer.

/** Answers the top row shows (two under 420 px). */
export const LAST_ANSWERED = 3

export interface Answer {
	media_type: string
	tmdb_id: number
	type: InteractionType
	score?: number
	timestamp: number
}

/** The newest answers whose titles are known (`known` has their key), newest first, each title once. */
export function lastAnswered<T extends Answer>(
	answers: Iterable<T>,
	known: { has: (key: string) => boolean },
	count = LAST_ANSWERED,
): T[] {
	const byKey = new Map<string, T>()
	for (const a of answers) {
		const key = `${a.media_type}-${a.tmdb_id}`
		const had = byKey.get(key)
		if (known.has(key) && (!had || a.timestamp >= had.timestamp))
			byKey.set(key, a)
	}
	return [...byKey.values()]
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, count)
}

/** An answer in a few words, as the top row's posters name it: "Scored 8", "Want to See". */
export function answerWords(a: Pick<Answer, "type" | "score">): string {
	if (a.type === "score") return `Scored ${a.score}`
	if (a.type === "skip") return "Haven't seen it"
	if (a.type === "plan") return "Want to See"
	return "Not interested"
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
