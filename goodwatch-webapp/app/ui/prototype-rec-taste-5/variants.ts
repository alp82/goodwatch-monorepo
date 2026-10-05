// PROTOTYPE - throwaway. Round 5's variants of the merged Sides view, in switcher order (?variant=<key>).
// You vs everyone is round 4's Crowd and doesn't change.
import type { ComponentType } from "react"
import type { VariantProps } from "./parts"
import Cards from "./views/Cards"
import List from "./views/List"
import Stacks from "./views/Stacks"
import Statements from "./views/Statements"
import Tree from "./views/Tree"

export type Variant = {
	name: string
	style: "existing" | "bolder"
	View: ComponentType<VariantProps>
}

export const VARIANTS: Record<string, Variant> = {
	list: { name: "Strength list", style: "existing", View: List },
	cards: { name: "Card stack", style: "existing", View: Cards },
	tree: { name: "Side and edge", style: "existing", View: Tree },
	sentence: { name: "In a sentence", style: "bolder", View: Statements },
	shelves: { name: "Poster stacks", style: "bolder", View: Stacks },
}

export const DEFAULT_VARIANT = Object.keys(VARIANTS)[0]
