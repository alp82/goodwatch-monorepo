// PROTOTYPE - throwaway. Round 11 (owner, 2026-10-17): the TV turning on as the film's first clip, the chat dealing
// in after it, the quiz arriving by the amber wipe, and its tap ripples half as often.
import type { Clip } from "../clip"
import { CLIPS as r10a } from "./r10a"
import { BOOT_TV_MS, BootTv } from "./r11/boot"
import { CloserRipples, QUIZ_MS } from "./r7track/closer"

const chat = r10a.find((c) => c.id === "opener-bubbles-r10")

export const CLIPS: Clip[] = [
	{
		id: "boot-tv",
		section: "boot",
		name: "The TV turns on: light line, GoodWatch boot screen",
		ms: BOOT_TV_MS,
		note: "The TV's own boot: the CRT line opens the picture, the wordmark pops in and pushes in slowly. The chat deals in after it.",
		C: BootTv,
	},
	...(chat
		? [{ ...chat, id: "opener-bubbles-r11", name: `${chat.name} (deals in after the boot)`, enter: "deal" as const }]
		: []),
	{
		id: "closer-ripples-r11",
		section: "closer",
		name: "Your turn: slots fly into the quiz, ripples half as often (amber wipe in)",
		ms: QUIZ_MS,
		enter: "wipe",
		note: "closer-ripples-r7 with a ripple every 2.3 s instead of 1.15 s, arriving by the amber wipe.",
		C: (p) => <CloserRipples {...p} every={2300} />,
	},
]
