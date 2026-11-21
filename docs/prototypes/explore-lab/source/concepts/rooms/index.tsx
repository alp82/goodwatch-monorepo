// PROTOTYPE - throwaway (prototype/explore-r4). Concept "rooms": every family is a room with its own format.
//
// The Explore row keeps its tabs (Browse first). Under it one row carries the whole browse space: Movies | Shows,
// then Overview · Moods · Genres · Eras · Places · Streaming · Best. Best lives inside the tree here.
import type { CSSProperties } from "react"
import { best, familyPage, hub, ing, place } from "../../kit/address"
import type { ConceptModule, ConceptPageProps } from "../../kit/contract"
import { RoomsBar } from "./bar"
import type { PlaceData, RoomsData } from "./loader.server"
import { BestPage, PlacePage } from "./place"
import { CardsRoom, ErasRoom, GenresRoom, Hub, MoodsRoom, PlacesRoom, StreamingRoom } from "./rooms"

/** The page under the rooms row. The lab wires it in as the round 4 baseline of its Rooms-sourced slots. */
export function Body(props: ConceptPageProps<RoomsData>) {
	const { data, address, to } = props
	const kind = address.kind
	switch (data.view) {
		case "hub":
			return <Hub data={data} to={to} kind={kind} />
		case "moods":
			return <MoodsRoom data={data} to={to} kind={kind} />
		case "genres":
			return <GenresRoom data={data} to={to} kind={kind} />
		case "eras":
			return <ErasRoom data={data} to={to} kind={kind} />
		case "places":
			return <PlacesRoom data={data} to={to} kind={kind} />
		case "streaming":
			return <StreamingRoom data={data} to={to} kind={kind} />
		case "cards":
			return <CardsRoom data={data} to={to} kind={kind} />
		case "best":
			return <BestPage {...props} data={data} />
		default:
			return <PlacePage {...props} data={data as PlaceData} />
	}
}

function Page(props: ConceptPageProps<RoomsData>) {
	return (
		// The rooms row adds 44px under the tab row from `lg`: a sticky bar inside the page (Best's header) sits under it.
		<div style={{ "--best-head-top": "calc(4rem + 93px)" } as CSSProperties}>
			<RoomsBar address={props.address} to={props.to} />
			<Body {...props} />
		</div>
	)
}

export const concept: ConceptModule<RoomsData> = {
	id: "rooms",
	name: "Rooms",
	tagline:
		"Every family is a room with its own format. The row under Explore carries it: Movies | Shows, then the rooms.",
	order: 1,
	Page,
	// The rooms row replaces the pinned Movies | Shows row: it holds that switch itself.
	chrome: () => ({ pinned: null }),
	quickLinks: (kind) => [
		{ label: "Hub", address: hub(kind) },
		{ label: "Moods", address: familyPage(kind, "mood") },
		{ label: "Genres", address: familyPage(kind, "genre") },
		{ label: "Eras", address: familyPage(kind, "decade") },
		{ label: "Places", address: familyPage(kind, "country") },
		{ label: "Streaming", address: familyPage(kind, "service") },
		{ label: "Best", address: best(kind) },
		{ label: "Best, filtered", address: best(kind, [ing("mood", "cozy")], 2025) },
		{ label: "Mood", address: place(kind, [ing("mood", "cozy")]) },
		{ label: "Genre", address: place(kind, [ing("genre", "comedy")]) },
		{ label: "Decade", address: place(kind, [ing("decade", "1990s")]) },
		{ label: "Country", address: place(kind, [ing("country", "japan")]) },
		{ label: "Service", address: place(kind, [ing("service", "netflix")]) },
		{ label: "Blend of 2", address: place(kind, [ing("mood", "cozy"), ing("genre", "comedy")]) },
		{
			label: "Blend of 3",
			address: place(kind, [ing("mood", "dark"), ing("genre", "thriller"), ing("decade", "2010s")]),
		},
	],
	notes: ({ data }) => [
		{
			term: "The rooms row",
			means:
				"Movies | Shows, then one tab per family. It is the site's existing third-level row with the kind switch in front; the amber dot is where you are. On a phone it is a quiet row in the page.",
			isNew: true,
		},
		...(data.view === "hub"
			? [
					{
						term: "Front page",
						means:
							"One module per family, each in that family's own format and each showing real titles. One Popular rail, after the moods.",
					},
					{
						term: "Best switch",
						means:
							"All time, this year or a decade: the top five change in place. Every row shows each source's own score beside the GoodWatch score that ranks it.",
					},
				]
			: []),
		{
			term: "Mood card",
			means:
				"A mood is its color (in the card's header only) and three posters that feel like it. The whole card is one link.",
		},
		{
			term: "Kinds",
			means:
				"The few clearly different sorts of title inside a genre, mood, decade or country, found by grouping their fingerprints. Each is a link that narrows the list.",
			isNew: true,
		},
		{
			term: "Era timeline",
			means:
				"A decade's place on the line is its place in time. The bar shows the whole span and which decades are in view; click one to travel there. Several posters per decade, never one. The Eras room is the timeline itself, top to bottom.",
			isNew: true,
		},
		{
			term: "World map",
			means:
				"A brighter country has a page. Point at one and the panel under the map says what it is known for and shows three of its titles.",
		},
		{
			term: "Trait steps",
			means:
				"How much of a trait a place has, in five steps; the small dot is what's usual. The word is the message; the exact value shows on hover or tap.",
			isNew: true,
		},
		{
			term: "Ways onward",
			means:
				"In a place's head: what it pairs well with, the place closest to it, and the one title to start with. Each is a link.",
		},
		{
			term: "After the decade before",
			means:
				"On a decade's page: what there was more of and less of than in the decade before, as words. Each opens that kind of title from this decade.",
			isNew: true,
		},
		{
			term: "Essentials",
			means:
				"The titles closest to the heart of the place, each with one sentence from GoodWatch's title analysis as its caption.",
		},
		{
			term: "Goes well with",
			means:
				"One more ingredient and what that blend would give you. This is how a blend starts: nothing is replaced, one thing is added.",
		},
		{
			term: "Venn switch",
			means:
				"On a blend of two: both, only the first, or only the second. It changes the list right under it.",
		},
		{
			term: "Streaming and New",
			means:
				"A service's page is its whole library, with what it is strong and thin on in one sentence. This week's arrivals stay in New, and every service page hands off to it.",
		},
	],
}
