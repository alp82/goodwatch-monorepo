// PROTOTYPE - throwaway (prototype/explore-r7, slot "blend"). A blend is a mood page with more parts: the same grid
// first, the same steering beside it, the title as the blend (each part underlined, click to swap or take out, Add for
// one more), and the room's sections that fit a blend under it. The owner: "blends should always lead to the
// mood/genre grid view with sections below that are properly fitting".
import type { SlotVariant } from "../../contract"
import { variant as mood } from "../mood/grid-first"
import type { MoodPageData } from "../mood/page.server"

export const variant: SlotVariant<MoodPageData> = {
	...mood,
	id: "grid",
	name: "Grid first",
	what: "The blend as a mood page: the title is the blend (swap or take out a part, Add one more), the steering beside a grid that fills one screen, and the sections a blend has under it.",
	order: 1,
}
