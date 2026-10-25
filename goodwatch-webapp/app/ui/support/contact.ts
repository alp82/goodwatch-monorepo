// The contact form on /support (#764): its topics, the checks before sending, the request it sends to
// POST /api/feedback (kind `contact`, docs/implementation/feedback/README.md), and how a refusal reads.
// No React here, so node:test covers it (contact.test.ts).
import { z } from "zod"
import type { FeedbackRequest } from "~/utils/feedback"

export const SUPPORT_EMAIL = "hello@goodwatch.app"

export const CONTACT_TOPICS = [
	{ id: "account", label: "My account" },
	{ id: "data", label: "A title's data" },
	{ id: "bug", label: "Something's broken" },
	{ id: "idea", label: "An idea" },
	{ id: "ai", label: "AI apps" },
	{ id: "other", label: "Something else" },
] as const
export type ContactTopic = (typeof CONTACT_TOPICS)[number]["id"]

export const topicLabel = (topic: ContactTopic) =>
	CONTACT_TOPICS.find((t) => t.id === topic)?.label ?? topic

/** The endpoint refuses a report sent sooner than this after the form opened. */
export const MIN_FILL_MS = 2000
export const MESSAGE_MAX = 8000
export const TITLE_MAX = 500
const EMAIL_MAX = 254

export interface ContactDraft {
	topic: ContactTopic
	message: string
	email: string
	/** Only for the "A title's data" topic: the title's link or name. */
	title: string
}

export type ContactProblem = "message" | "email"

// Match the endpoint's email validation.
const EMAIL = z.string().email().max(EMAIL_MAX)

/** What stops the draft from being sent, in the order the fields appear. */
export function contactProblems(draft: ContactDraft): ContactProblem[] {
	const problems: ContactProblem[] = []
	const message = draft.message.trim()
	if (!message || message.length > MESSAGE_MAX) problems.push("message")
	const email = draft.email.trim()
	if (!EMAIL.safeParse(email).success) problems.push("email")
	return problems
}

/**
 * The request body. The topic and, for data questions, the title go at the top of the message, so staff see them in
 * the Discord post and the email without new fields on the endpoint.
 */
export function buildContactRequest(
	draft: ContactDraft,
	context: {
		idempotencyKey: string
		startedAt: number
		website?: string
		metadata?: FeedbackRequest["metadata"]
	},
): FeedbackRequest {
	const lines = [`Topic: ${topicLabel(draft.topic)}`]
	const title = draft.title.trim().slice(0, TITLE_MAX)
	if (draft.topic === "data" && title) lines.push(`Title: ${title}`)
	return {
		kind: "contact",
		message: `${lines.join("\n")}\n\n${draft.message.trim()}`,
		email: draft.email.trim(),
		idempotencyKey: context.idempotencyKey,
		website: context.website ?? "",
		startedAt: context.startedAt,
		...(context.metadata ? { metadata: context.metadata } : {}),
	}
}

/** How long to hold a send so that it doesn't arrive before the endpoint's minimum time. */
export const holdBeforeSend = (startedAt: number, now: number) =>
	Math.max(0, startedAt + MIN_FILL_MS - now)

export type ContactFailure = "busy" | "rejected" | "retry"

/**
 * - busy: too many messages from this address or account (429). Trying again soon won't help.
 * - rejected: the endpoint refused the content (400, 413, 415). Usually the email address.
 * - retry: anything else, including no answer at all (status 0). The same message can be sent again.
 */
export function contactFailure(status: number): ContactFailure {
	if (status === 429) return "busy"
	if (status === 400 || status === 413 || status === 415) return "rejected"
	return "retry"
}

/** A v4 UUID, also where crypto.randomUUID is missing (it needs a secure context). */
export function newIdempotencyKey(source: {
	randomUUID?: () => string
	getRandomValues(array: Uint8Array): Uint8Array
}): string {
	if (typeof source.randomUUID === "function") return source.randomUUID()
	const bytes = source.getRandomValues(new Uint8Array(16))
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
