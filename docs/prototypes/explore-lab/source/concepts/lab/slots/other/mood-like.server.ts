// PROTOTYPE - throwaway (prototype/explore-r5). The "other" slot renders themes, styles and traits, their index pages
// and their places. Only a theme's or style's place is like a mood's page; the rest loads as in round 4.
import type { SlotLoader } from "../../contract"
import { load as moodLoad, type MoodPageData } from "../mood/page.server"
import { type OtherData, load as r4Load } from "./r4.server"

export type MoodLikeData = { like: "mood"; page: MoodPageData } | { like: "r4"; page: OtherData }

export const load: SlotLoader<MoodLikeData> = async (args) => {
	const family = args.address.parts[0]?.family
	return args.address.view === "place" && (family === "theme" || family === "style")
		? { like: "mood", page: await moodLoad(args) }
		: { like: "r4", page: await r4Load(args) }
}
