// The way in to a taste feature from inside a filter control (the Taste match card, the sort menu under Best match):
// one amber panel you tap anywhere, in the voice of the bar's sign-up key. A faint preview of the control it unlocks,
// the fingerprint, what it gives, and "Sign up free". A member with too few liked titles gets "Rate titles" instead.
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useAuthHref } from "~/utils/auth-href"
import { RATE_TITLES_PATH } from "./labels"

const WORDS = {
	tasteMatch: {
		signUp: [
			"See how well every title fits you",
			"Your taste match comes from your ratings",
		],
		rateMore: [
			"Rate a few titles you love",
			"Then every title gets a taste match",
		],
	},
	bestMatch: {
		signUp: [
			"Order everything by your taste",
			"Best match learns from your ratings",
		],
		rateMore: [
			"Rate a few titles you love",
			"Then Best match orders by your taste",
		],
	},
} as const

export function SignUpPanel({
	feature,
	needs,
	preview,
	className = "",
}: {
	feature: keyof typeof WORDS
	needs: "signUp" | "rateMore"
	/** Labels of the control it unlocks, drawn faint above the words (the Taste match steps). */
	preview?: string[]
	className?: string
}) {
	const authHref = useAuthHref()
	const signUp = needs === "signUp"
	const [title, detail] = WORDS[feature][needs]
	return (
		<Link
			to={signUp ? authHref("sign-up") : RATE_TITLES_PATH}
			rel="nofollow"
			className={`group block rounded-xl bg-amber-500/[0.07] p-3 ring-1 ring-inset ring-amber-500/25 cursor-pointer outline-none transition-colors hover:bg-amber-500/[0.12] focus-visible:ring-2 focus-visible:ring-amber-400 ${className}`}
		>
			{preview && (
				<span
					aria-hidden
					className="mb-2.5 grid auto-cols-fr grid-flow-col gap-1"
				>
					{preview.map((label, i) => (
						<span key={label} className="flex flex-col gap-1">
							<span
								className="h-2 rounded-full bg-amber-400"
								style={{
									opacity: 0.12 + (0.38 * i) / Math.max(1, preview.length - 1),
								}}
							/>
							<span className="text-[11px] text-amber-200/40">{label}</span>
						</span>
					))}
				</span>
			)}
			<span className="flex items-center gap-3">
				<FingerPrintIcon
					className="h-7 w-7 shrink-0 text-amber-500"
					aria-hidden
				/>
				<span className="min-w-0 flex-1">
					<span className="block text-[13px] font-semibold text-amber-50">
						{title}
					</span>
					<span className="block text-[12px] text-amber-200/60">{detail}</span>
				</span>
				<span className="shrink-0 text-[11px] font-black tracking-wider text-amber-300 uppercase group-hover:text-amber-200">
					{signUp ? "Sign up free" : "Rate titles"}
				</span>
			</span>
		</Link>
	)
}
