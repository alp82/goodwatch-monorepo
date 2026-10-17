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

/** Compact details by default; episode paging never pages watch history. */
export const titleDetails = selected
	.safeExtend({
		include: z
			.array(z.enum(["cast", "scores", "analysis", "seasons", "episodes"]))
			.max(5)
			.default(["cast", "scores", "analysis"]),
		season_number: z
			.number()
			.int()
			.min(-1)
			.max(10000)
			.optional()
			.describe(
				"Displayed season: 0 for Specials; -1 for Additional episodes in a reviewed presentation.",
			),
		episode_cursor: paging.cursor,
		episode_limit: z.number().int().min(1).max(50).default(20),
	})
	.refine(
		(value) =>
			value.include.includes("episodes") ||
			(value.season_number === undefined &&
				value.episode_cursor === undefined &&
				value.episode_limit === 20),
		"Episode filters and paging require include=episodes",
	)

export const similarTitles = selected.safeExtend({
	...paging,
	limit: z.number().int().min(1).max(40).default(40),
	for_you: z.boolean().default(true),
	exclude_seen: z.boolean().default(false),
	kind: z.enum(["all", "movie", "show"]).default("all"),
})
