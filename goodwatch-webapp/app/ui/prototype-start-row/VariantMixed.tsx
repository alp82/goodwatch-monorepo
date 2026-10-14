// PROTOTYPE - throwaway (#541). Variant B, "Mixed": one rail where each hot title is followed by what is said about
// it: the trailer behind a click-to-load facade, a post, a headline. A title and its content form a group under one
// thin rule with the rank, so the rail reads as six small stories, not as twelve unrelated cards.
import { Link } from "@remix-run/react"
import { type Content, HOT, contentOf } from "./data"
import {
	DISPLAY,
	HeadlineCard,
	Move,
	PostCard,
	Rail,
	RowHead,
	VideoFacade,
	WhyChip,
	hrefOf,
	img,
} from "./kit"

const STORIES = HOT.filter((title) => contentOf(title.tmdb_id).length > 0).slice(0, 7)

function Card({ item }: { item: Content }) {
	if (item.kind === "video")
		return <VideoFacade video={item} about={false} className="w-[78vw] max-w-[340px] sm:w-[340px]" />
	if (item.kind === "post") return <PostCard post={item} about={false} className="h-full w-[74vw] max-w-[290px] sm:w-[290px]" />
	return <HeadlineCard item={item} about={false} className="h-full w-[70vw] max-w-[260px] sm:w-[260px]" />
}

export function VariantMixed() {
	return (
		<section aria-labelledby="talked-title" className="mb-14">
			<RowHead right={<p className="text-xs text-neutral-500">Videos play only when you press them · nothing loads from YouTube or Bluesky before</p>} />
			<Rail className="mt-5" gap="gap-8">
				{STORIES.map((title) => {
					const rank = HOT.indexOf(title) + 1
					return (
						<li key={title.tmdb_id} className="shrink-0">
							<p className="mb-3 flex items-center gap-2.5 border-t border-white/15 pt-2.5">
								<span className="text-sm font-black tabular-nums text-amber-300" style={DISPLAY}>
									#{rank}
								</span>
								<span className="truncate text-[17px] font-bold text-white" style={DISPLAY}>
									{title.title}
								</span>
								<Move move={title.move} />
							</p>
							<div className="flex items-stretch gap-3">
								<Link
									to={hrefOf(title)}
									discover="none"
									className="group flex w-[150px] shrink-0 snap-start flex-col rounded-xl bg-white/[0.04] p-2 ring-1 ring-inset ring-white/10 hover:ring-amber-300/60"
								>
									<img
										src={img(title.poster_path)}
										alt={`${title.title} poster`}
										width={134}
										height={201}
										loading="lazy"
										className="aspect-[2/3] w-full rounded-lg object-cover"
									/>
									<span className="mt-2 px-0.5">
										<WhyChip why={title.why} small />
										<span className="mt-1 line-clamp-2 block text-[12px] leading-snug text-neutral-400">
											{title.why.detail}
										</span>
									</span>
								</Link>
								{contentOf(title.tmdb_id).map((item) => (
									<div key={item.id} className="shrink-0 snap-start">
										<Card item={item} />
									</div>
								))}
							</div>
						</li>
					)
				})}
			</Rail>
		</section>
	)
}
