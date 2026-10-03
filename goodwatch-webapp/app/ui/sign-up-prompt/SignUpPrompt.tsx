import { UserPlusIcon } from "@heroicons/react/20/solid"
import { Link, useLocation } from "@remix-run/react"
import { useUser } from "~/utils/auth"
import { authReturnQuery } from "~/utils/auth-return"
import {
	SIGN_UP_MESSAGES,
	type SignUpFeature,
	type SignUpStage,
} from "./messages"

export type SignUpPromptSize = "inline" | "chip" | "card"

interface SignUpPromptProps {
	feature: SignUpFeature
	/** "learn" before the guest has taste, "keep" once the feature works from their guest ratings. */
	stage?: SignUpStage
	/** inline next to a control, a chip in a menu, a card in a sheet. */
	size?: SignUpPromptSize
	className?: string
}

// The page the person is on, so sign-up (and sign-in) bring them back to it. Guest progress transfers as usual.
function useReturnQuery() {
	return authReturnQuery(useLocation())
}

/**
 * The sign-up call to action for a taste-dependent feature. Signed-in members never see it.
 */
export function SignUpPrompt({
	feature,
	stage = "learn",
	size = "inline",
	className = "",
}: SignUpPromptProps) {
	const { user } = useUser()
	const returnQuery = useReturnQuery()
	if (user) return null
	const message = SIGN_UP_MESSAGES[feature][stage]
	const signUp = `/sign-up${returnQuery}`

	if (size === "chip")
		return (
			<Link
				rel="nofollow"
				to={signUp}
				className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200 ring-1 ring-amber-500/40 transition-colors hover:bg-amber-500/25 md:min-h-8 ${className}`}
			>
				<UserPlusIcon className="h-4 w-4 shrink-0" aria-hidden />
				{message.title}
			</Link>
		)

	if (size === "card")
		return (
			<section
				aria-label={message.title}
				className={`flex flex-col gap-3 rounded-2xl bg-gray-900 p-4 ring-1 ring-amber-500/25 ${className}`}
			>
				<div className="flex items-start gap-3">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
						<UserPlusIcon className="h-5 w-5" aria-hidden />
					</span>
					<div className="flex flex-col gap-1">
						<p className="font-bold leading-snug text-gray-100">
							{message.title}
						</p>
						<p className="text-sm leading-snug text-gray-400">
							{message.detail}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					<Link
						rel="nofollow"
						to={signUp}
						className="inline-flex min-h-11 items-center rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-4 text-sm font-black text-gray-950 hover:brightness-110 md:min-h-9"
					>
						Sign up
					</Link>
					<Link
						rel="nofollow"
						to={`/sign-in${returnQuery}`}
						className="text-sm text-gray-400 underline-offset-2 hover:text-gray-200 hover:underline"
					>
						I have an account
					</Link>
				</div>
			</section>
		)

	return (
		<Link
			rel="nofollow"
			to={signUp}
			className={`inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-amber-300 underline-offset-2 hover:text-amber-200 hover:underline md:min-h-0 ${className}`}
		>
			<UserPlusIcon className="h-4 w-4 shrink-0" aria-hidden />
			{message.title}
		</Link>
	)
}
