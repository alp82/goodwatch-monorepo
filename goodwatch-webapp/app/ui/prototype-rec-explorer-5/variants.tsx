// PROTOTYPE - throwaway. The round-5 Explorer variants, in switcher order. All are round 4's islands; they differ in
// how an island shows who it is zoomed out, how its fractal of closer titles is arranged, and how the close-up turns
// the map cinematic.
import type { ComponentType } from "react"
import type { Ex4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { Explorer5 } from "./Explorer5"
import type { Config } from "./config"

export type Variant = {
	name: string
	style: "existing" | "bolder"
	View: ComponentType<{ ex: Ex4 }>
}

const v = (cfg: Config): Variant["View"] =>
	function V({ ex }) {
		return <Explorer5 ex={ex} cfg={cfg} />
	}

export const VARIANTS: Record<string, Variant> = {
	crest: {
		name: "Crests, orbits, flood",
		style: "existing",
		View: v({
			arr: "orbit",
			identity: "crest",
			icons: "glyph",
			cinema: "flood",
			lines: true,
		}),
	},
	ground: {
		name: "Flag ground, corners, marquee",
		style: "bolder",
		View: v({
			arr: "corners",
			identity: "ground",
			icons: "emoji",
			cinema: "marquee",
			lines: false,
		}),
	},
	lens: {
		name: "Pins, crosses, lens",
		style: "bolder",
		View: v({
			arr: "plus",
			identity: "pin",
			icons: "emoji",
			cinema: "lens",
			lines: false,
		}),
	},
	shore: {
		name: "Shoreline names, crosses, flood",
		style: "existing",
		View: v({
			arr: "plus",
			identity: "shore",
			icons: "glyph",
			cinema: "flood",
			lines: false,
		}),
	},
}
