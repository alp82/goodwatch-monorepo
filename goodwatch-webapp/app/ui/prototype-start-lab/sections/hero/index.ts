// PROTOTYPE (start page lab): the "hero" section's variants, in bar order: the guest's search hero.
import type { BlockVariant } from "../../lab/types"
import { AskRoomHero } from "./ask-room"
import { ChipsHero } from "./chips"
import { ConversationHero } from "./conversation"
import { RotatingHero } from "./rotating"

export const VARIANTS: BlockVariant[] = [
	{ key: "a", name: "Rotating prompts", C: RotatingHero },
	{ key: "b", name: "Mood chips", C: ChipsHero },
	{ key: "c", name: "Conversation", C: ConversationHero },
	{ key: "d", name: "Ask the room (bolder)", C: AskRoomHero },
]
