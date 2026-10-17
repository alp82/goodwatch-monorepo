// PROTOTYPE - throwaway. Breadth-first variants of the title page fingerprint, switchable with ?variant=.
// "current" renders the shipped display, so it has no component here.
import type { ComponentType } from "react"
import type { VariantProps } from "./types"
import Strip from "./variants/Strip"
import Standouts from "./variants/Standouts"
import Rows from "./variants/Rows"
import Tabs from "./variants/Tabs"
import Chips from "./variants/Chips"
import Sliders from "./variants/Sliders"
import Questions from "./variants/Questions"
import Grid from "./variants/Grid"
import Sheet from "./variants/Sheet"
import Table from "./variants/Table"
import Glyph from "./variants/Glyph"
import Label from "./variants/Label"

export const FP_VARIANT_NAMES: Record<string, string> = {
	current: "Current (shipped)",
	strip: "Strip - Tagline, 6-cell strip, top chips, good-for line",
	standouts: "Standouts - Only the strong areas, rest in one line",
	rows: "Rows - One-line rows, expand inline",
	tabs: "Tabs - One area at a time, strongest first",
	chips: "Chips - Tagline plus ranked trait chips",
	sliders: "Sliders - Bipolar pace, tone, setting sliders",
	questions: "Questions - Closed questions with answers",
	grid: "Grid - Word grid plus intensity ladder",
	sheet: "Sheet - Short summary, full fingerprint in a sheet",
	table: "Table - Two columns: words left, dense bars right",
	glyph: "Glyph - Identity glyph plus tagline (bolder)",
	label: "Label - Facts-label box (bolder)",
}

export const FP_VARIANTS: Record<string, ComponentType<VariantProps>> = {
	strip: Strip,
	standouts: Standouts,
	rows: Rows,
	tabs: Tabs,
	chips: Chips,
	sliders: Sliders,
	questions: Questions,
	grid: Grid,
	sheet: Sheet,
	table: Table,
	glyph: Glyph,
	label: Label,
}
