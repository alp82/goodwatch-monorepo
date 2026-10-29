// What the member does with the title: Seen and score first, then Want to See beside Not interested, then where to
// watch in one row that goes to the full section.
import { ChevronRightIcon } from "@heroicons/react/24/outline"
import { useRef } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { LIST, ROW } from "~/ui/details/page-ui"
import { useStreamNames } from "~/ui/details/streaming"
import { countryName } from "~/ui/details/title-words"
import { ActionButton } from "~/ui/title-actions/ActionButton"
import SeenScore from "~/ui/title-actions/SeenScore"
import { useTitleActions } from "~/ui/title-actions/useTitleActions"
import { useUndoToast, warmUndoToast } from "~/ui/title-actions/useUndoToast"
import { useReplayedTap } from "~/utils/useReplayedTap"

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

/** Want to See, and production's Not interested beside it: same size and words on and off, pink when it's on. */
function ActRow({ media }: { media: Media }) {
	const a = useTitleActions(media)
	const toast = useUndoToast()
	// The row is in the server's HTML, so a tap can come before the app's script (utils/replay-tap.ts). The mark
	// carries the state the button showed: a button that reads otherwise by now doesn't get the tap.
	const row = useRef<HTMLDivElement>(null)
	useReplayedTap("want", (el) => Boolean(row.current?.contains(el)))
	return (
		<div
			ref={row}
			className="flex items-center gap-2"
			onPointerEnter={warmUndoToast}
			onFocus={warmUndoToast}
		>
			<ActionButton
				kind="want"
				label="long"
				size="sm"
				className="flex-1"
				rewatch={a.seen}
				active={a.want}
				disabled={a.wantPending}
				data-replay-tap={`want:${a.want ? "on" : "off"}`}
				onClick={a.toggleWant}
			/>
			{(a.canHide || a.hidden) && (
				<ActionButton
					kind="hide"
					label="wide"
					size="sm"
					className="max-sm:w-9 max-sm:flex-none sm:flex-1"
					active={a.hidden}
					disabled={a.hidePending}
					title={
						a.hidden
							? "Hidden from your recommendations. Press to bring it back."
							: "Hide it from your recommendations"
					}
					onClick={() => {
						if (a.hidden) a.unhide()
						else {
							const undo = a.hide()
							toast.say(
								`${media.details.title} is hidden from your recommendations`,
								undo,
							)
						}
					}}
				/>
			)}
			{toast.node}
		</div>
	)
}

export function YouBlock({
	media,
	country,
	onWatch,
}: { media: Media; country: string; onWatch: () => void }) {
	return (
		<div className="flex flex-col gap-2.5">
			<SeenScore media={media} className="w-full" />
			<ActRow media={media} />
			<div className={`mt-1 ${LIST}`}>
				<WatchRow media={media} country={country} onWatch={onWatch} />
			</div>
		</div>
	)
}
