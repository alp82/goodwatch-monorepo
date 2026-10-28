// PROTOTYPE (Discover lab, round 6, 2026-10-28): the contract between the lab shell and its sections. The shell owns
// the bar, tabs, sub-tab row, status line, phone sheet and grid. A section renders the content area of one sub-tab
// (or, for `mood`, the whole Mood tab). Each section has variants; `a` is the baseline, the rest explore.
import type { ReactNode } from "react"
import type { ProtoDiscover } from "../kit"
import type { Pieces } from "./shell-parts"

export type { Pieces }

export type SectionId = "titles" | "people" | "taste" | "mood" | "services" | "origin" | "length" | "scores" | "released" | "age"

export type Viewer = "guest" | "member"

export interface SectionProps {
	/** Lab only: preview as a guest or a signed-in member (lab bar toggle). Member data is simulated. */
	viewer: Viewer
	d: ProtoDiscover
	pieces: Pieces
	/** Phone sheet (stacked, 390 px) or desktop panel (fixed height, wide). */
	phone: boolean
	/** The live text in the bar's Search field (not yet run as a search). Sections may read it, e.g. to find people. */
	text: string
	setText: (text: string) => void
	/** Runs the text as the search (d.setQ) and closes nothing. */
	runSearch: (text: string) => void
	/** Opens another place in the panel, e.g. open("watch", "services"). */
	open: (seg: "search" | "mood" | "watch", sub?: string) => void
	/** Closes the panel (phones: the sheet), e.g. after running a search so the grid shows it. */
	close?: () => void
}

export interface SectionVariant {
	key: string
	name: string
	/** Optional sub-tab label this variant wants instead of the shell's default. */
	label?: string
	/** Keep the results grid undimmed while this section is open (its preview is the grid). */
	liveGrid?: boolean
	/** Titles only: a Search button at the right of the bar's field (runs the text, closes the panel). */
	searchButton?: boolean
	View: (props: SectionProps) => ReactNode
}
