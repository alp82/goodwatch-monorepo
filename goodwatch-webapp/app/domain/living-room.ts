import type { LivingRoomTitle } from "~/ui/living-room/living-room-data"

export interface LivingRoomPicks {
	titles: LivingRoomTitle[]
	pickKeys: string[]
	source: "wishlist" | "new"
}
