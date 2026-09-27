// PROTOTYPE - throwaway. The round-4 Explorer variants, in switcher order. All are one zoomable map with the grouping
// chosen up front; they differ in how the map looks zoomed out and in how the close-up at the deep end works.
import type { ComponentType } from "react"
import { Explorer4 } from "./Explorer4"
import type { Ex4 } from "./useExplorer4"

export type Variant = {
	name: string
	style: "existing" | "bolder"
	View: ComponentType<{ ex: Ex4 }>
}

export const VARIANTS: Record<string, Variant> = {
	fields: {
		name: "Fields and close-up",
		style: "existing",
		View: ({ ex }) => <Explorer4 ex={ex} kind="fields" mode="single" />,
	},
	islands: {
		name: "Islands and neighbors",
		style: "existing",
		View: ({ ex }) => <Explorer4 ex={ex} kind="blobs" mode="neighborhood" />,
	},
	board: {
		name: "Board and reel",
		style: "existing",
		View: ({ ex }) => <Explorer4 ex={ex} kind="tiles" mode="reel" />,
	},
	rings: {
		name: "Taste rings",
		style: "bolder",
		View: ({ ex }) => <Explorer4 ex={ex} kind="rings" mode="rings" hide={["taste"]} />,
	},
}
