// PROTOTYPE (Discover lab, round 6, 2026-10-28): the contract between the lab shell and its sections. The shell owns
// the bar, tabs, sub-tab row, status line, phone sheet and grid. A section renders the content area of one sub-tab
// (or, for `mood`, the whole Mood tab). Each section has variants; `a` is the baseline, the rest explore.
import type { ReactNode } from "react"
import type { TitleCard } from "~/server/title-cards.server"
import type { ProtoDiscover } from "../kit"
import type { Pieces } from "./shell-parts"

export type { Pieces }

/** "layout" is the main tabs choice (round 15), not a panel section. */
export type SectionId = "layout" | "titles" | "people" | "taste" | "mood" | "services" | "origin" | "length" | "scores" | "released" | "age"

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
	open: (seg: "search" | "you" | "mood" | "watch", sub?: string) => void
	/** Closes the panel (phones: the sheet), e.g. after running a search so the grid shows it. */
	close?: () => void
	/** Only for a variant with `ownFind`: Find a filter's field to place, and its results while it has text. */
	find?: { field: ReactNode; results: ReactNode | null }
}

/** A list the grid, the status line and "Show N titles" show instead of Discover's own (mood i: the AND list). */
export interface ResultsView {
	total: number | null
	cards: TitleCard[]
	loading: boolean
	hasMore: boolean
	loadMore: () => void
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
	/** Titles only: the section places Movies or shows (and anime) itself, so the Search row drops its switch. */
	ownType?: boolean
	/** Mood only: the section places Find a filter itself (props.find), so the shell drops its own row. */
	ownFind?: boolean
	/** Mood only: a hook whose list replaces Discover's in the grid and footer while it returns one. */
	useResults?: (d: ProtoDiscover) => ResultsView | null
	View: (props: SectionProps) => ReactNode
}
