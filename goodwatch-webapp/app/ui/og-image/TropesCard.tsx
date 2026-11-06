// The card of By your tropes (/watch/for-you/tropes): the brand and the page's tag over a cloud of twelve trope names
// in Anton on amber, no posters. The names are a fixed set (copy.ts), so the card is the same for every link.
import { TROPES_CARD_COPY as COPY } from "~/ui/og-image/copy"
import { Brand, Frame, INK, Tag } from "~/ui/og-image/parts"

export interface OgTropesContent {
	kind: "tropes"
}

const SIDE = 56
const CLOUD_TOP = 140
const CLOUD_HEIGHT = 446
const FONT_SIZE = { 3: 84, 2: 56, 1: 38 } as const
// The smallest names step back in a lighter ink.
const LIGHT_INK = "rgba(10,10,10,0.62)"

export function TropesCard() {
	return (
		<Frame>
			<div
				style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}
			>
				<Brand dark />
			</div>
			<div
				style={{ position: "absolute", top: 44, right: SIDE, display: "flex" }}
			>
				<Tag text={COPY.tag} />
			</div>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					position: "absolute",
					left: SIDE,
					top: CLOUD_TOP,
					width: 1200 - 2 * SIDE,
					height: CLOUD_HEIGHT,
					alignItems: "center",
					alignContent: "center",
					justifyContent: "center",
					columnGap: 30,
					rowGap: 8,
				}}
			>
				{COPY.tropes.map((trope) => (
					<div
						key={trope.name}
						style={{
							display: "flex",
							fontFamily: "Anton",
							fontSize: FONT_SIZE[trope.weight],
							lineHeight: 1.05,
							letterSpacing: 1,
							color: trope.weight === 1 ? LIGHT_INK : INK,
							whiteSpace: "nowrap",
						}}
					>
						{trope.name.toUpperCase()}
					</div>
				))}
			</div>
		</Frame>
	)
}
