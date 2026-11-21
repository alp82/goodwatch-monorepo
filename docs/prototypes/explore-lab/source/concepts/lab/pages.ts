// PROTOTYPE - throwaway (prototype/explore-r5). Which page slot renders an address. One source of truth: every page
// slot's `applies` is `pageSlotOf(address) === id`.
import type { Address, Family } from "../../kit/address"

export type PageSlot =
	| "hub"
	| "moods"
	| "mood"
	| "genres"
	| "genre"
	| "eras"
	| "era"
	| "places"
	| "country"
	| "streaming"
	| "service"
	| "best"
	| "blend"
	| "other"
	| "tropes"
	| "trope"

const INDEX: Record<Family, PageSlot> = {
	mood: "moods",
	genre: "genres",
	decade: "eras",
	country: "places",
	service: "streaming",
	theme: "other",
	style: "other",
	trait: "other",
	trope: "tropes",
}
const PLACE: Record<Family, PageSlot> = {
	mood: "mood",
	genre: "genre",
	decade: "era",
	country: "country",
	service: "service",
	theme: "other",
	style: "other",
	trait: "other",
	trope: "trope",
}

/**
 * hub        /movies
 * moods      /movies/moods                 mood     /movies/moods/cozy
 * genres     /movies/genres                genre    /movies/genres/comedy
 * eras       /movies/decades               era      /movies/decades/1990s
 * places     /movies/countries             country  /movies/countries/japan
 * streaming  /movies/streaming/us          service  /movies/streaming/us/netflix
 * best       /movies/best (with or without filters)
 * blend      any place with two or more ingredients (/movies/moods/cozy/comedy, ?with=...)
 * other      themes, styles and traits: their index pages and their places
 * tropes     /movies/tropes (round 6)      trope    /movies/tropes/chekhovs-gun
 */
export function pageSlotOf(a: Address): PageSlot {
	if (a.view === "best") return "best"
	if (a.view === "family" && a.family) return INDEX[a.family]
	if (a.view === "place" && a.parts.length > 1) return "blend"
	if (a.view === "place" && a.parts[0]) return PLACE[a.parts[0].family]
	return "hub"
}
