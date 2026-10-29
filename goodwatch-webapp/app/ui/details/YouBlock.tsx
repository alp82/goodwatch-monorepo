// What the member does with the title: the title's own control (Seen and score, then Want to See beside Not
// interested; for a member's show also its tracking: status, progress, Next episode, rating prompts, Undo and the
// date dialog), then where to watch in one row that goes to the full section.
import { ChevronRightIcon } from "@heroicons/react/24/outline"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { LIST, ROW } from "~/ui/details/page-ui"
import { useStreamNames } from "~/ui/details/streaming"
import { countryName } from "~/ui/details/title-words"
import { TitleControl } from "~/ui/title-actions/TitleControl"

type Media = MovieResult | ShowResult

/** Where to watch in one row: the first service's logo and "Stream on Apple TV +2"; a press goes to the section. */
function WatchRow({
	media,
	country,
	onWatch,
}: { media: Media; country: string; onWatch: () => void }) {
	const { stream, rentBuy } = useStreamNames(media, country)
	const list = stream.length ? stream : rentBuy
	const first = list[0]
	const verb = stream.length
		? "Stream on"
		: rentBuy.some((s) => s.type === "rent")
			? "Rent or buy on"
			: "Buy on"
	return (
		<button type="button" onClick={onWatch} className={`${ROW} h-12`}>
			<span className="flex w-8 shrink-0 justify-center">
				{first ? (
					<TmdbImage
						kind="logo"
						path={first.logoPath}
						width={28}
						ratio={1}
						alt=""
						className={`h-7 w-7 rounded-md ${first.owned ? "ring-2 ring-green-500" : "ring-1 ring-white/10"}`}
					/>
				) : (
					<span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.05] text-gray-500 ring-1 ring-white/10">
						–
					</span>
				)}
			</span>
			<span className="min-w-0 flex-1 truncate text-sm">
				{first ? (
					<>
						<span className="text-gray-400">{verb} </span>
						<span className="font-semibold text-white">{first.name}</span>
						{list.length > 1 && (
							<span className="text-gray-400"> +{list.length - 1}</span>
						)}
					</>
				) : (
					<span className="text-gray-300">
						Not streaming in {countryName(country)}
					</span>
				)}
			</span>
			<ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-500 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-gray-300" />
		</button>
	)
}

export function YouBlock({
	media,
	country,
	onWatch,
}: { media: Media; country: string; onWatch: () => void }) {
	return (
		<div className="flex flex-col gap-2.5">
			<TitleControl media={media} />
			<div className={`mt-1 ${LIST}`}>
				<WatchRow media={media} country={country} onWatch={onWatch} />
			</div>
		</div>
	)
}
