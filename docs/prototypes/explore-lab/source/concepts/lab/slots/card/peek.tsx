// PROTOTYPE - throwaway (prototype/explore-r5). Card variant "Peek": the identity card, with the place's posters held
// like a hand of cards behind its lower edge. They rise and open on hover and focus; they are never the click target.
import type { SlotVariant } from "../../contract"
import { type CardViewProps, IDENTITY_NOTES, IdentityCard } from "./frame"

function View(props: CardViewProps) {
	return <IdentityCard {...props} posters="peek" />
}

export const variant: SlotVariant<never, CardViewProps> = {
	id: "peek",
	name: "Peek",
	what: "Identity first, with three posters peeking over the lower edge. They rise when you point at the card.",
	order: 2,
	View,
	notes: () => [
		...IDENTITY_NOTES,
		{
			term: "Poster fan",
			means:
				"Three titles of the place, held behind the card's lower edge. They show what's inside without being the card; they rise when you point at it. The whole card is one link.",
			isNew: true,
		},
	],
}
