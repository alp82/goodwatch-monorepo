// PROTOTYPE - throwaway. Round 12 (owner, 2026-10-17): a subtle, elegant turn-on, and tracking handing over at once.
import type { Clip } from "../clip"
import { CLIPS as r10c } from "./r10c"
import { BOOT_SOFT_MS, BootSoft } from "./r12/boot"

const tracking = r10c.find((c) => c.id === "tracking-feed-r10")

export const CLIPS: Clip[] = [
	{
		id: "boot-soft",
		section: "boot",
		name: "The TV warms up: soft glow, the wordmark rises in",
		ms: BOOT_SOFT_MS,
		note: "No bright CRT line: a soft amber glow swells from the middle, the wordmark rises in with the TV's G pop and letter reveal, then a slow push-in for the deal into the chat.",
		C: BootSoft,
	},
	// The last card lands at 5.25 s; the next chapter now starts under the crossfade while the closing line settles.
	...(tracking
		? [{ ...tracking, id: "tracking-feed-r12", name: `${tracking.name} (hands over at once)`, ms: 6100 }]
		: []),
]
