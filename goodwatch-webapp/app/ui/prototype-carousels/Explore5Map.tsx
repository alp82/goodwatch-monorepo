// PROTOTYPE for "Prototype native-scroll carousels on title pages", second round. Throwaway code: not for production.
//
// Variant "explore5", a map: two named axes of difference, the title where they cross, and ten related titles
// placed by how they differ from it (further right is darker, further up is faster, or whichever two axes spread
// this title's neighbors most). The caption gives the focused title's reason in words and a step onto it, which
// draws the map again around that title, with the axes that fit its neighbors.
//
// Real: the titles, the choice of axes, the places (before posters are pushed off each other), and the reasons
// (explore-model.ts). Faked: no pan or zoom, and the places are solved for a phone's stage and scaled up.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import {
	Caption,
	Frame,
	Poster,
	useExploreWalk,
	useFocus,
} from "~/ui/prototype-carousels/ExploreShared"

const CSS = `
.px5{display:grid;grid-template-columns:1rem minmax(0,1fr) 1rem;gap:.25rem;
grid-template-areas:". top ." "left stage right" ". bottom .";
font-size:.75rem;font-weight:700;color:#e5e7eb;max-width:27rem;width:100%;margin:0 auto}
.px5-y{text-align:center}
.px5-x{writing-mode:vertical-rl;text-align:center;align-self:center;white-space:nowrap}
.px5-s{grid-area:stage;position:relative;aspect-ratio:346/372;border-radius:.75rem;background:rgba(5,8,16,.6);border:1px solid rgba(255,255,255,.08);overflow:hidden}
.px5-s::before,.px5-s::after{content:"";position:absolute;background:rgba(251,191,36,.35)}
.px5-s::before{left:0;right:0;top:var(--y);height:1px}
.px5-s::after{top:0;bottom:0;left:var(--x);width:1px}
.px5-n{position:absolute;width:13.3%;transform:translate(-50%,-50%)}
.px5-c{position:absolute;width:17.3%;left:var(--x);top:var(--y);transform:translate(-50%,-50%)}
.px5-c .px-p{outline:3px solid #fff}
.px5-n:has([data-on]){z-index:1}
`

export default function Explore5Map({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const walk = useExploreWalk(media, "explore5")
	const map = walk.model?.map
	const focus = useFocus(`${walk.center.type}-${walk.center.id}`)
	if (!media.fingerprint) return null
	return (
		<Frame
			walk={walk}
			hint="Placed by how they differ from it. It sits where the lines cross."
		>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			{map && (
				<div className="grid items-center gap-4 md:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] md:gap-8">
					<div className={`px5 ${walk.busy ? "px-busy" : ""}`}>
						<span className="px5-y" style={{ gridArea: "top" }}>
							↑ {map.y.high}
						</span>
						<span
							className="px5-x"
							style={{ gridArea: "left", transform: "rotate(180deg)" }}
						>
							{map.x.low}
						</span>
						<div
							className="px5-s"
							style={
								{
									"--x": `${map.at.x}%`,
									"--y": `${map.at.y}%`,
								} as React.CSSProperties
							}
						>
							<span className="px5-c">
								<span className="px-p">
									<TmdbImage
										kind="poster"
										path={walk.center.poster}
										width={84}
										alt=""
									/>
								</span>
							</span>
							{map.points.map((point, index) => (
								<span
									key={`${point.type}-${point.id}`}
									className="px5-n"
									style={{ left: `${point.x}%`, top: `${point.y}%` }}
								>
									<Poster title={point} width={64} {...focus.handlers(index)} />
								</span>
							))}
						</div>
						<span className="px5-x" style={{ gridArea: "right" }}>
							{map.x.high}
						</span>
						<span className="px5-y" style={{ gridArea: "bottom" }}>
							↓ {map.y.low}
						</span>
					</div>
					<Caption pick={map.points[focus.index]} walk={walk} />
				</div>
			)}
		</Frame>
	)
}
