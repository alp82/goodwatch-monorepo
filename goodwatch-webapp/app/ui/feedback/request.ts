// The requests the Feedback tab sends to POST /api/feedback: a fix mode report (docs/implementation/feedback/
// fix-mode-contract.md) and a message from Send feedback. No React here, so node:test covers it (request.test.ts).
import type { FeedbackOutcome, FeedbackRequest } from "~/utils/feedback"
import type { Report } from "./problems"

export type Envelope = {
	idempotencyKey: string
	startedAt: number
	/** The honeypot: empty from a person. */
	website?: string
	/** A guest's email, if they left one; members get answers at their account's. */
	email?: string
	metadata?: FeedbackRequest["metadata"]
}

const MESSAGE_MAX = 10000
const NOTE_MAX = 2000
const VALUE_MAX = 4000
const SHORT = 50
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LINK = /^https?:\/\/[^\s/]+\.[^\s]+$/i

/** A guest's email is sent only when it looks like one; a typed-but-wrong one stops Send (see `emailProblem`). */
export const emailProblem = (email: string) =>
	email.trim() !== "" && !EMAIL.test(email.trim())
/** A source link must be a whole web address. */
export const linkProblem = (link: string) =>
	link.trim() !== "" && !LINK.test(link.trim())

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s)

/** "Wrong character name: Jeremy Allen White as Carmy. Should be: Carmen Berzatto. Note: …" */
export function summaryOf(r: Report): string {
	const parts = [r.currentValue ? `${r.label}: ${r.currentValue}` : r.label]
	if (r.suggestedValue && r.suggestedValue !== "Remove")
		parts.push(`Should be: ${r.suggestedValue}`)
	if (r.suggestedValue === "Remove") parts.push("Take it off")
	if (r.note) parts.push(r.note)
	return clip(parts.join(". "), MESSAGE_MAX)
}

function common(e: Envelope) {
	const email = e.email?.trim()
	return {
		idempotencyKey: e.idempotencyKey,
		website: e.website ?? "",
		startedAt: e.startedAt,
		...(email && EMAIL.test(email) ? { email } : {}),
		...(e.metadata ? { metadata: e.metadata } : {}),
	}
}

/**
 * A fix mode report. On a title or person page it's a `data` report about that title or person; elsewhere there is
 * no title to name, so it goes as a `bug` report whose message names the page part and the problem.
 */
export function buildReportRequest(r: Report, e: Envelope): FeedbackRequest {
	if (!r.subject)
		return {
			kind: "bug",
			message: clip(
				[`Page part: ${r.area}`, `Problem: ${r.label} (${r.problem})`, r.note]
					.filter(Boolean)
					.join("\n"),
				MESSAGE_MAX,
			),
			...common(e),
		}
	const link = r.sourceLink?.trim()
	return {
		kind: "data",
		message: summaryOf(r),
		...common(e),
		data: {
			entityKind: r.subject.entityKind,
			entityName: clip(r.subject.entityName, 200),
			ids: r.subject.ids,
			field: clip(r.field, 200),
			...(r.currentValue !== undefined
				? { currentValue: clip(r.currentValue, VALUE_MAX) }
				: {}),
			...(r.suggestedValue !== undefined
				? { suggestedValue: clip(r.suggestedValue, VALUE_MAX) }
				: {}),
			...(link && LINK.test(link) ? { sourceLink: link } : {}),
			...(r.country ? { country: r.country } : {}),
			...(r.providerIds?.length ? { providerIds: r.providerIds } : {}),
			area: clip(r.area, SHORT),
			problem: clip(r.problem, SHORT),
			...(r.target ? { target: r.target } : {}),
			...(r.note ? { note: clip(r.note, NOTE_MAX) } : {}),
		},
	}
}

/** Send feedback: one message, a bug or an idea, with an optional screenshot (raw base64). */
export function buildMessageRequest(
	m: { kind: "bug" | "idea"; message: string; screenshot?: string | null },
	e: Envelope,
): FeedbackRequest {
	return {
		kind: m.kind,
		message: clip(m.message.trim(), MESSAGE_MAX),
		...common(e),
		...(m.screenshot ? { screenshot: m.screenshot } : {}),
	}
}

/** Until the server says otherwise, a fix is waiting for staff and a flag is a flag. */
export const fallbackOutcome = (
	kind: Report["kind"],
): Exclude<FeedbackOutcome, "live"> => (kind === "flag" ? "flag" : "pending")

export const OUTCOME_COPY: Record<
	FeedbackOutcome,
	{ title: string; body: string }
> = {
	live: {
		title: "Fixed. Thanks!",
		body: "Your change is on the page now. Staff can see it, and you can undo it.",
	},
	pending: {
		title: "Thanks, we'll review it",
		body: "Someone on the team checks it, usually within a few days.",
	},
	flag: {
		title: "Thanks, we'll take a look",
		body: "This part isn't edited by hand. We check the source and fix the match.",
	},
}

export type SendFailure = "busy" | "rejected" | "retry"

/** 429: too many from here; 400, 413, 415: the endpoint refused the content; anything else: try again. */
export function sendFailure(status: number): SendFailure {
	if (status === 429) return "busy"
	if (status === 400 || status === 413 || status === 415) return "rejected"
	return "retry"
}

export const FAILURE_COPY: Record<SendFailure, string> = {
	busy: "Too many reports from here just now. Try again in a while.",
	rejected: "We couldn't take this one. Check the email address and the link.",
	retry: "It didn't go through. Try again.",
}
