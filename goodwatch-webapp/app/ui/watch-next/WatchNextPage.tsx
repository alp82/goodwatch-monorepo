// The Watch next page: the docked strip on the hero (phones: the slab's buttons and drawers at the bottom), the hero
// with its Then column, the stepped grid, suggestions while the Wishlist is short, and the sign-up prompt for guests.
import { useCallback, useState } from "react"
import { type MoodKey, toggleMood } from "~/domain/moods"
import type { WatchNextSort } from "~/domain/watch-next"
import { useFeature } from "~/hooks/useFeature"
import { useWishlistMutation } from "~/hooks/useUserDataMutations"
import { useUserData } from "~/routes/api.user-data"
import type { TitleCard } from "~/server/title-cards.server"
import type { WatchNext } from "~/server/watch-next.server"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { UndoToast } from "~/ui/title-actions/UndoToast"
import { type HideFeedback, HideFeedbackContext } from "~/ui/title-actions/hide-feedback"
import { DockedStrip } from "./DockedStrip"
import { FinishPrompt, FinishToast } from "./FinishPrompt"
import { type MoodControl, refusalText } from "./MoodPicker"
import { PhoneControls } from "./PhoneControls"
import { SteppedGrid, WorthAdding } from "./SteppedGrid"
import { WatchNextHero } from "./WatchNextHero"
import { MoviesPageContext, type MoviesPageParts } from "./movies-page"
import { WRAP } from "./style"
import { useFinish } from "./useFinish"
import {
	useRefreshAfterMarks,
	useRefreshWatchNext,
	useWatchNext,
} from "./useWatchNext"

export function WatchNextPage({
	initial,
	movies,
}: {
	initial: { query: string; data: WatchNext | null }
	/** My movies (#385): this page for the Wishlist's movies, with the pieces of its "How long?" choice. */
	movies?: MoviesPageParts
}) {
	const state = useWatchNext(initial, Boolean(movies))
	const { data, choice, setChoice } = state
	const showMatch = useFeature("tasteMatch")
	const finishing = useFinish()
	const refresh = useRefreshWatchNext()
	const { mutate: updateWishlist } = useWishlistMutation()
	const { data: userData } = useUserData()
	useRefreshAfterMarks()

	// Not interested on a card: the title leaves the page at once, so the Undo is a toast instead of a tile in the grid.
	const [hid, setHid] = useState<{
		id: number
		text: string
		undo: () => void
	} | null>(null)
	const onHide = useCallback<HideFeedback>(
		(media, undo) =>
			setHid({
				id: Date.now(),
				text: `${media.details.title} is hidden from your recommendations`,
				undo,
			}),
		[],
	)
	const dismissHid = useCallback(() => setHid(null), [])

	// Moods: the dropdown's state and the refusal of a fourth pick, announced politely.
	const [moodsOpen, setMoodsOpen] = useState(false)
	const [refused, setRefused] = useState<MoodControl["refused"]>(null)
	const [announcement, setAnnouncement] = useState("")
	const toggle = useCallback(
		(mood: MoodKey) => {
			const result = toggleMood(choice.moods, mood)
			if (result.refused) {
				setRefused({ mood, at: Date.now() })
				// A trailing space when the text repeats, so screen readers announce it again.
				setAnnouncement((before) =>
					before === refusalText(mood)
						? `${refusalText(mood)} `
						: refusalText(mood),
				)
				return
			}
			setChoice({ moods: result.moods })
		},
		[choice.moods, setChoice],
	)

	const want = useCallback(
		(card: TitleCard) => {
			const on = Boolean(
				userData?.wishlist[`${card.media_type}-${card.tmdb_id}`],
			)
			updateWishlist(
				{
					mediaType: card.media_type,
					tmdbId: card.tmdb_id,
					action: on ? "remove" : "add",
				},
				{ onSuccess: () => refresh() },
			)
		},
		[userData, updateWishlist, refresh],
	)
	const isWanted = (card: TitleCard) =>
		Boolean(userData?.wishlist[`${card.media_type}-${card.tmdb_id}`])

	const moods: MoodControl | null = data && {
		moods: data.moods,
		counts: data.moodCounts,
		pictures: data.moodPictures,
		countScope: data.onMyServices
			? "on your services"
			: movies
				? "of your movies"
				: "on your Wishlist",
		open: moodsOpen,
		setOpen: setMoodsOpen,
		toggle,
		clear: () => setChoice({ moods: [] }),
		refused,
	}

	const setOnMyServices = (on: boolean) => setChoice({ onMyServices: on })
	// The default sort stays out of the URL.
	const setSort = (sort: WatchNextSort) =>
		setChoice({ sort: sort === data?.defaultSort ? null : sort })

	const setTime = (time: number | null) => setChoice({ time })
	const time = data?.time ?? choice.time ?? null

	const strip =
		data && moods ? (
			<DockedStrip
				data={data}
				moods={moods}
				setOnMyServices={setOnMyServices}
				setSort={setSort}
				extra={movies?.timeControl(time, setTime)}
			/>
		) : (
			<div
				className="h-14 animate-pulse rounded-2xl bg-black/45 ring-1 ring-white/10"
				aria-hidden
			/>
		)

	const guestStage =
		data?.bestMatch.prompt === "signUpToKeep" ? "keep" : "learn"

	const page = (
		<div
			className="overflow-x-clip pb-24"
			data-watch-next
			data-my-movies={movies ? "" : undefined}
		>
			{movies ? movies.head(data) : <h1 className="sr-only">Watch next</h1>}
			<output aria-live="polite" className="sr-only">
				{announcement}
			</output>
			<WatchNextHero
				data={data}
				strip={strip}
				showMatch={showMatch}
				onFinish={finishing.finish}
				onPass={(title) => state.pass(title.key)}
				onWant={want}
			/>
			{state.isError && (
				<div className={`${WRAP} pt-6`} role="alert">
					<p className="text-gray-300">
						{movies ? "My movies" : "Watch next"} couldn't load.{" "}
						<button
							type="button"
							className="cursor-pointer underline"
							onClick={() => state.refetch()}
						>
							Try again
						</button>
					</p>
				</div>
			)}
			{data && (
				<div
					className={`${WRAP} pt-8 transition-opacity ${state.isFetching && !state.isLoading ? "opacity-80" : ""}`}
				>
					<HideFeedbackContext.Provider value={onHide}>
						<SteppedGrid data={data} state={state} showMatch={showMatch} />
						<WorthAdding data={data} onWant={want} isWanted={isWanted} />
					</HideFeedbackContext.Provider>
					{state.guest && (
						<SignUpPrompt
							feature="watchNext"
							stage={guestStage}
							size="card"
							className="mt-10 max-w-xl"
						/>
					)}
				</div>
			)}
			<PhoneControls
				data={data}
				moods={moods}
				setOnMyServices={setOnMyServices}
				setSort={setSort}
				extra={
					movies && {
						key: "time",
						title: "How long?",
						label: movies.phoneTime.label(time),
						icon: movies.phoneTime.icon(time),
						on: time !== null,
						body: movies.phoneTime.drawer(time, setTime),
					}
				}
			/>
			<FinishPrompt
				finished={finishing.prompt}
				onClose={finishing.closePrompt}
			/>
			<FinishToast
				toast={finishing.toast}
				data={data}
				onUndo={finishing.undo}
				onDismiss={finishing.dismissToast}
			/>
			<UndoToast
				toast={hid}
				onUndo={() => {
					hid?.undo()
					setHid(null)
				}}
				onDismiss={dismissHid}
				className="bottom-40 lg:bottom-6"
			/>
		</div>
	)
	return movies ? (
		<MoviesPageContext.Provider value>{page}</MoviesPageContext.Provider>
	) : (
		page
	)
}
