import { BookmarkIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { ForwardIcon } from "@heroicons/react/24/solid"
import React, { useEffect, useState } from "react"
import { useOnboardingMedia } from "~/routes/api.onboarding.media"
import { useUserData } from "~/routes/api.user-data"
import type { OnboardingResult } from "~/server/onboarding-media.server"
import type { GetUserDataResult } from "~/server/userData.server"
import { Poster } from "~/ui/Poster"
import { Spinner } from "~/ui/Spinner"
import NextBackButtons from "~/ui/button/NextBackButtons"
import { TextInput } from "~/ui/form/TextInput"
import ScoreSelector from "~/ui/user/ScoreSelector"
import SkipButton from "~/ui/user/SkipButton"
import ToWatchButton from "~/ui/user/ToWatchButton"
import { useAutoFocus } from "~/utils/form"
import { useDebounce } from "~/utils/timing"
import { getSortedUserData } from "~/utils/user-data"

export interface SelectMediaProps {
	onSelect: () => void
	onBack: () => void
}

export const SelectMedia = ({ onSelect, onBack }: SelectMediaProps) => {
	// search state
	const autoFocusRef = useAutoFocus<HTMLInputElement>()
	const [searchTerm, setSearchTerm] = useState("")
	const debouncedSearchTerm = useDebounce(searchTerm, 200)

	const handleSearchByTerm = (term: string) => {
		if (term.length === 1) return
		setSearchTerm(term)
	}

	// get media titles for rating and user scores

	const onboardingMedia = useOnboardingMedia({
		searchTerm: debouncedSearchTerm,
	})
	const movies = onboardingMedia.data?.movies || []
	const tv = onboardingMedia.data?.tv || []

	const { data: userData } = useUserData()

	// media titles to display

	const [previousMediaToDisplay, setPreviousMediaToDisplay] = useState<
		OnboardingResult | undefined
	>()

	const handlePreviousMediaToggle = (media: OnboardingResult) => {
		if (previousMediaToDisplay?.tmdb_id === media.tmdb_id) {
			setPreviousMediaToDisplay(undefined)
		} else {
			setPreviousMediaToDisplay(media)
		}
	}
	const handlePreviousMediaHide = () => {
		setPreviousMediaToDisplay(undefined)
	}
	const tmdb_ids = [
		...movies.map((m) => m.tmdb_id),
		...tv.map((m) => m.tmdb_id),
	].join(",")
	useEffect(() => {
		if (!previousMediaToDisplay) return
		handlePreviousMediaHide()
	}, [tmdb_ids])

	const allMedia = [
		...(previousMediaToDisplay ? [previousMediaToDisplay] : []),
		...movies,
		...tv,
	]

	const sortedMedia = getSortedUserData(userData as GetUserDataResult, [
		"onScoresSince",
		"onSkippedSince",
		"onWishListSince",
	])
	const scoredMediaNumber = getSortedUserData(userData as GetUserDataResult, [
		"onScoresSince",
	]).length

	// skip and wishlist actions

	const handleSkip = (media: OnboardingResult) => {
		if (
			media.tmdb_id !== previousMediaToDisplay?.tmdb_id ||
			media.media_type !== previousMediaToDisplay?.media_type
		) {
			return
		}

		setPreviousMediaToDisplay(undefined)
	}

	const handleToWatch = (media: OnboardingResult) => {
		if (
			media.tmdb_id !== previousMediaToDisplay?.tmdb_id ||
			media.media_type !== previousMediaToDisplay?.media_type
		) {
			return
		}

		setPreviousMediaToDisplay(undefined)
	}

	// score display

	const getBgColorName = (score: number | null) => {
		const vibeColorIndex = (score || -1) * 10
		return `bg-vibe-${vibeColorIndex}`
	}

	let scoreCountHint = ""
	if (sortedMedia.length > 30) {
		scoreCountHint =
			"Keep going! The more you rate, the better your recommendations."
	} else if (sortedMedia.length > 20) {
		scoreCountHint =
			"Nice! Aim for 30 ratings and you'll get more personalized results."
	} else if (sortedMedia.length > 10) {
		scoreCountHint = "Good start! Rate 20+ titles for for even better results."
	} else {
		scoreCountHint = "Please rate at least 10 titles to get recommendations."
	}
	const didntScoreEnoughForRecommendations = sortedMedia.length < 10

	// handle navigation

	const handleMediaRatingsConfirmed = () => {
		onSelect()
	}

	const handleMediaRatingsBack = () => {
		onBack()
	}

	const getMedia = (media: OnboardingResult[]) => {
		return (
			<div className="w-full flex flex-wrap gap-8">
				{media.length > 0 && (
					<div className="w-full flex flex-col gap-14">
						{media.map((details) => (
							<div
								key={details.tmdb_id}
								className="relative w-full flex flex-col bg-gray-700 border-slate-800 border-2 shadow-2xl bg-cover bg-center bg-no-repeat before:absolute before:top-0 before:bottom-0 before:right-0 before:left-0 before:bg-black/[.78]"
								style={{
									backgroundImage: `url('https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${details.backdrop_path}')`,
								}}
							>
								<div className="relative">
									<div className="flex">
										<div className="hidden md:block self-center p-2 sm:p-4 w-80">
											<Poster
												path={details.poster_path}
												title={details.title}
											/>
										</div>

										<div className="w-full flex flex-col justify-between gap-2 sm:gap-4 md:gap-6 p-4 sm:p-6 md:p-8">
											<div className="flex justify-between gap-2">
												<div className="text-3xl md:text-4xl">
													<span className="font-bold">{details.title}</span>
													<span className="text-slate-400">
														{" "}
														({details.release_year})
													</span>
												</div>
												<div className="md:hidden w-20">
													<Poster
														path={details.poster_path}
														title={details.title}
													/>
												</div>
											</div>
											{/*<Genres genres={details.genres} withLinks={false} />*/}
											<div>
												<ScoreSelector details={details} />
											</div>
											<div className="flex flex-wrap md:flex-nowrap justify-between gap-6 p-2 sm:p-4">
												<SkipButton
													details={details}
													onChange={() => handleSkip(details)}
												/>
												<ToWatchButton
													details={details}
													onChange={() => handleToWatch(details)}
												/>
											</div>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		)
	}

	return (
		<>
			<div className="grid grid-cols-4 sm:grid-cols-8 gap-2 justify-end justify-items-end items-end place-items-end">
				{sortedMedia
					.slice(0, 8)
					.reverse()
					.map((details) => (
						<div
							key={details.tmdb_id}
							className={`relative cursor-pointer transition-all hover:scale-105 hover:rotate-3 border-8 rounded-2xl ${previousMediaToDisplay?.tmdb_id === details.tmdb_id ? "border-emerald-500" : "border-slate-800"}`}
							onClick={() => handlePreviousMediaToggle(details)}
							onKeyDown={() => null}
						>
							<Poster path={details.poster_path} title={details.title} />
							<div className="absolute top-0 bottom-0 left-0 right-0 flex items-center justify-center">
								{details.score && (
									<span
										className={`w-8 sm:w-12 md:w-16 h-8 sm:h-12 md:h-16 p-2 sm:p-3 md:p-4 flex items-center justify-center rounded-full ${getBgColorName(details.score)} text-white text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold`}
									>
										{details.score}
									</span>
								)}
								{details.onWishList && (
									<span className="w-8 sm:w-12 md:w-16 h-8 sm:h-12 md:h-16 p-2 sm:p-3 md:p-4 flex items-center justify-center rounded-full bg-black/70 text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">
										<BookmarkIcon className="text-amber-500" />
									</span>
								)}
								{details.onSkipped && (
									<span className="w-8 sm:w-12 md:w-16 h-8 sm:h-12 md:h-16 p-2 sm:p-3 md:p-4 flex items-center justify-center rounded-full bg-black/70 text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold">
										<ForwardIcon className="text-pink-500" />
									</span>
								)}
							</div>
						</div>
					))}
			</div>
			<div className="w-full flex flex-wrap items-center justify-center text-center">
				<span className="font-bold">
					You rated
					<strong className="mx-2 px-2 bg-indigo-800">
						{scoredMediaNumber}
					</strong>
					titles.
				</span>
				&nbsp;{scoreCountHint}
			</div>
			<div className="w-full flex items-center justify-center">
				<NextBackButtons
					nextLabel={
						didntScoreEnoughForRecommendations ? "Skip for now" : "Finish"
					}
					onNext={handleMediaRatingsConfirmed}
					onBack={handleMediaRatingsBack}
				/>
			</div>
			<div className="mt-6 w-full flex items-center justify-center">
				<TextInput
					label="Search"
					placeholder="Search Movies and Shows"
					icon={
						onboardingMedia.isLoading ? (
							<Spinner size="small" />
						) : (
							<MagnifyingGlassIcon
								className="h-5 w-5 text-gray-400"
								aria-hidden="true"
							/>
						)
					}
					onChange={handleSearchByTerm}
					ref={autoFocusRef}
				/>
			</div>
			{onboardingMedia.isFetching ? (
				<Spinner size="large" />
			) : (
				getMedia(allMedia)
			)}
			<div className="w-full flex items-center justify-center">
				<NextBackButtons
					nextLabel={
						didntScoreEnoughForRecommendations ? "Skip for now" : "Finish"
					}
					onNext={handleMediaRatingsConfirmed}
					onBack={handleMediaRatingsBack}
				/>
			</div>
		</>
	)
}
