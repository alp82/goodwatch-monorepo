// PROTOTYPE - throwaway (prototype/explore-r5). Wraps a mood-page variant for the "other" slot: a theme's or style's
// place renders with it, every other page of the slot as in round 4.
import type { Note } from "../../../../kit/contract"
import type { PageViewProps, SlotVariant } from "../../contract"
import type { MoodPageData } from "../mood/page.server"
import type { MoodLikeData } from "./mood-like.server"
import { variant as r4 } from "./r4"

export function moodLike(mood: SlotVariant<MoodPageData>): SlotVariant<MoodLikeData> {
	const Mood = mood.View
	const R4 = r4.View
	return {
		id: mood.id,
		name: mood.name,
		what: `${mood.what} (Theme and style places; the index pages and traits stay round 4.)`,
		order: mood.order,
		View: (props: PageViewProps<MoodLikeData>) =>
			props.data.like === "mood" ? (
				<Mood {...props} data={props.data.page} />
			) : (
				<R4 {...props} data={props.data.page} />
			),
		notes: (props): Note[] =>
			props.data.like === "mood"
				? (mood.notes?.({ ...props, data: props.data.page }) ?? [])
				: (r4.notes?.({ ...props, data: props.data.page }) ?? []),
	}
}
