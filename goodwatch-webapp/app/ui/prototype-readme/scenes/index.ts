// PROTOTYPE (README pictures, 2026-10-26): the README's feature pictures and clips, one component per scene.
// Each scene fills the 1440x770 stage (the intro's picture shape) and is shown alone at /prototype/readme/<name>.
// Add a scene: write <name>.tsx in this folder exporting a component, then register it here.
import type { ComponentType } from "react"
import type { IntroData } from "~/ui/living-room/intro/scene"
import { OneScore } from "~/ui/living-room/intro/scenes/one-score"
import { ReadmeAi } from "./ai"
import { ReadmeDiscord } from "./discord"
import { ReadmeDiscover } from "./discover"
import { ReadmeImports } from "./imports"
import { ReadmeScore } from "./score"
import { ReadmeTracking } from "./tracking"
import { TasteLoop } from "./taste"

export type ReadmeScene = { C: ComponentType<{ data: IntroData }>; note: string }

export const SCENES: Record<string, ReadmeScene> = {
	// The intro's own score scene, as a harness check.
	"intro-score": { C: OneScore, note: "the intro scene as is" },
	score: { C: ReadmeScore, note: "five source cards in an arc above the big GoodWatch ring" },
	discover: { C: ReadmeDiscover, note: "filters final frame, no heading; shoot with ?pause=20000" },
	tracking: { C: ReadmeTracking, note: "four alert cards, 2x2; crop to 1440x640" },
	imports: { C: ReadmeImports, note: "loop: sources stream into the G, picks still; record with scenes/record.mjs" },
	taste: { C: TasteLoop, note: "loop: the pointer goes around the fingerprint, picks follow; record with .github/readme/scenes/taste-record.mjs" },
	ai: { C: ReadmeAi, note: "loop: a ChatGPT conversation with GoodWatch, no heading; record with scenes/record.mjs" },
	discord: { C: ReadmeDiscord, note: "loop: a quick /together round in #movie-night; record with scenes/record.mjs" },
}
