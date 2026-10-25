// Guests: the same page, locked. The heading and the print sit where a member's do, with the guest's own taste print
// (or the example taste, labeled so) drawn without handles; beside it the one call to action. Below, twelve posters
// picked for that taste sit in a static grid under one blur, a dark wash and a lock.
// - Fewer than QUIZ_GOAL scores: "Take the quiz". QUIZ_GOAL or more (the quiz is done): "Sign up".
// - The guest's progress lives in this browser, so it is posted to /api/for-you/pool, again whenever it changes.
//   Until the page has read it (the server's HTML can't know it), the call to action keeps its room but shows neither.
// The blur sits on a container that never animates; nothing moves under it.
import { LockClosedIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import type { ForYouGuest } from "~/domain/for-you-page/contract"
import { DISPLAY } from "~/ui/my-pages/bits"
import { useSignUpHref } from "~/ui/navigation/bits"
import { Whorl } from "~/ui/profile/taste/Whorl"
import { QUIZ_GOAL } from "~/ui/taste-quiz/quiz-flow"
import type { TasteInteraction } from "~/ui/taste/types"
import {
	snapshotGuestProgress,
	useGuestInteractions,
} from "~/utils/guest-progress"
import { useHydrated } from "~/utils/hydrated"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { Heading } from "./Heading"
import { posterSrc } from "./context"

/** What the browser sends: the guest progress, as /api/taste/portrait takes it. */
export interface GuestProgressBody {
	interactions: TasteInteraction[]
	country: string | null
	services: string | null
}
export type GuestLoader = (
	progress: GuestProgressBody,
	language: string,
) => Promise<ForYouGuest>

const POSTERS = 12
const QUIZ_PATH = "/taste/quiz"

export async function fetchGuest(
	progress: GuestProgressBody,
	language: string,
): Promise<ForYouGuest> {
	const response = await fetch(
		mediaLanguageUrl("/api/for-you/pool", language),
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ guest: progress }),
		},
	)
	if (!response.ok) throw new Error(`For you preview: ${response.status}`)
	return (await response.json()) as ForYouGuest
}

const scoresIn = (interactions: TasteInteraction[]) =>
	interactions.filter((i) => i.type === "score").length

export function GuestLock({ load = fetchGuest }: { load?: GuestLoader }) {
	const { locale } = useLocale()
	const interactions = useGuestInteractions()
	// The browser's progress is read from the first render after hydration on.
	const read = useHydrated()
	const preview = useQuery({
		queryKey: ["for-you-guest", interactions, locale.language],
		// Keep showing the last preview while a new rating recomputes it.
		placeholderData: (previous) => previous,
		queryFn: () => {
			const { interactions, country, services } = snapshotGuestProgress()
			return load({ interactions, country, services }, locale.language)
		},
	})
	const ratings = preview.data?.guestRatings ?? scoresIn(interactions)
	const done = ratings >= QUIZ_GOAL
	const taste = preview.data?.taste ?? null
	const example = !taste || taste.subject === "sample"
	const posters = preview.data?.posters ?? []

	return (
		<div
			className="mx-auto max-w-[1600px] overflow-x-clip px-4 pt-5 pb-28 md:px-8 lg:pb-10"
			data-guest-lock={read ? (done ? "sign-up" : "quiz") : "pending"}
		>
			<Heading className="mb-5 flex lg:mb-4" />

			<div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-stretch lg:gap-8 xl:grid-cols-[20.25rem_minmax(0,1fr)] xl:gap-10">
				<figure className="relative flex min-w-0 flex-col items-center gap-2 lg:h-[20.25rem] lg:justify-center lg:gap-0">
					{taste ? (
						<Whorl
							attributes={taste.attributes}
							turns={14}
							className="w-full lg:w-[17.5rem]"
							label={example ? "An example taste print" : "Your taste print"}
						/>
					) : (
						<span
							aria-hidden="true"
							className="block aspect-square w-[86%] rounded-full bg-white/[0.04] ring-1 ring-white/10 lg:w-[16rem]"
						/>
					)}
					<figcaption
						className={`rounded-full px-2 whitespace-nowrap lg:absolute lg:bottom-0 lg:left-0 py-0.5 text-[10px] font-bold tracking-[0.14em] uppercase ring-1 ${example ? "text-gray-400 ring-white/15" : "text-amber-300 ring-amber-400/40"}`}
					>
						{example ? "Example taste" : "Your taste"}
					</figcaption>
				</figure>

				<div className="flex min-w-0 flex-col justify-center lg:rounded-2xl lg:bg-white/[0.035] lg:p-10 lg:ring-1 lg:ring-white/10">
					<h2
						className={`${DISPLAY} text-[1.35rem] leading-tight text-white sm:text-2xl lg:text-[2rem]`}
					>
						{done ? "Your picks are ready" : "Picks steered by your taste"}
					</h2>
					<p className="mt-1.5 max-w-xl text-[14px] leading-6 text-gray-400 lg:mt-3 lg:text-[15px]">
						{done
							? "Sign up free to see them and steer them by mood. Your ratings come with you."
							: `Rate ${QUIZ_GOAL} titles you've seen, then pick a mood and drag your taste to steer.`}
					</p>
					<div className="mt-3 lg:mt-6">
						<CallToAction done={read ? done : null} />
					</div>
				</div>
			</div>

			<section
				className="relative mt-8 overflow-hidden rounded-2xl lg:mt-10"
				aria-label="Your picks, locked"
			>
				<div
					aria-hidden="true"
					className="grid scale-[1.04] grid-cols-4 gap-2 blur-md sm:grid-cols-6 lg:grid-cols-12 lg:gap-3"
				>
					{Array.from({ length: POSTERS }, (_, i) => {
						const src = posterSrc(posters[i] || null, "w92")
						return (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: twelve fixed slots
								key={i}
								className="relative block aspect-[2/3] overflow-hidden rounded-lg bg-gray-800"
							>
								{src && (
									<img
										src={src}
										alt=""
										loading="lazy"
										decoding="async"
										draggable={false}
										className="absolute inset-0 size-full object-cover"
									/>
								)}
							</span>
						)
					})}
				</div>
				<div className="absolute inset-0 grid place-items-center bg-gray-950/55">
					<span className="flex flex-col items-center gap-2 text-center">
						<span className="grid size-14 place-items-center rounded-full bg-gray-950/85 ring-1 ring-amber-400/40">
							<LockClosedIcon className="size-6 text-amber-400" aria-hidden />
						</span>
						<span
							className={`text-[13px] font-semibold text-gray-200 ${read ? "" : "invisible"}`}
						>
							{done ? "Sign up to unlock" : "Take the quiz to unlock"}
						</span>
					</span>
				</div>
			</section>
		</div>
	)
}

/** `done` null: the progress isn't read yet; the button's room stays, empty. */
function CallToAction({ done }: { done: boolean | null }) {
	const signUp = useSignUpHref()
	const className =
		"inline-flex min-h-11 items-center rounded-full bg-amber-400 px-5 text-[14px] font-black text-gray-950 hover:bg-amber-300"
	if (done === null)
		return (
			<span
				aria-hidden="true"
				className={`${className} invisible`}
				data-cta="pending"
			>
				Take the quiz
			</span>
		)
	return done ? (
		<Link rel="nofollow" to={signUp} className={className} data-cta="sign-up">
			Sign up
		</Link>
	) : (
		<Link to={QUIZ_PATH} className={className} data-cta="quiz">
			Take the quiz
		</Link>
	)
}
