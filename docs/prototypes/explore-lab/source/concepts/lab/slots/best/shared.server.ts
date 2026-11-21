// PROTOTYPE - throwaway (prototype/explore-r5). What the new Best variants add to the Dials Best data. Read-only.
import type { DialsData } from "../../../dials/loader.server"
import { dialsLoad } from "../../baselines.server"
import type { SlotLoader } from "../../contract"

export type BestData = Extract<DialsData, { view: "best" }>

/** The Dials Best page's data: the ranking with every source's score, the filter menus and the dials. */
export const loadBest: SlotLoader<BestData> = async (args) => {
	const d = await dialsLoad(args)
	if (d.view !== "best") throw new Response("Not a Best page", { status: 404 })
	return d
}
