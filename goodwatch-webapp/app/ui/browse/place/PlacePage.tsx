// A place page (a mood, a genre, a theme, a style, or any blend): the list is the page. The head is one band that
// unfolds into the place's full introduction; under it one screen-tall block holds the steering beside the grid, both
// the same height; the place's sections continue under it.
import { LayoutGroup } from "framer-motion"
import { useState } from "react"
import { WRAP } from "~/ui/browse/index"
import { Body } from "~/ui/browse/place/Body"
import { PlaceHead } from "~/ui/browse/place/PlaceHead"
import { PlaceSections } from "~/ui/browse/place/Sections"
import type { HeadState, Props } from "~/ui/browse/place/shared"
import { Stage } from "~/ui/browse/place/Stage"

export function PlacePage({ data, address, to, viewer }: Props) {
	const [head, setHead] = useState<HeadState>("folded")
	return (
		<LayoutGroup>
			<PlaceHead data={data} address={address} to={to} state={head} onState={setHead} />
			<Body>
				<div className={`${WRAP} space-y-14 pt-1`}>
					<Stage data={data} address={address} to={to} viewer={viewer} />
					<PlaceSections data={data} address={address} to={to} />
				</div>
			</Body>
		</LayoutGroup>
	)
}
