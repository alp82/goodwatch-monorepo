// The /taste/quiz card: a backdrop across the top and the amber band below, as the other pages' cards, with the
// rating flow's taste bar lit as at a milestone (ui/rating-flow/parts.tsx, TasteBar) across the seam: the fingerprint
// on amber, "Your taste is ready", five lit dots and a chevron. The band says the headline.
// Satori: flex only, every element with more than one child needs display: flex, overlay <svg>s need a viewBox.
import { TASTE_QUIZ_CARD_COPY } from "~/ui/og-image/copy"
import {
	AMBER,
	Brand,
	Frame,
	Headline,
	INK,
	Picture,
	Tag,
	col,
	row,
} from "~/ui/og-image/parts"

export interface OgTasteQuizContent {
	kind: "taste-quiz"
	backdrop: string | null
}

// Heroicons 20 solid: finger-print and chevron-right, the taste bar's own icons.
const FINGERPRINT =
	"M10 2.5c-1.31 0-2.526.386-3.546 1.051a.75.75 0 0 1-.82-1.256A8 8 0 0 1 18 9a22.47 22.47 0 0 1-1.228 7.351.75.75 0 1 1-1.417-.49A20.97 20.97 0 0 0 16.5 9 6.5 6.5 0 0 0 10 2.5ZM4.333 4.416a.75.75 0 0 1 .218 1.038A6.466 6.466 0 0 0 3.5 9a7.966 7.966 0 0 1-1.293 4.362.75.75 0 0 1-1.257-.819A6.466 6.466 0 0 0 2 9c0-1.61.476-3.11 1.295-4.365a.75.75 0 0 1 1.038-.219ZM10 6.12a3 3 0 0 0-3.001 3.041 11.455 11.455 0 0 1-2.697 7.24.75.75 0 0 1-1.148-.965A9.957 9.957 0 0 0 5.5 9c0-.028.002-.055.004-.082a4.5 4.5 0 0 1 8.996.084V9.15l-.005.297a.75.75 0 1 1-1.5-.034c.003-.11.004-.219.005-.328a3 3 0 0 0-3-2.965Zm0 2.13a.75.75 0 0 1 .75.75c0 3.51-1.187 6.745-3.181 9.323a.75.75 0 1 1-1.186-.918A13.687 13.687 0 0 0 9.25 9a.75.75 0 0 1 .75-.75Zm3.529 3.698a.75.75 0 0 1 .584.885 18.883 18.883 0 0 1-2.257 5.84.75.75 0 1 1-1.29-.764 17.386 17.386 0 0 0 2.078-5.377.75.75 0 0 1 .885-.584Z"
const CHEVRON =
	"M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"

const Icon = ({
	d,
	size,
	color,
}: { d: string; size: number; color: string }) => (
	// biome-ignore lint/a11y/noSvgWithoutTitle: drawn into a card image
	<svg width={size} height={size} viewBox="0 0 20 20">
		<path d={d} fill={color} fillRule="evenodd" clipRule="evenodd" />
	</svg>
)

export function TasteQuizCard({ content }: { content: OgTasteQuizContent }) {
	const copy = TASTE_QUIZ_CARD_COPY
	return (
		<Frame>
			<Picture
				src={content.backdrop}
				style={{ top: 0, left: 0, width: 1200, height: 300 }}
			/>
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: 1200,
					height: 300,
					display: "flex",
					backgroundImage:
						"linear-gradient(180deg, rgba(10,10,10,0.7) 0%, rgba(10,10,10,0.35) 100%)",
				}}
			/>
			<div style={{ position: "absolute", top: 36, left: 56, display: "flex" }}>
				<Brand />
			</div>
			<div
				style={row({
					position: "absolute",
					top: 210,
					left: 56,
					width: 1088,
					height: 140,
					alignItems: "center",
					gap: 28,
					padding: "0 36px",
					borderRadius: 32,
					backgroundColor: "#16130b",
					border: `3px solid ${AMBER}`,
				})}
			>
				<div
					style={{
						display: "flex",
						width: 84,
						height: 84,
						borderRadius: 84,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: AMBER,
					}}
				>
					<Icon d={FINGERPRINT} size={46} color={INK} />
				</div>
				<div style={col({ flexGrow: 1, gap: 6 })}>
					<div
						style={{
							display: "flex",
							fontSize: 44,
							fontWeight: 900,
							color: "#fef3c7",
						}}
					>
						{copy.bar}
					</div>
					<div
						style={row({
							alignItems: "center",
							gap: 14,
							fontSize: 28,
							color: "#fde68a",
						})}
					>
						<div style={row({ gap: 8 })}>
							{Array.from({ length: copy.dots }, (_, i) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length dots
									key={i}
									style={{
										display: "flex",
										width: 16,
										height: 16,
										borderRadius: 16,
										backgroundColor: AMBER,
									}}
								/>
							))}
						</div>
						<div style={{ display: "flex" }}>{copy.line}</div>
					</div>
				</div>
				<Icon d={CHEVRON} size={56} color={AMBER} />
			</div>
			<div
				style={col({
					position: "absolute",
					top: 350,
					left: 56,
					right: 56,
					bottom: 0,
					justifyContent: "center",
					gap: 14,
				})}
			>
				<Tag text={copy.tag} />
				<Headline
					text={copy.title}
					sizes={[
						[22, 112],
						[34, 92],
						[999, 64],
					]}
				/>
			</div>
		</Frame>
	)
}
