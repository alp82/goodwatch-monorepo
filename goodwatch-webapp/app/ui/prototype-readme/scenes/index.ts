// PROTOTYPE (README pictures, 2026-10-26): the README's feature pictures and clips, one component per scene.
// Each scene fills the 1440x770 stage (the intro's picture shape) and is shown alone at /prototype/readme/<name>.
// Add a scene: write <name>.tsx in this folder exporting a component, then register it here.
import type { ComponentType } from "react"
import type { IntroData } from "~/ui/living-room/intro/scene"
import { OneScore } from "~/ui/living-room/intro/scenes/one-score"

export type ReadmeScene = { C: ComponentType<{ data: IntroData }>; note: string }

export const SCENES: Record<string, ReadmeScene> = {
	// The intro's own score scene, as a harness check.
	"intro-score": { C: OneScore, note: "the intro scene as is" },
}
