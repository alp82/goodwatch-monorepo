// PROTOTYPE (start page lab, round 12): the "light" choices for stage j, in bar order. Stage j reads the chosen key
// from useLab().choice.light and renders accordingly; its builder fills this list.
export type ChoiceVariant = { key: string; name: string }

export const VARIANTS: ChoiceVariant[] = [
	{ key: "a", name: "Current (round 11)" },
	{ key: "b", name: "Stronger grade" },
	{ key: "c", name: "Grade + film effects" },
	{ key: "d", name: "Cinematic" },
]
