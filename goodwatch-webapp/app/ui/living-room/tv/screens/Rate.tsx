import { mediaFieldLanguage } from "~/utils/media-presentation"
// "How was it?" after Seen it: one question over the title's picture, and the rating strip to answer it with
// (../RatingStrip.tsx, the screen the taste quiz also is). A level or an exact score stores the score and returns
// to the title, whose Seen it key then reads it ("8 · Great"). It has no page to grow into, so no Expand key. A
// chunk the TV asks for on first use (screen-code.tsx).
import { RatingScreen } from "../RatingStrip"
import type { TvTitleOnScreen } from "../tv-title"

export default function Rate({
	items,
	title: on,
}: {
	/** The screen's items, from `tvItems`. */
	items: readonly string[]
	title: TvTitleOnScreen
}) {
	const name = on.title?.title
	return (
		<RatingScreen
			items={items}
			backdrop={on.title?.backdrop_path}
			kicker="Seen it"
			question={name ? `How was ${name}?` : "How was it?"}
			questionMedia={
				name
					? {
							text: name,
							lang: mediaFieldLanguage(on.title),
							at: "How was ".length,
						}
					: undefined
			}
			// Rating again: the score the title has is marked.
			value={on.score}
		/>
	)
}
