// PROTOTYPE - throwaway. Variants of the title page fingerprint, switchable with ?variant=.
// "current" renders the shipped display, so it has no component here. Earlier variants the owner
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
import SlidePop from "./variants/SlidePop"
import SlideFlip from "./variants/SlideFlip"
import SlideSide from "./variants/SlideSide"
import Versus2 from "./variants/Versus2"
import BandVersus from "./variants/BandVersus"
import Barcode2 from "./variants/Barcode2"
import BandSliders from "./variants/BandSliders"
import Trio from "./variants/Trio"
import Stripes from "./variants/Stripes"

export const FP_VARIANT_NAMES: Record<string, string> = {
	slidepop: "SlidePop - Sliders, traits in a floating card",
	slideflip: "SlideFlip - Sliders, rows flip in place",
	slideside: "SlideSide - Sliders with a fixed traits panel",
	versus2: "Versus2 - Versus with a compact is/isn't row",
	bandversus: "BandVersus - Barcode band over versus lines",
	barcode2: "Barcode2 - Barcode, improved",
	bandsliders: "BandSliders - Barcode band over sliders",
	trio: "Trio - Band, versus and sliders together",
	stripes: "Stripes - Every slider track is a barcode",
	allsliders: "AllSliders - Every reading as a two-ended slider",
	versus: "Versus - It is / it isn't (distinct)",
	barcode: "Barcode - Color band signature (distinct, bolder)",
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
	slidepop: SlidePop,
	slideflip: SlideFlip,
	slideside: SlideSide,
	versus2: Versus2,
	bandversus: BandVersus,
	barcode2: Barcode2,
	bandsliders: BandSliders,
	trio: Trio,
	stripes: Stripes,
}

/** Round 2 and later variants move the closed questions into the FAQ section further down the page. */
export const FP_FAQ_VARIANTS: string[] = ["slidestrip", "slidegrid", "allsliders", "compact", "relative", "versus", "mixer", "barcode", "recipe", "slidepop", "slideflip", "slideside", "versus2", "bandversus", "barcode2", "bandsliders", "trio", "stripes"]
