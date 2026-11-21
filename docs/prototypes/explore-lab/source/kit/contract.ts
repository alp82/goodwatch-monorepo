// PROTOTYPE - throwaway (prototype/explore-r4). What a concept is. A concept lives in `concepts/<id>/` and registers
// by file name, so concepts never edit a shared file:
//
//   concepts/<id>/index.tsx          export const concept: ConceptModule<Data>
//   concepts/<id>/loader.server.ts   export const load: ConceptLoader<Data>
//
// The shell parses the address, opens the data kit, calls `load`, and renders `concept.Page` inside the site chrome
// with the one floating switcher. Pure types: safe in the browser.
import type { ComponentType } from "react"
import type { AreaTab } from "~/ui/navigation/areas"
import type { SubNavItem } from "~/ui/navigation/SubNav"
import type { Address, Kind } from "./address"
import type { Viewer } from "./types"

export interface QuickLink {
	label: string
	address: Address
}

/** One line of the prototype-only notes panel: an element of the page and what it means to a viewer. */
export interface Note {
	term: string
	means: string
	/** True for an element this concept invented (not an existing GoodWatch component). */
	isNew?: boolean
}

/** The rows under the site header. Leave a field out to get the default. */
export interface Chrome {
	/** The Explore row's tabs. Default: Browse (here), New, Hot, Awards, People, Map, Discover. */
	tabs?: AreaTab[]
	/** The pinned row under it. Default: Movies | Shows. `null` draws none. */
	pinned?: { label: string; items: SubNavItem[] } | null
}

export interface ConceptPageProps<D = unknown> {
	/** This concept's id. */
	concept: string
	address: Address
	data: D
	viewer: Viewer
	/** The address under this concept: `to(place("movie", [ing("mood", "cozy")]))`. `extra` sets query parameters. */
	to: (a: Address, extra?: Record<string, string | undefined>) => string
}

export interface ConceptModule<D = unknown> {
	id: string
	/** The switcher's name: "Rooms". */
	name: string
	/** One line: how you move in this concept. */
	tagline: string
	/** Position in the switcher (lower first). */
	order?: number
	Page: ComponentType<ConceptPageProps<D>>
	/** The switcher's page links; the kit's defaults when left out. */
	quickLinks?: (kind: Kind) => QuickLink[]
	/** What each element on this page means, for the notes panel. */
	notes?: (props: ConceptPageProps<D>) => Note[]
	/** The rows under the header, when the concept changes them. */
	chrome?: (props: ConceptPageProps<D>) => Chrome
	/**
	 * Round 5: the concept's own floating prototype panel in place of the concept switcher (the lab's panel of slots
	 * and variants). `d` is the route's whole data (shell/load.server.ts `ExploreData`).
	 */
	Panel?: ComponentType<{
		d: import("../shell/load.server").ExploreData
		concept: ConceptModule | null
		notes: Note[]
	}>
}

export interface LoadArgs {
	request: Request
	url: URL
	address: Address
	/** The data kit, opened for this request, kind and streaming country. */
	kit: import("./data.server").Kit
	concept: string
}

export type ConceptLoader<D = unknown> = (args: LoadArgs) => Promise<D>
