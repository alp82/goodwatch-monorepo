import * as z from "zod4"
export const paging = {
	cursor: z
		.string()
		.regex(/^offset:[0-9]{1,8}$/)
		.optional(),
	limit: z.number().int().min(1).max(20).default(20),
}
const selector = {
	title_id: z
		.string()
		.regex(/^(movie|show):[1-9]\d{0,9}$/)
		.optional(),
	title_name: z.string().trim().min(2).max(120).optional(),
	year: z.number().int().min(1800).max(2100).optional(),
}
export const selected = z
	.object(selector)
	.strict()
	.refine(
		(value) => Boolean(value.title_id) !== Boolean(value.title_name),
		"Exactly one title_id or title_name is required",
	)
