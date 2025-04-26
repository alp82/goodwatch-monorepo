export type ColorName =
	// Gray scale
	| "slate"
	| "gray"
	| "zinc"
	| "neutral"
	| "stone"
	// Main colors
	| "red"
	| "orange"
	| "amber"
	| "yellow"
	| "lime"
	| "green"
	| "emerald"
	| "teal"
	| "cyan"
	| "sky"
	| "blue"
	| "indigo"
	| "violet"
	| "purple"
	| "fuchsia"
	| "pink"
	| "rose"
	// Special colors
	| "white"
	| "black"
export type ColorIdentifier =
	| 50
	| 100
	| 200
	| 300
	| 400
	| 500
	| 600
	| 700
	| 800
	| 900
	| 950
export type TransparencySuffix = "" | `/${number}`
export type BgColor = `bg-${ColorName}-${ColorIdentifier}${TransparencySuffix}`
export type OutlineColor =
	`outline-${ColorName}-${ColorIdentifier}${TransparencySuffix}`
export type TextColor =
	`text-${ColorName}-${ColorIdentifier}${TransparencySuffix}`
