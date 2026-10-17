// PROTOTYPE - throwaway. Round 12 turn-on variants (owner, 2026-10-17: "make it more subtle and elegant", choose from
// several). Beside r12's boot-soft. Each holds the wordmark at the end for the deal into the chat.
import type { Clip } from "../clip"
import { BOOT_MS, BootG, BootIris, BootLetters, BootStandby } from "./r12boot/boots"

const CSS_ONLY = "CSS only (static markup, no script): could also be the start page's boot, painted before hydration."

export const CLIPS: Clip[] = [
	{
		id: "boot-standby",
		section: "boot",
		name: "Standby light breathes, the picture warms up from it",
		ms: BOOT_MS.standby,
		note: `The TV's amber standby dot breathes twice at the bottom, a warm glow rises from it, the wordmark resolves. ${CSS_ONLY}`,
		C: BootStandby,
	},
	{
		id: "boot-iris",
		section: "boot",
		name: "A soft iris opens onto warm light and the wordmark",
		ms: BOOT_MS.iris,
		note: `A dark vignette with a long soft edge opens from the middle onto a warm gradient as the wordmark rises in. ${CSS_ONLY}`,
		C: BootIris,
	},
	{
		id: "boot-g",
		section: "boot",
		name: "The G turns in, an amber arc sweeps it, the name slides out",
		ms: BOOT_MS.g,
		note: `The G emblem turns in alone while a thin amber arc sweeps once around it; "oodWatch" then slides out from behind the G. ${CSS_ONLY}`,
		C: BootG,
	},
	{
		id: "boot-letters",
		section: "boot",
		name: "The letters settle in, one by one, over a warm horizon",
		ms: BOOT_MS.letters,
		note: `The G, then each letter fades up with a slight rise while the spacing tightens, over a faint warm horizon glow. ${CSS_ONLY}`,
		C: BootLetters,
	},
]
