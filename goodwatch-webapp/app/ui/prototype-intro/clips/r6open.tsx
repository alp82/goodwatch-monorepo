// PROTOTYPE - throwaway. Round 6 intro clips, group "r6open": chapter 1, the problem. A native-looking chat where
// every title gets turned down, the evening passing quietly, then the endless wall: "Deciding is hard."
// Refines round 5's opener-clock (owner, round 6: no analog clock, a more native chat, "Deciding is hard").
import type { Clip } from "../clip"
import { OpenerDim, OpenerReceipts, OpenerThread } from "./r6open/scenes"
import "./r6open.css"

export const CLIPS: Clip[] = [
	{
		id: "opener-thread",
		section: "opener",
		name: "Chat with time separators, then the wall",
		ms: 10000,
		note: "A messaging app's thread: suggestions as link previews, typing dots, turned down. The evening shows only in the chat's own separators (8:02, 9:14, 10:47 PM) and 'Read'. The chat steps back as the wall rises.",
		C: OpenerThread,
	},
	{
		id: "opener-dim",
		section: "opener",
		name: "Status-bar clock, light dropping, chat shrinks into the wall",
		ms: 10000,
		note: "The same chat with a small status-bar clock ticking from 8:02 to 10:52 while the screen slowly dims. Then the chat shrinks back into the wall: one screen among endless others.",
		C: OpenerDim,
	},
	{
		id: "opener-receipts",
		section: "opener",
		name: "A time under every message, then scroll into the wall",
		ms: 10000,
		note: "Each message carries its own small time, so the gaps tell the story. The thumb keeps scrolling: the chat goes up and out and the wall comes up in the same motion.",
		C: OpenerReceipts,
	},
]
