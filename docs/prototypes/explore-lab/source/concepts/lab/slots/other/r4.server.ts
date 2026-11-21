// PROTOTYPE - throwaway (prototype/explore-r5). Trait pages come from Dials, theme and style pages from Rooms.
import type { DialsData } from "../../../dials/loader.server"
import type { RoomsData } from "../../../rooms/loader.server"
import { dialsLoad, roomsLoad } from "../../baselines.server"
import type { SlotLoader } from "../../contract"

export type OtherData = { from: "dials"; page: DialsData } | { from: "rooms"; page: RoomsData }

export const load: SlotLoader<OtherData> = async (args) => {
	const family = args.address.family ?? args.address.parts[0]?.family
	return family === "trait"
		? { from: "dials", page: await dialsLoad(args) }
		: { from: "rooms", page: await roomsLoad(args) }
}
