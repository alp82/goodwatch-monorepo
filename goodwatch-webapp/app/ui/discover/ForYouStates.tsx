// For you's states that aren't the plain switch: a guest without enough ratings sees the sign-up prompt in the
// switch's place, and a viewer without enough liked titles gets the switch disabled with a way to rate more.
import { UserPlusIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { RATE_TITLES_PATH, SLAB_SEGMENT } from "~/ui/filter-bar"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { SIGN_UP_MESSAGES } from "~/ui/sign-up-prompt/messages"
import { useAuthHref } from "~/utils/auth-href"

/**
 * The sign-up prompt in For you's place: the prompt chip in the desktop row, and a compact segment in the phone slab
 * that opens the same sign-up.
 */
export function ForYouSignUp() {
	const authHref = useAuthHref()
	const message = SIGN_UP_MESSAGES.forYou.learn
	return (
		<>
			<span className="hidden h-full w-full items-center lg:flex">
				<SignUpPrompt
					feature="forYou"
					stage="learn"
					size="chip"
					className="w-full !rounded-2xl !py-2 leading-snug"
				/>
			</span>
			<Link
				rel="nofollow"
				to={authHref("sign-up")}
				aria-label={message.title}
				className={`${SLAB_SEGMENT} text-amber-200 lg:hidden`}
			>
				<span className="relative flex items-center gap-0.5">
					<FingerPrintIcon className="h-4 w-4 text-amber-500/80" />
					<UserPlusIcon className="h-3 w-3" />
				</span>
				<span className="relative w-full truncate px-0.5 text-center">
					Sign up
				</span>
			</Link>
		</>
	)
}

/** The fingerprint's explanation while For you can't work yet. */
export function ForYouNeedsTaste() {
	return (
		<div>
			<p className="flex items-center gap-2 text-sm font-bold text-white">
				<FingerPrintIcon className="h-4 w-4 text-amber-400" />
				For you
			</p>
			<p className="mt-2 text-[13px] leading-relaxed text-gray-300">
				For you lifts titles in the sort you chose: the higher the taste match,
				the further up, and your best matches go to the top. It needs a few
				titles you loved to learn your taste.
			</p>
			<Link
				to={RATE_TITLES_PATH}
				className="mt-3 inline-flex min-h-9 items-center rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-4 text-sm font-black text-gray-950 hover:brightness-110"
			>
				Rate a few more titles you love
			</Link>
		</div>
	)
}
