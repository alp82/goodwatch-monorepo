// A place as its identity card, with the place's posters held like a hand of cards behind its lower edge. They rise
// and open on hover and focus; they are never the click target.
import type { CardProps } from "~/domain/browse/types"
import { IdentityCard } from "~/ui/browse/cards/frame"
import { useBrowsePage } from "~/ui/browse/page-context"

export function PeekCard(props: CardProps) {
	const { marks } = useBrowsePage()
	return <IdentityCard {...props} data={marks ?? undefined} posters="peek" />
}
