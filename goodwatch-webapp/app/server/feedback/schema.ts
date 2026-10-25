import { z } from "zod"
export const FEEDBACK_STATUSES = [
	"new",
	"in_progress",
	"done",
	"wont_fix",
	"duplicate",
] as const
export const feedbackStatusSchema = z.enum(FEEDBACK_STATUSES)
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>

const text = z.string().max(200)
const value = z.union([
	z.string().max(4000),
	z.number().finite(),
	z.boolean(),
	z.null(),
])
export const feedbackSchema = z
	.object({
		kind: z.enum(["bug", "idea", "data", "contact"]),
		message: z.string().trim().min(1).max(10000),
		email: z.string().email().max(254).optional(),
		idempotencyKey: z.string().uuid(),
		website: z.string().max(200),
		startedAt: z.number().int().positive(),
		data: z
			.object({
				entityKind: z.enum(["movie", "show", "season", "episode", "person"]),
				/** The title or person name as the page shows it, for the staff post. Not part of the dedupe key. */
				entityName: z.string().trim().min(1).max(200).optional(),
				ids: z
					.record(
						z.string().max(50),
						z.union([z.string().max(100), z.number().int().nonnegative()]),
					)
					.refine(
						(v) => Object.keys(v).length > 0 && Object.keys(v).length <= 12,
					),
				field: text.min(1),
				currentValue: value.optional(),
				suggestedValue: value.optional(),
				sourceLink: z
					.string()
					.url()
					.max(2000)
					.refine((v) => /^https?:\/\//i.test(v))
					.optional(),
				country: z
					.string()
					.regex(/^[A-Z]{2}$/)
					.optional(),
				providerIds: z.array(z.number().int().positive()).max(50).optional(),
			})
			.strict()
			.optional(),
		metadata: z
			.object({
				url: z.string().max(4000).optional(),
				routeId: text.optional(),
				viewport: z
					.object({
						width: z.number().int().positive().max(20000),
						height: z.number().int().positive().max(20000),
					})
					.strict()
					.optional(),
				dpr: z.number().positive().max(10).optional(),
				locale: z.string().max(50).optional(),
				colorScheme: z.enum(["light", "dark"]).optional(),
				time: z.string().datetime().optional(),
				sentryReplayId: z
					.string()
					.regex(/^[a-f0-9-]{32,36}$/i)
					.optional(),
			})
			.strict()
			.optional(),
		screenshot: z
			.string()
			.max(2796204)
			.regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
			.optional(),
	})
	.strict()
	.superRefine((v, ctx) => {
		if (v.kind === "contact" && !v.email)
			ctx.addIssue({ code: "custom", message: "Contact email required" })
		if ((v.kind === "data") !== Boolean(v.data))
			ctx.addIssue({
				code: "custom",
				message: "Data payload required only for data reports",
			})
	})
export type FeedbackInput = z.infer<typeof feedbackSchema>
/** Store only local path/query; never credentials, fragments or secret query parameters. */
export function safePath(value: string): string {
	try {
		const url = new URL(value, "https://goodwatch.app")
		for (const key of [...url.searchParams.keys()])
			if (
				/key|token|secret|code|state|auth|password|credential|session/i.test(
					key,
				)
			)
				url.searchParams.delete(key)
		return `${url.pathname}${url.search}`.slice(0, 2000)
	} catch {
		return ""
	}
}
/** Discord display text has no links, mentions, email addresses or Markdown. */
export function display(value: string, max = 1500): string {
	return value
		.replace(/https?:\/\/\S+|www\.\S+/gi, "")
		.replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, "[email]")
		.replace(/<[^>]*>|@\S+/g, "")
		.replace(/[*_~`\[\]()<>#|\\]/g, "")
		.replace(/[\u0000-\u001f]/g, " ")
		.trim()
		.slice(0, max)
}
