// PROTOTYPE - throwaway (prototype/explore-r4). The copy deck (kit/copy/) and the world map (kit/world-map/) are built
// on a parallel branch. They are found by file glob, so this branch builds without them and picks them up on merge.
import type { ComponentType } from "react"
import type { Family, Kind } from "./address"
import type { Copy } from "./types"

// The deck is written per kind, with a text of its own for movies and shows together.
const deckKind = (kind: Kind) => (kind === "all" ? "all" : kind === "show" ? "shows" : "movies")

type CopyFor = (kind: "movies" | "shows" | "all", family: string, id: string) => Copy | null

/** The copy deck's family names (plural); a trait has no hand-written copy. */
const COPY_FAMILY: Partial<Record<Family | "best" | "hub", string>> = {
	mood: "moods",
	genre: "genres",
	theme: "themes",
	style: "styles",
	decade: "decades",
	country: "countries",
	service: "services",
	best: "best",
	hub: "hub",
}

// Not the tests: they import vitest, which cannot load in the browser.
const copyModules = import.meta.glob<Record<string, unknown>>(
	["./copy/*.{ts,tsx}", "!./copy/*.test.ts"],
	{ eager: true },
)
const mapModules = import.meta.glob<Record<string, unknown>>(
	["./world-map/*.{ts,tsx}", "!./world-map/*.test.ts"],
	{ eager: true },
)

const find = <T>(modules: Record<string, Record<string, unknown>>, name: string): T | null => {
	for (const m of Object.values(modules)) if (m[name]) return m[name] as T
	return null
}

const copyForImpl = find<CopyFor>(copyModules, "copyFor")

/** The hand-written copy of a place (lede and a short line), or null when the deck has none. */
export function copyFor(kind: Kind, family: Family | "best" | "hub", slug: string): Copy | null {
	const deck = COPY_FAMILY[family]
	if (!deck) return null
	return copyForImpl?.(deckKind(kind), deck, slug) ?? null
}

/** The deck's text for the hub ("home"), a family's landing ("moods", "genres", ...) or Best ("all"). */
export function pageCopy(kind: Kind, deck: "hub" | "best", id: string): Copy | null {
	return copyForImpl?.(deckKind(kind), deck, id) ?? null
}

export interface WorldMapCountry {
	code: string
	name: string
	href: string
	/** 0-1: how much of the catalog comes from there. */
	weight: number
}

/** The world map, or null until its branch is merged. */
export const WorldMap = find<
	ComponentType<{
		countries: readonly WorldMapCountry[]
		active?: string
		variant?: "page" | "hero"
		list?: boolean
		fade?: "edges" | "left"
		onHotChange?: (code: string | null) => void
		initialView?: string
		className?: string
	}>
>(mapModules, "WorldMap")
