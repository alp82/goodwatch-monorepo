// PROTOTYPE - throwaway. The six start-page variants for /prototype/rec-home (#178). "existing" variants rearrange
// today's components and the settled prototype pieces; "bolder" ones reach further visually.
import type { WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import type { Home } from "./model"
import { GuidedVariant } from "./v-guided"
import { HeroVariant } from "./v-hero"
import { MagazineVariant } from "./v-magazine"
import { PicksVariant } from "./v-picks"
import { SplitVariant } from "./v-split"
import { TonightVariant } from "./v-tonight"

export type Variant = { name: string; style: "existing" | "bolder"; View: (p: { h: Home; onOpen: (t: WTitle) => void }) => JSX.Element }

export const VARIANTS: Record<string, Variant> = {
	hero: { name: "Watch next leads", style: "existing", View: HeroVariant },
	split: { name: "Yours and new, side by side", style: "existing", View: SplitVariant },
	picks: { name: "Picks first", style: "existing", View: PicksVariant },
	guided: { name: "Ask, then answer", style: "existing", View: GuidedVariant },
	tonight: { name: "One pick, whole screen", style: "bolder", View: TonightVariant },
	magazine: { name: "Tonight's edition", style: "bolder", View: MagazineVariant },
}
