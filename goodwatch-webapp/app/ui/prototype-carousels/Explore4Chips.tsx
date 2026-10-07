// PROTOTYPE for "Prototype native-scroll carousels on title pages", second round. Throwaway code: not for production.
//
// Variant "explore4", trait chips: what this title is known for as chips, and the chosen chip decides which six
// titles show and why ("Even more tension, but faster"). The chips are radio buttons and the panels are picked by
// CSS, so the control works without script and before hydration. Every panel's links are in the server HTML.
//
// Real: the titles, the chips (the title's highlight attributes), and the reasons (explore-model.ts), all taken
// from the 64 related titles of the overall panel. Faked: today's tabs ask the server for a list per attribute,
// which reaches further than these 64.
import { Link } from "@remix-run/react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import {
	Frame,
	pathOf,
	useExploreWalk,
} from "~/ui/prototype-carousels/ExploreShared"

const CHIPS = [0, 1, 2, 3, 4]
const CSS = `
.px4-c{display:flex;gap:.5rem;overflow-x:auto;scrollbar-width:none;padding:4px 2px}
.px4-c::-webkit-scrollbar{display:none}
.px4-c input{position:absolute;opacity:0;pointer-events:none}
.px4-c label{flex:none;cursor:pointer;border-radius:9999px;border:1px solid rgba(255,255,255,.2);padding:.375rem .75rem;
font-size:.875rem;font-weight:600;white-space:nowrap}
.px4-c label:hover{background:rgba(255,255,255,.1)}
.px4-c input:checked+label{background:#fbbf24;border-color:#fbbf24;color:#000}
.px4-c input:focus-visible+label{outline:2px solid #fff;outline-offset:1px}
.px4-p{display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:.625rem .75rem}
${CHIPS.map((i) => `.px4:has(#px4-${i}:checked) .px4-p[data-p="${i}"]`).join(",")}{display:grid}
.px4-t{display:flex;gap:.5rem;min-width:0;align-items:flex-start}
.px4-t .px-p{width:2.875rem;height:auto;aspect-ratio:2/3;flex:none}
.px4-t b{display:block;font-size:.8125rem;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.px4-t i{font-style:normal;font-weight:400;color:#9ca3af}
.px4-t p{font-size:.75rem;line-height:1.25;color:#d1d5db}
.px4-t b{color:#fff;margin-bottom:.125rem}
.px4-t:hover b{text-decoration:underline}
@media (min-width:1024px){
.px4-p{grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem 1.5rem}
.px4-t .px-p{width:3.75rem}
.px4-t b{font-size:1rem}
.px4-t p{font-size:.875rem}
}
`

export default function Explore4Chips({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const walk = useExploreWalk(media, "explore4")
	if (!media.fingerprint) return null
	const chips = walk.model?.chips ?? []
	return (
		<Frame walk={walk} more={false} hint="Pick what you liked about it.">
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			<div className="px4 flex flex-col gap-4">
				<div className="px4-c" role="radiogroup" aria-label="What to keep">
					{chips.map((chip, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: the ids are the positions the CSS knows.
						<span key={index}>
							<input
								type="radio"
								name="px4"
								id={`px4-${index}`}
								defaultChecked={index === 0}
							/>
							<label htmlFor={`px4-${index}`}>{chip.label}</label>
						</span>
					))}
				</div>
				{chips.map((chip, index) => (
					<div key={chip.key} className="px4-p" data-p={index}>
						{chip.titles.map((title) => (
							<Link
								key={`${title.type}-${title.id}`}
								to={pathOf(title)}
								prefetch="intent"
								className="px4-t"
							>
								<TmdbImage
									kind="poster"
									path={title.poster}
									width={60}
									alt=""
									className="px-p"
								/>
								<p className="min-w-0">
									<b>
										{title.title} <i>{title.year}</i>
									</b>
									{title.why}
								</p>
							</Link>
						))}
					</div>
				))}
			</div>
		</Frame>
	)
}
