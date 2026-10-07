// PROTOTYPE for "Prototype native-scroll carousels on title pages", second round. Throwaway code: not for production.
//
// Variant "explore1", a constellation: the title's poster in the middle and four spokes around it. A spoke is named
// by a trait its titles share with the center; the tag under a poster says how that title differs. The caption
// gives the focused title's full reason and a step onto it, which redraws the constellation around that title.
//
// Real: the titles, the spokes, and the reasons (explore-model.ts). Faked: nothing moves or zooms like the
// Explorer's map, and the posters carry no title actions.
import type { CSSProperties } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import {
	Caption,
	Frame,
	Poster,
	useExploreWalk,
	useFocus,
} from "~/ui/prototype-carousels/ExploreShared"

// A spoke runs from the middle toward a corner. A poster sits at a share of the way (--f): two per spoke on a
// phone, three from 768 px.
const CSS = `
.px1{position:relative;width:100%;aspect-ratio:346/408;--w:16%;--c:23%}
.px1 svg{position:absolute;inset:0;width:100%;height:100%}
.px1-n{position:absolute;width:var(--w);left:calc(50% + var(--dx) * var(--f) * 1%);top:calc(50% + var(--dy) * var(--f) * 1%);
transform:translate(-50%,-50%)}
.px1-n0{--f:.55}.px1-n1{--f:1}.px1-n2{display:none}
.px1-c{position:absolute;left:50%;top:50%;width:var(--c);transform:translate(-50%,-50%)}
.px1-c .px-p{outline:3px solid #fff}
.px1-t{position:absolute;left:50%;top:100%;transform:translate(-50%,-45%);width:max-content;max-width:150%;
padding:1px 5px;border-radius:.375rem;background:rgba(8,10,18,.88);font-size:.625rem;line-height:1.15;text-align:center;
color:#e5e7eb;pointer-events:none}
.px1-l{position:absolute;width:max-content;max-width:190%;font-size:.75rem;font-weight:700;line-height:1.15;color:#fff}
.px1-l i{display:inline-block;width:.5rem;height:.5rem;border-radius:9999px;margin-right:.25rem}
.px1-top .px1-l{bottom:calc(100% + .375rem)}
.px1-bottom .px1-l{top:calc(100% + 1.6rem)}
.px1-left .px1-l{left:0}
.px1-right .px1-l{right:0;text-align:right}
@media (min-width:768px){
.px1{aspect-ratio:720/452;--w:9.4%;--c:13.5%}
.px1-n0{--f:.43}.px1-n1{--f:.715}.px1-n2{--f:1;display:block}
.px1-t{font-size:.6875rem}
.px1-l{font-size:.8125rem}
}
`

/** Where the spokes point, in percent of the stage from the middle to the outermost poster. */
const DIRECTIONS = [
	{ dx: -40.5, dy: -37, side: "px1-top px1-left" },
	{ dx: 40.5, dy: -37, side: "px1-top px1-right" },
	{ dx: -40.5, dy: 34, side: "px1-bottom px1-left" },
	{ dx: 40.5, dy: 34, side: "px1-bottom px1-right" },
]

export default function Explore1Constellation({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const walk = useExploreWalk(media, "explore1")
	const spokes = walk.model?.spokes ?? []
	const picks = spokes.flatMap((spoke) => spoke.titles)
	const focus = useFocus(`${walk.center.type}-${walk.center.id}`)
	if (!media.fingerprint) return null
	let at = 0
	return (
		<Frame
			walk={walk}
			hint="A spoke is what they share with it. A tag is how one differs."
		>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			<div className="grid items-center gap-4 md:grid-cols-[minmax(0,45rem)_minmax(0,1fr)] md:gap-8">
				<div className={`px1 ${walk.busy ? "px-busy" : ""}`}>
					<svg
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						aria-hidden="true"
					>
						{spokes.map((spoke, index) => (
							<line
								key={spoke.key}
								x1="50"
								y1="50"
								x2={50 + DIRECTIONS[index].dx}
								y2={50 + DIRECTIONS[index].dy}
								stroke={spoke.color}
								strokeOpacity=".55"
								strokeWidth="1.5"
								vectorEffect="non-scaling-stroke"
							/>
						))}
					</svg>
					<span className="px1-c">
						<span className="px-p">
							<TmdbImage
								kind="poster"
								path={walk.center.poster}
								width={96}
								alt=""
							/>
						</span>
					</span>
					{spokes.map((spoke, index) => {
						const direction = DIRECTIONS[index]
						return spoke.titles.map((title, nth) => {
							const mine = at++
							return (
								<div
									key={`${title.type}-${title.id}`}
									className={`px1-n px1-n${nth} ${direction.side}`}
									style={
										{
											"--dx": direction.dx,
											"--dy": direction.dy,
										} as CSSProperties
									}
								>
									{nth === 0 && (
										<span className="px1-l">
											<i style={{ backgroundColor: spoke.color }} />
											{spoke.label}
										</span>
									)}
									<Poster title={title} width={72} {...focus.handlers(mine)} />
									<span className="px1-t">{title.tag}</span>
								</div>
							)
						})
					})}
				</div>
				<Caption pick={picks[focus.index]} walk={walk} />
			</div>
		</Frame>
	)
}
