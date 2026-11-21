// PROTOTYPE - throwaway (prototype/explore-r4, concept `guide`). What the guide's loader hands its pages. Pure types.
import type { Address, Family } from "../../kit/address"
import type {
	AwardWin,
	BestList,
	Blend,
	Era,
	Person,
	PlaceRef,
	ServiceProfile,
	ShowTitle,
	SourceKey,
	TitleList,
	TraitWord,
} from "../../kit/types"

/** A title in a channel: what the screen shows when it is in focus. */
export interface Cell extends ShowTitle {
	sources: Partial<Record<SourceKey, number>>
	/** Its place in the Best list, on the Best channel. */
	rank?: number
}

/** A row of the guide: a place (or Best, Popular, a kind inside a place) and its titles. */
export interface Channel {
	id: string
	/** What it is: decides the mark in front of the name. */
	sort: "best" | "popular" | "place" | "kind" | "essentials" | "add"
	place: PlaceRef | null
	name: string
	/** One line under the name. */
	line?: string
	/** A kind's own traits, as words. */
	words?: TraitWord[]
	/** The channel's own page, when it has one. */
	open: Address | null
	/** A link outside the browse space (Discover for Popular). */
	out?: string | null
	/** This channel together with the one you're on: the split screen. */
	split?: Address | null
	cells: Cell[]
}

export interface GroupLink {
	family: Family
	label: string
	line: string
}

export interface MapCountry {
	code: string
	name: string
	slug: string
	weight: number
}

export type GuideData =
	| {
			view: "hub"
			day: string
			note: string
			channels: Channel[]
			/** Where the next batch starts; null at the end. */
			next: number | null
			total: number
	  }
	| {
			view: "family"
			family: Family
			label: string
			lede: string | null
			channels: Channel[]
			next: number | null
			total: number
			countries: MapCountry[] | null
			/** A streaming country whose availability is still loading. */
			waiting: boolean
	  }
	| {
			view: "place"
			title: string
			parts: PlaceRef[]
			lede: string | null
			more: TraitWord[]
			less: TraitWord[]
			channels: Channel[]
			era: Era | null
			decades: PlaceRef[] | null
			profile: ServiceProfile | null
			countries: MapCountry[] | null
			blend: Blend | null
			people: Person[]
			awards: AwardWin[]
			list: TitleList
			/** A streaming country whose availability is still loading. */
			waiting: boolean
	  }
	| {
			view: "best"
			title: string
			lede: string | null
			best: BestList
			top: Channel
			filters: PlaceRef[]
			moods: PlaceRef[]
			genres: PlaceRef[]
			decades: PlaceRef[]
			years: number[]
	  }
