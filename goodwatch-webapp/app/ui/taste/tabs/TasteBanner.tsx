// The Taste banner: the way into the taste quiz, above every Taste tab. It grew out of the Sample taste band.
//   guest, 0 ratings     Sample taste, Rate titles
//   guest, 1-4 ratings   Sample taste with dots, Keep rating (the quiz resumes where they left off)
//   guest, 5+ ratings    Your taste, Save my taste · free
//   just saved           Saved to your account (after Continue with Google, `?saved=1`)
//   new member           a slim Rate more band
//   established member   a quiet Rate more link
import { Link, useSearchParams } from "@remix-run/react"
import { useScoresCount } from "~/hooks/useUserDataAccessors"
import { GoogleMark } from "~/ui/taste-quiz/GoogleMark"
import { QUIZ_PATH, RatingDots } from "~/ui/taste-quiz/TasteQuizPage"
import { useContinueWithGoogle } from "~/ui/taste-quiz/continue-with-google"
import { QUIZ_GOAL } from "~/ui/taste-quiz/quiz-flow"
import { useGuestInteractions } from "~/utils/guest-progress"

/** Below this many ratings a member is new, and the banner still asks for more. */
export const NEW_MEMBER_RATINGS = 20

const rateButton =
	"inline-flex min-h-11 items-center gap-2 rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-5 text-sm font-black text-gray-950 hover:brightness-110 md:min-h-9"
const rateLink =
	"inline-flex min-h-11 items-center text-sm font-bold text-amber-300 hover:text-amber-200 md:min-h-9"

export function TasteBanner({ member }: { member: boolean }) {
	return member ? <MemberBanner /> : <GuestBanner />
}

function MemberBanner() {
	const [params] = useSearchParams()
	const rated = useScoresCount()
	if (params.get("saved") === "1")
		return <YourTaste line="Saved to your account. Rate more to sharpen it." />
	const isNew = rated < NEW_MEMBER_RATINGS
	return (
		<section
			aria-label="Rate more"
			className={isNew ? "border-b border-white/10 bg-gray-900/60" : ""}
		>
			<div
				className={`mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 md:px-8 ${isNew ? "py-2.5" : "justify-end pt-3"}`}
			>
				{isNew && (
					<p className="text-sm text-gray-300">
						Your taste is from {rated} {rated === 1 ? "rating" : "ratings"}. A
						few more and it gets sharper.
					</p>
				)}
				<Link to={QUIZ_PATH} className={isNew ? rateButton : rateLink}>
					Rate more →
				</Link>
			</div>
		</section>
	)
}

function GuestBanner() {
	const rated = useGuestInteractions().filter((i) => i.type === "score").length
	const google = useContinueWithGoogle()
	if (rated >= QUIZ_GOAL)
		return (
			<YourTaste
				line={`From your ${rated} ratings on this device. Save it so it follows you.`}
				save={() => google("/taste?saved=1")}
			/>
		)
	const mid = rated > 0
	return (
		<section
			aria-label="Sample taste"
			className="border-b border-amber-500/20 bg-amber-950/30"
		>
			<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 md:px-8">
				<div className="min-w-0 flex-1 basis-64">
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-wide text-gray-950">
							Sample taste
						</span>
						{mid && <RatingDots at={rated} of={QUIZ_GOAL} />}
					</div>
					<p className="mt-1.5 text-sm text-amber-50/90 md:text-base">
						{mid
							? `${rated} of ${QUIZ_GOAL} rated. ${QUIZ_GOAL - rated} more and this becomes your taste.`
							: `This is someone else's taste. Rate ${QUIZ_GOAL} titles you've seen to see your own: one at a time, about a minute.`}
					</p>
				</div>
				<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
					<Link to={QUIZ_PATH} className={rateButton}>
						{mid ? "Keep rating" : "Rate titles"} →
					</Link>
					<Link
						rel="nofollow"
						to="/sign-in?redirectTo=/taste"
						className="inline-flex min-h-11 items-center text-sm font-semibold text-amber-200/80 hover:text-amber-100 md:min-h-9"
					>
						Have an account? Sign in
					</Link>
				</span>
			</div>
		</section>
	)
}

function YourTaste({ line, save }: { line: string; save?: () => void }) {
	return (
		<section
			aria-label="Your taste"
			className="border-b border-emerald-500/20 bg-emerald-950/25"
		>
			<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
				<span className="rounded-full bg-emerald-400 px-2.5 py-0.5 text-xs font-black uppercase tracking-wide text-gray-950">
					Your taste
				</span>
				<p className="text-sm text-emerald-50/90">{line}</p>
				<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
					{save && (
						<button
							type="button"
							onClick={save}
							className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-gray-100 px-4 text-sm font-bold text-gray-900 ring-2 ring-inset ring-gray-400 hover:bg-white md:min-h-9"
						>
							<GoogleMark size={16} /> Save my taste · free
						</button>
					)}
					<Link to={QUIZ_PATH} className={rateLink}>
						Rate more →
					</Link>
				</span>
			</div>
		</section>
	)
}
