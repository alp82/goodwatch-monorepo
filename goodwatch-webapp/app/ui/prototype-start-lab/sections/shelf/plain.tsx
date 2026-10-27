// PROTOTYPE (start page lab): baseline: the poster fills the slot, links to the title page.
import { Link } from "@remix-run/react"
import type { SlotProps } from "../../lab/types"
import { titleHref } from "../../lab/kit"

export function PlainSlot({ card }: SlotProps) {
	if (!card?.poster_path) return null
	return (
		<Link to={titleHref(card)} prefetch="none" className="block h-full w-full overflow-hidden bg-black" title={card.title}>
			<img src={`https://image.tmdb.org/t/p/w342${card.poster_path}`} alt={card.title} className="h-full w-full object-cover" draggable={false} />
		</Link>
	)
}
