// PROTOTYPE - throwaway. Variants of the title page fingerprint, switchable with ?variant=.
// "current" renders the shipped display, so it has no component here. Round 1 variants the owner
// didn't pick stay reachable by URL but are out of the switcher cycle.
import type { ComponentType } from "react"
import type { VariantProps } from "./types"
import SlideStrip from "./variants/SlideStrip"
import SlideGrid from "./variants/SlideGrid"
import AllSliders from "./variants/AllSliders"
import Compact from "./variants/Compact"
import Relative from "./variants/Relative"
import Versus from "./variants/Versus"
import Mixer from "./variants/Mixer"
import Barcode from "./variants/Barcode"
import Recipe from "./variants/Recipe"
import Strip from "./variants/Strip"
import Grid from "./variants/Grid"
import Sliders from "./variants/Sliders"
import Standouts from "./variants/Standouts"
import Rows from "./variants/Rows"
import Tabs from "./variants/Tabs"
import Chips from "./variants/Chips"
import Questions from "./variants/Questions"
import Sheet from "./variants/Sheet"
import Table from "./variants/Table"
import Glyph from "./variants/Glyph"
import Label from "./variants/Label"

export const FP_VARIANT_NAMES: Record<string, string> = {
	slidestrip: "SlideStrip - Strip cards plus sliders",
	slidegrid: "SlideGrid - Word grid left, sliders right",
	allsliders: "AllSliders - Every reading as a two-ended slider",
	compact: "Compact - One-line sliders under the tagline",
	relative: "Relative - Sliders with genre-typical markers",
	versus: "Versus - It is / it isn't (distinct)",
	mixer: "Mixer - Mixing desk faders (distinct, bolder)",
	barcode: "Barcode - Color band signature (distinct, bolder)",
	recipe: "Recipe - Ingredients and proportions (distinct, bolder)",
	strip: "Strip - Round 1",
	grid: "Grid - Round 1",
	sliders: "Sliders - Round 1",
	current: "Current (shipped)",
}

export const FP_VARIANTS: Record<string, ComponentType<VariantProps>> = {
	slidestrip: SlideStrip,
	slidegrid: SlideGrid,
	allsliders: AllSliders,
	compact: Compact,
	relative: Relative,
	versus: Versus,
	mixer: Mixer,
	barcode: Barcode,
	recipe: Recipe,
	strip: Strip,
	grid: Grid,
	sliders: Sliders,
	standouts: Standouts,
	rows: Rows,
	tabs: Tabs,
	chips: Chips,
	questions: Questions,
	sheet: Sheet,
	table: Table,
	glyph: Glyph,
	label: Label,
}

/** Round 2 variants move the closed questions into the FAQ section further down the page. */
export const FP_FAQ_VARIANTS: string[] = ["slidestrip", "slidegrid", "allsliders", "compact", "relative", "versus", "mixer", "barcode", "recipe"]
