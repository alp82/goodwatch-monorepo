import { hasValidMediaPresentation } from "../../utils/media-presentation.ts"
/** Keep navigation/filter state, but don't restore media labels from another display language. */
export function explorationForLanguage<
	T extends {
		titles?: { presentation?: { language: string } }[]
		ratingQueue?: { presentation?: { language: string } }[]
		selectedMedia?: { presentation?: { language: string } } | null
	},
>(value: T, language: string): T {
	const source =
		value.selectedMedia?.presentation?.language ??
		value.ratingQueue?.[0]?.presentation?.language ??
		value.titles?.[0]?.presentation?.language ??
		"en"
	const displayed = [
		...(value.titles ?? []),
		...(value.ratingQueue ?? []),
		...(value.selectedMedia ? [value.selectedMedia] : []),
	]
	if (
		source === language &&
		displayed.every(
			(row) => !row.presentation || hasValidMediaPresentation(row, language),
		)
	)
		return value
	return {
		...value,
		titles: undefined,
		ratingQueue: undefined,
		selectedMedia: null,
	}
}
