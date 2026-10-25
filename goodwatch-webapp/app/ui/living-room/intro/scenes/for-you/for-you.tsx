// The "For you" chapter: the wall opening (wall.tsx), then the camera dives through the pick's poster into its
// backdrop, full bleed and slowly drifting. Bottom left, like a streaming service's hero: "Picked for you", the title,
// the taste-match pill and "Because you loved …". Ends on that frame, the backdrop still drifting.
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import type { CSSProperties } from "react"
import { HeroPoster } from "~/ui/living-room/intro/parts/hero-poster"
import { Layer, at } from "~/ui/living-room/intro/parts/score-kit"
import type { SceneProps } from "~/ui/living-room/intro/scene"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { pickOf } from "./pick"
import { HANDOFF, WallOpening } from "./wall"
import "./for-you.css"

const THROUGH = HANDOFF + 80
const BACKDROP_AT = HANDOFF + 150
const KICK_AT = HANDOFF + 650
const TITLE_AT = KICK_AT + 120
const MATCH_AT = TITLE_AT + 450
const WHY_AT = MATCH_AT + 180
/** The line lands at WHY_AT + 850; then 0.7 s of reading while the backdrop drifts. */
export const FOR_YOU_MS = WHY_AT + 850 + 700

export function ForYou({ data }: SceneProps) {
	const { hero, loved, match, others } = pickOf(data)
	if (!hero) return null
	const because = loved[0]
	return (
		<div className="intro-score intro-brand">
			<WallOpening hero={hero} others={others} />
			<div
				className="intro-fy-backdrop intro-score-fade"
				style={at(BACKDROP_AT, 900)}
			>
				<div
					className="intro-fy-backdrop-zoom"
					style={at(BACKDROP_AT, FOR_YOU_MS - BACKDROP_AT)}
				>
					{hero.backdrop_path && (
						<img src={tmdbImageUrl(hero.backdrop_path, "w1280")} alt="" />
					)}
				</div>
				<div className="intro-fy-backdrop-shade" />
			</div>
			{/* The sharp poster takes over from the dive, grows past the camera and is gone as the backdrop settles. */}
			<Layer className="intro-score-fade" style={at(HANDOFF, 250)}>
				<Layer
					className="intro-score-to intro-tempo-through"
					style={
						{
							...at(THROUGH, 650),
							transformOrigin: "50cqw 46cqh",
							"--ts": 3.2,
							"--to": 0,
						} as CSSProperties
					}
				>
					<HeroPoster card={hero} />
				</Layer>
			</Layer>
			<div className="intro-fy-hero">
				<div
					className="intro-fy-hero-kick intro-score-rise"
					style={at(KICK_AT, 700)}
				>
					Picked for you
				</div>
				<div
					className="intro-fy-hero-title intro-score-rise"
					style={at(TITLE_AT, 850)}
				>
					{hero.title}
				</div>
				<div className="intro-fy-hero-row">
					<span
						className="intro-fy-pill intro-score-pop"
						style={at(MATCH_AT, 700)}
					>
						<FingerPrintIcon aria-hidden />
						{match}% match
					</span>
					{because && (
						<span
							className="intro-fy-hero-why intro-score-rise"
							style={at(WHY_AT, 850)}
						>
							Because you loved <b>{because.title}</b>
						</span>
					)}
				</div>
			</div>
		</div>
	)
}
