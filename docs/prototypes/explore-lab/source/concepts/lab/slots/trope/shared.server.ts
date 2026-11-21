// PROTOTYPE - throwaway (prototype/explore-r6). Every trope page variant loads the same data (../tropes/model.server.ts).
import type { SlotLoader } from "../../contract"
import type { TropePageData } from "../tropes/model"
import { loadTrope } from "../tropes/model.server"

export const load: SlotLoader<TropePageData | null> = ({ kit, address }) => {
	const slug = address.parts.find((p) => p.family === "trope")?.slug
	return slug ? loadTrope(kit, slug) : Promise.resolve(null)
}
