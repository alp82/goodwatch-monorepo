// PROTOTYPE (start page lab, round 12): the "searchbar" choices for stage j, in bar order. Stage j reads the chosen key
// from useLab().choice.searchbar and renders accordingly; its builder fills this list.
export type ChoiceVariant = { key: string; name: string }

export const VARIANTS: ChoiceVariant[] = [
	{ key: "a", name: "Current (round 11)" },
	{ key: "b", name: "Split button" },
	{ key: "c", name: "Inline suggestions" },
	{ key: "d", name: "Two-row bar" },
]
