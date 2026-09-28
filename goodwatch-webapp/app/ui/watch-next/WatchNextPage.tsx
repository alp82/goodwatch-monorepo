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
import { DockedStrip } from "./DockedStrip"
import { FinishPrompt, FinishToast } from "./FinishPrompt"
import { type MoodControl, refusalText } from "./MoodPicker"
import { PhoneControls } from "./PhoneControls"
import { SteppedGrid, WorthAdding } from "./SteppedGrid"
import { WatchNextHero } from "./WatchNextHero"
import { WRAP } from "./style"
import { useFinish } from "./useFinish"
import { useRefreshWatchNext, useWatchNext } from "./useWatchNext"

export function WatchNextPage({
	initial,
}: {
	initial: { query: string; data: WatchNext | null }
}) {
	const state = useWatchNext(initial)
	const { data, choice, setChoice } = state
	const showMatch = useFeature("tasteMatch")
	const finishing = useFinish()
	const refresh = useRefreshWatchNext()
	const { mutate: updateWishlist } = useWishlistMutation()
	const { data: userData } = useUserData()

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
		countScope: data.onMyServices ? "on your services" : "on your Wishlist",
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

	const strip =
		data && moods ? (
			<DockedStrip
				data={data}
				moods={moods}
				setOnMyServices={setOnMyServices}
				setSort={setSort}
			/>
		) : (
			<div
				className="h-14 animate-pulse rounded-2xl bg-black/45 ring-1 ring-white/10"
				aria-hidden
			/>
		)

	const guestStage =
		data?.bestMatch.prompt === "signUpToKeep" ? "keep" : "learn"

	return (
		<div className="overflow-x-clip pb-24" data-watch-next>
			<h1 className="sr-only">Watch next</h1>
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
						Watch next couldn't load.{" "}
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
					<SteppedGrid data={data} state={state} showMatch={showMatch} />
					<WorthAdding data={data} onWant={want} isWanted={isWanted} />
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
		</div>
	)
}
