// The lower-third band under the poster on the big screen: title, year, scores, a short synopsis, and the title's own
// control (the same Seen, score, Wishlist and Not interested as the quick view).
import type { ExplorerCard, ExplorerTitle } from "~/domain/explorer"
import { type TitleChange, TitleControl } from "~/ui/title-actions/TitleControl"
import { matchColor } from "./color"
import { titlePath } from "./titlePath"

export function ScreenDetails({
	title,
	where,
	card,
	phone,
	onChange,
	onBack,
}: {
	title: ExplorerTitle
	where: { name: string; color: string }
	card: ExplorerCard | null
	phone: boolean
	onChange?: (change: TitleChange) => void
	onBack: () => void
}) {
	const meta = [
		title.year ? String(title.year) : "",
		title.mediaType === "show" ? "Show" : "Movie",
		title.genres.slice(0, 2).join(" and ").toLowerCase(),
	]
		.filter(Boolean)
		.join(" · ")
	const story = card?.title.overview
	return (
		<div className="relative">
			<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
			<div
				className={`mx-auto flex max-w-6xl gap-6 px-5 ${phone ? "flex-col pt-4 pb-4" : "items-end pt-5 pb-6 md:px-8"}`}
			>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 text-[10.5px] font-bold tracking-[0.3em] text-amber-300/90 uppercase">
						<span
							className="size-2 shrink-0 rounded-full"
							style={{
								background: where.color,
								boxShadow: `0 0 8px ${where.color}`,
							}}
						/>
						<span className="truncate">
							Feature presentation · {where.name}
						</span>
					</div>
					<h2
						className={`mt-1.5 truncate font-extrabold leading-tight text-white ${phone ? "text-[26px]" : "text-[38px]"}`}
					>
						{title.title}
					</h2>
					<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px] text-gray-300">
						<span>{meta}</span>
						{title.score != null && (
							<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-0.5 font-bold text-amber-300 ring-1 ring-amber-400/30">
								{title.score}
								<span className="text-[11px] font-semibold text-amber-200/70">
									GoodWatch
								</span>
							</span>
						)}
						{title.match != null && !card?.signUp && (
							<span
								className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 font-bold ring-1 ring-white/10"
								style={{ color: matchColor(title.match) }}
							>
								{title.match}%
								<span className="text-[11px] font-semibold text-gray-400">
									match
								</span>
							</span>
						)}
					</div>
					<p
						className={`mt-2.5 max-w-2xl text-[14px] leading-5 line-clamp-3 h-[60px] ${story ? "text-gray-300" : "text-gray-600"}`}
					>
						{card ? story || "No overview yet." : "Rolling the reel…"}
					</p>
					<div className="mt-3 flex items-center gap-4 text-[13px]">
						<a
							href={titlePath(title)}
							className="font-semibold text-amber-300 hover:text-amber-200"
						>
							Open the title page →
						</a>
						<button
							type="button"
							onClick={onBack}
							className="text-gray-400 hover:text-white"
						>
							{phone ? "Back to the map" : "Back to the map (scroll out, Esc)"}
						</button>
					</div>
				</div>
				<div
					className={`flex shrink-0 flex-col gap-2 ${phone ? "w-full" : "w-[300px]"}`}
				>
					<TitleControl
						media={{
							mediaType: title.mediaType,
							details: {
								tmdb_id: title.tmdbId,
								title: title.title,
								poster_path: title.poster,
								release_year: title.year,
							},
						}}
						place="view"
						layer="z-[1300]"
						onChange={onChange}
					/>
				</div>
			</div>
		</div>
	)
}
