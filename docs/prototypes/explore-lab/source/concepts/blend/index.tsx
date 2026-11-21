// PROTOTYPE - throwaway (prototype/explore-r4, concept "blend"). Mix anything: a page is a blend of ingredients, and
// its title is the blend. See BlendBar.tsx for the headline, Pantry.tsx for adding, Overlap.tsx for the Venn and the
// pair strip, curated.ts for the hub's hand-picked blends.
import { best, familyPage, hub, ing, place } from "../../kit/address"
import type { ConceptModule, ConceptPageProps } from "../../kit/contract"
import { exploreTabs } from "../../shell/Shell"
import { HubPage } from "./HubPage"
import type { BlendData } from "./loader.server"
import { BestPage, FamilyPage } from "./OtherPages"
import { DragProvider } from "./parts"
import { PlacePage } from "./PlacePage"

function Page(props: ConceptPageProps<BlendData>) {
	const view = props.data.view
	return (
		<DragProvider>
			{view === "hub" && <HubPage {...props} />}
			{view === "family" && <FamilyPage {...props} />}
			{view === "place" && <PlacePage {...props} />}
			{view === "best" && <BestPage {...props} />}
		</DragProvider>
	)
}

export const concept: ConceptModule<BlendData> = {
	id: "blend",
	name: "Blend",
	tagline: "Mix anything: a page is a blend of ingredients, and its title is the blend.",
	order: 3,
	Page,
	chrome: ({ concept: id, address }) => ({
		tabs: exploreTabs(id, address, { bestTab: true }),
	}),
	quickLinks: (kind) => {
		const show = kind === "show"
		return [
			{ label: "Hub", address: hub(kind) },
			{ label: "Moods", address: familyPage(kind, "mood") },
			{ label: "Countries", address: familyPage(kind, "country") },
			{ label: "Mood", address: place(kind, [ing("mood", "cozy")]) },
			{ label: "Genre", address: place(kind, [ing("genre", "comedy")]) },
			{ label: "Decade", address: place(kind, [ing("decade", "1990s")]) },
			{ label: "Country", address: place(kind, [ing("country", "japan")]) },
			{ label: "Service", address: place(kind, [ing("service", "netflix")]) },
			{
				label: "Blend of 2",
				address: place(kind, [ing("mood", "cozy"), ing("genre", "comedy")]),
			},
			{
				label: "Blend of 3",
				address: place(
					kind,
					show
						? [ing("mood", "quirky"), ing("genre", "comedy"), ing("country", "united-kingdom")]
						: [ing("mood", "romantic"), ing("genre", "comedy"), ing("decade", "1990s")],
				),
			},
			{
				label: "Blend of 4",
				address: place(kind, [
					ing("mood", "cozy"),
					ing("style", "animated"),
					ing("country", "japan"),
					ing("decade", "2000s"),
				]),
			},
			{
				label: "Rare blend",
				address: place(
					kind,
					show
						? [ing("mood", "dark"), ing("genre", "crime"), ing("country", "denmark")]
						: [ing("style", "slow-burn"), ing("genre", "science-fiction"), ing("decade", "1970s")],
				),
			},
			{
				label: "Nothing fits",
				address: place(kind, [ing("mood", "funny"), ing("mood", "dark")]),
			},
			{ label: "Best", address: best(kind) },
			{
				label: "Best of a blend",
				address: best(kind, [ing("mood", "cozy"), ing("decade", "2010s")]),
			},
		]
	},
	notes: ({ data }) => [
		{
			term: "The title is the blend",
			means:
				"Every underlined word in the headline is an ingredient. A mood is underlined in its own color, a service brings its logo, the rest are quiet. Click a word to swap it for a sibling or take it out; hover shows a one-click remove.",
			isNew: true,
		},
		{
			term: "Add",
			means:
				"Opens the pantry: everything that can go in, one family at a time. Hover an ingredient to see the name and four posters of what you'd get. Adding never replaces anything, and two of one family are fine (Cozy and funny).",
			isNew: true,
		},
		{
			term: "Goes well with it",
			means:
				"One more ingredient, chosen because it turns up with this blend far more often than chance. The card names what the blend becomes and shows three of its titles. Click it, or drag it onto the title.",
			isNew: true,
		},
		{
			term: "Dimmed and struck-through ingredients",
			means:
				"In the pantry, 'only a few' means the blend would hold a handful of titles; struck through means nothing is all of it at once.",
			isNew: true,
		},
		{
			term: "Two circles",
			means:
				"A blend of two: only the first, both, or only the second. Each region is a link; the white one is what the list shows. How far the circles overlap is how much the two really share.",
			isNew: true,
		},
		{
			term: "How it holds together",
			means:
				"A blend of three or more: each pair, and how often the two turn up together. The rarest pair is what makes the blend small. A row opens that pair on its own.",
			isNew: true,
		},
		{
			term: "Best",
			means:
				"One more ingredient of the title ('Best cozy movies from the 2010s'), and its own Explore tab. Rows show every source's own score next to the GoodWatch score that sets the rank.",
		},
		{
			term: "Blend of the day",
			means:
				"A hand-picked blend with its real titles; a different one leads each day and 'Another one' turns to the next.",
			isNew: true,
		},
		...(data.view === "place" && data.narrow
			? [
					{
						term: "A rare blend",
						means:
							"Fewer than 24 titles are all of this at once. The page shows them and the nearest blends with more, each one ingredient lighter.",
						isNew: true,
					},
				]
			: []),
		{
			term: "Addresses",
			means:
				"The first pair A's tree knows is the path (/movies/moods/cozy/comedy); every further ingredient travels as ?with=. Pages under 24 titles would not be indexed.",
		},
		{
			term: "Not built",
			means:
				"People as ingredients ('Trippy movies by Christopher Nolan'): the kit has no person rows to intersect, so people stay a hand-off to their own pages.",
		},
	],
}
