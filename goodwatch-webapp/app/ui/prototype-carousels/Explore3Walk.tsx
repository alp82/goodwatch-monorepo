// PROTOTYPE for "Prototype native-scroll carousels on title pages", second round. Throwaway code: not for production.
//
// Variant "explore3", a walk in place: six directions away from the title you stand on, one title per direction
// ("Funnier", "More crime"). A tap steps onto that title: it becomes the place you stand on, and the six directions
// are computed again from there. The trail leads back. Without script a tap opens the title's page.
//
// Real: the titles, the directions, and each step (one request to the prototype's endpoint per step).
// Faked: no map and no motion between steps, and no title actions.
import { Link } from "@remix-run/react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import {
	Frame,
	pathOf,
	useExploreWalk,
} from "~/ui/prototype-carousels/ExploreShared"

const CSS = `
.px3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem .5rem}
.px3-s{display:flex;flex-direction:column;align-items:center;gap:.25rem;min-width:0;text-align:center;border-radius:.75rem;
padding:.5rem .25rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
.px3-s:hover,.px3-s:focus-visible{background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.6)}
.px3-d{display:flex;align-items:center;justify-content:center;min-height:2rem;font-size:.8125rem;font-weight:800;line-height:1.1;color:#fcd34d}
.px3-s .px-p{width:4.25rem}
.px3-n{width:100%;font-size:.75rem;line-height:1.2;color:#d1d5db;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.px3-w{display:none}
@media (min-width:1024px){
.px3{grid-template-columns:repeat(6,minmax(0,1fr));gap:1rem}
.px3-s{padding:.75rem .5rem}
.px3-d{font-size:.9375rem}
.px3-s .px-p{width:6rem}
.px3-w{display:block;font-size:.75rem;line-height:1.25;color:#9ca3af;min-height:1.875rem}
}
`

export default function Explore3Walk({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const walk = useExploreWalk(media, "explore3")
	if (!media.fingerprint) return null
	return (
		<Frame
			walk={walk}
			hint="Step toward what you're in the mood for, and go on from there."
		>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			{walk.depth > 0 && (
				<p className="flex items-center gap-3">
					<span className="px-p w-12 shrink-0">
						<TmdbImage
							kind="poster"
							path={walk.center.poster}
							width={48}
							alt=""
							priority="eager"
						/>
					</span>
					<span className="min-w-0 flex-1">
						<span className="block text-xs uppercase tracking-wide text-gray-400">
							You are at
						</span>
						<span className="block truncate font-bold">
							{walk.center.title}{" "}
							<span className="font-normal text-gray-400">
								{walk.center.year}
							</span>
						</span>
					</span>
					<Link
						to={pathOf(walk.center)}
						prefetch="intent"
						className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-black hover:bg-amber-300"
					>
						Open
					</Link>
				</p>
			)}
			<div className={`px3 ${walk.busy ? "px-busy" : ""}`}>
				{(walk.model?.steps ?? []).map((step) => (
					<a
						key={`${step.type}-${step.id}`}
						href={pathOf(step)}
						className="px3-s"
						title={`${step.title} (${step.year}): ${step.why}`}
						onClick={(event) => {
							if (event.metaKey || event.ctrlKey || event.shiftKey) return
							event.preventDefault()
							void walk.step(step)
						}}
					>
						<span className="px3-d">{step.toward}</span>
						<span className="px-p">
							<TmdbImage kind="poster" path={step.poster} width={96} alt="" />
						</span>
						<span className="px3-n">
							{step.title} ({step.year})
						</span>
						<span className="px3-w">{step.why}</span>
					</a>
				))}
			</div>
		</Frame>
	)
}
