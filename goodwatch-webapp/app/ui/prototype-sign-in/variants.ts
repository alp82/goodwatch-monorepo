// PROTOTYPE - throwaway. The /sign-in redesign variants, keyed by ?variant=.
// Round 1 also had wall, dome, deck, orbit, and the random/ripple/focus spotlights (files kept here, out of the
// switcher). The owner picked the spotlight with trail flips, the aurora border, and the deal flip; round 2 varies how
// prominent the GoodWatch brand and the sign-in form are.
import type { JSX } from "react"
import { Spotlight } from "./Spotlight"
import type { VariantProps } from "./types"

type Layout = Parameters<typeof Spotlight>[0]["layout"]
const trail = (layout: Layout) => (p: VariantProps) => Spotlight({ ...p, mode: "trail", layout })

// Round 2 (brand layouts) and round 3 (reveal, emblem-here, title-card, poster) stay in Spotlight.tsx, out of the
// switcher. The owner kept the round 1 trail layout, with the branded wordmark heading the card.
export const VARIANTS: Record<string, { name: string; View: (p: VariantProps) => JSX.Element }> = {
	"spotlight-trail": { name: "Spotlight trail + wordmark", View: trail("classic") },
	current: { name: "Current page", View: () => null as unknown as JSX.Element },
}
