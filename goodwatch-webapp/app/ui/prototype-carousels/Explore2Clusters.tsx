// PROTOTYPE for "Prototype native-scroll carousels on title pages", second round. Throwaway code: not for production.
//
// Variant "explore2", clusters: four small islands, each named by how its titles differ from this one ("Funnier")
// and by what they still share with it ("same future setting"). The heading is the reason of every title on the
// island. Nothing to operate: every poster is a link.
//
// Real: the titles, the clusters, and their headings (explore-model.ts). Faked: the island look is a tinted box,
// not the Explorer's map, and a poster's own reason shows only as its hover text.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	Frame,
	Poster,
	useExploreWalk,
} from "~/ui/prototype-carousels/ExploreShared"

const CSS = `
.px2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.625rem}
.px2-i{display:flex;flex-direction:column;gap:.5rem;padding:.625rem .625rem .75rem;border-radius:1.5rem 1rem 1.75rem 1.125rem;
border:1px solid color-mix(in srgb,var(--k) 45%,transparent);
background:radial-gradient(120% 90% at 30% 0%,color-mix(in srgb,var(--k) 30%,transparent),rgba(255,255,255,.03) 70%)}
.px2-h{min-height:3.25rem;line-height:1.15}
.px2-h b{display:block;font-size:1rem;font-weight:800}
.px2-h span{font-size:.75rem;color:#d1d5db}
.px2-r{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.375rem;margin-top:auto}
.px2-r>:nth-child(4){display:none}
@media (min-width:1024px){
.px2{grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem}
.px2-i{padding:1rem}
.px2-h b{font-size:1.125rem}
.px2-h span{font-size:.8125rem}
.px2-r{grid-template-columns:repeat(4,minmax(0,1fr));gap:.5rem}
.px2-r>:nth-child(4){display:block}
}
`

export default function Explore2Clusters({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const walk = useExploreWalk(media, "explore2")
	if (!media.fingerprint) return null
	return (
		<Frame walk={walk} hint="Close to it, and each group leans another way.">
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of this file. */}
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			<div className="px2">
				{(walk.model?.clusters ?? []).map((cluster) => (
					<div
						key={cluster.heading}
						className="px2-i"
						style={{ "--k": cluster.color } as React.CSSProperties}
					>
						<h3 className="px2-h">
							<b>{cluster.heading}</b>
							<span>{cluster.shared}</span>
						</h3>
						<div className="px2-r">
							{cluster.titles.map((title) => (
								<Poster
									key={`${title.type}-${title.id}`}
									title={title}
									width={64}
									prefetch="intent"
									aria-label={`${title.title} (${title.year}): ${title.why}`}
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</Frame>
	)
}
