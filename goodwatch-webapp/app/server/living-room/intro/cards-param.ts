// The `cards` parameter of /api/intro: "movie:603,show:1396" as title keys, at most MAX_CARDS; anything else is left
// out. No imports with side effects, so a test can read it.
import { type TitleKey, titleKey } from "../../../utils/title-key.ts"

/** At most this many titles per `cards` request (the quiz asks for ten). */
export const MAX_CARDS = 10

export const parseCardsParam = (value: string): TitleKey[] =>
	value
		.split(",")
		.flatMap((part) => {
			const match = /^(movie|show):(\d{1,9})$/.exec(part.trim())
			return match
				? [titleKey(match[1] as "movie" | "show", Number(match[2]))]
				: []
		})
		.slice(0, MAX_CARDS)
