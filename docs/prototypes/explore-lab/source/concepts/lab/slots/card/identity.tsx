// PROTOTYPE - throwaway (prototype/explore-r5). Card variant "Identity": no posters at all. The card is what the place
// is: a mood's light, a genre's form, a decade's numerals, a country's outline, a service's logo.
import type { SlotVariant } from "../../contract"
import { type CardViewProps, IDENTITY_NOTES, IdentityCard } from "./frame"

function View(props: CardViewProps) {
	return <IdentityCard {...props} posters="none" />
}

export const variant: SlotVariant<never, CardViewProps> = {
	id: "identity",
	name: "Identity only",
	what: "No posters. A mood is its light, a genre its form, a decade its numerals, a country its outline, a service its logo.",
	order: 1,
	View,
	notes: () => IDENTITY_NOTES,
}
