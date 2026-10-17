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

export const writeSelected = z
	.object({
		...selector,
		title_id: selector.title_id.describe(
			"Use this ID when available; it takes precedence over title_name and year.",
		),
		title_name: selector.title_name.describe(
			"Required only without title_id. Ignored when an ID is supplied.",
		),
		year: selector.year.describe(
			"Optional name disambiguation, used only without title_id.",
		),
	})
	.strict()
	.refine(
		(value) => Boolean(value.title_id || value.title_name),
		"Provide title_id, or title_name with an optional year. When title_id is present it takes precedence.",
	)
