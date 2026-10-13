// Tonight: one pick at a time, large. Details opens the pick's title screen; Another one steps through the three
// and wraps. A guest's picks are the best rated of the pool, led by the last title on their Wishlist when they have
// one; a member's are their next episode, their movies and their first show to start (tv-home.ts, `tonightPicks`).
// A chunk the TV asks for on first use (screen-code.tsx); it draws with the title screen's parts.
import { Frame } from "../kit"
import type { TvTonightPick } from "../tv-home"
import { tonightWords, whereLine } from "../tv-title"
import { type TitleKey, TitleView } from "./Title"

const KEYS: TitleKey[] = [
	{ id: "details", label: "Details" },
	{ id: "another", label: "Another one" },
]

export default function Tonight({
	items,
	picks,
	pick,
	waiting,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	/** Tonight's picks, as many as the screen steps through. */
	picks: readonly TvTonightPick[]
	/** Which one the screen is on, as the URL counts it. */
	pick: number
	/** The picks are still on their way; else there are none tonight. */
	waiting: boolean
}) {
	if (!picks.length)
		return (
			<Frame name="Tonight" items={items} dim={0.82}>
				<div className="flex min-h-full flex-col justify-center text-[26px] text-white/70">
					{waiting
						? "Tonight's picks are on their way."
						: "No picks right now. Try again in a moment."}
				</div>
			</Frame>
		)
	const at = pick % picks.length
	const shown = picks[at]
	const words = tonightWords(shown, at, picks.length)
	return (
		<TitleView
			name="Tonight"
			crumb={words.crumb}
			items={items}
			title={shown.card}
			kicker={words.kicker}
			// A card's services are the viewer's own first.
			where={whereLine(shown.card, [])}
			line={words.line}
			keys={KEYS.filter((key) => items.includes(key.id))}
		/>
	)
}
