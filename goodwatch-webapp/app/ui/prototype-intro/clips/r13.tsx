// PROTOTYPE - throwaway. Round 13 (owner, 2026-10-17): the chosen boot.
import type { Clip } from "../clip"
import { BOOT_FINAL_MS, BootGStandby } from "./r13/boot"

export const CLIPS: Clip[] = [
	{
		id: "boot-g-standby",
		section: "boot",
		name: "The G turns in, the amber arc sweeps, the standby light breathes",
		ms: BOOT_FINAL_MS,
		note: "Owner's pick: boot-g with boot-standby's light during the arc. Also the start page's CSS boot.",
		C: () => <BootGStandby />,
	},
]
