import { BookmarkIcon, EyeIcon, NoSymbolIcon, StarIcon } from "@heroicons/react/24/solid"
import type React from "react"
import { forwardRef } from "react"
import type { Score } from "~/server/scores.server"
import { getScoreLabelText } from "~/utils/ratings"

const ACTIONS = {
	want: { Icon: BookmarkIcon, short: "Want", on: "Want to See", off: "Want to See", active: "bg-amber-500 text-black", tint: "text-amber-300" },
	seen: { Icon: EyeIcon, short: "Seen", on: "Seen", off: "Mark as Seen", active: "bg-green-500 text-black", tint: "text-green-300" },
	hide: { Icon: NoSymbolIcon, short: "Not interested", on: "Not interested", off: "Not interested", active: "bg-pink-500 text-black", tint: "text-pink-300" },
} as const

export type ActionKind = keyof typeof ACTIONS

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"

/**
 * Want to See, Seen, or Not interested as a toggle button.
 * `label`: "auto" shows the short word on phones and the long one from sm up; "long" always the long one; "none" the
 * icon alone, with the long label as its name and tooltip. `size`: "md" is 44px high, "sm" 36px.
 */
export function ActionButton({
	kind,
	active,
	label = "auto",
	size = "md",
	className = "",
	...rest
}: {
	kind: ActionKind
	active: boolean
	label?: "auto" | "long" | "none"
	size?: "md" | "sm"
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	const a = ACTIONS[kind]
	const long = active ? a.on : a.off
	const padding =
		label === "none"
			? "px-0"
			: label === "auto"
				? "px-2 text-xs sm:px-4 sm:text-sm"
				: size === "md"
					? "px-3 text-sm"
					: "px-2 text-xs"
	return (
		<button
			type="button"
			aria-pressed={active}
			aria-label={label === "none" ? long : undefined}
			title={label === "none" ? long : undefined}
			className={`inline-flex ${size === "md" ? "h-11" : "h-9"} w-full min-w-0 items-center justify-center gap-2 rounded-lg ${padding} font-semibold cursor-pointer transition-colors ${FOCUS} disabled:cursor-not-allowed disabled:opacity-40 ${
				active ? a.active : "bg-white/10 text-gray-100 hover:bg-white/20"
			} ${className}`}
			{...rest}
		>
			<a.Icon className={`h-4 w-4 shrink-0 ${active ? "" : a.tint}`} />
			{label === "auto" && (
				<>
					<span className="truncate sm:hidden">{active ? a.on : a.short}</span>
					<span className="hidden truncate sm:inline">{long}</span>
				</>
			)}
			{label === "long" && <span className="truncate">{long}</span>}
		</button>
	)
}

/** The score button in a card's row of quick actions: a star, or the person's score on its vibe color. */
export const ScoreButton = forwardRef<
	HTMLButtonElement,
	{ score: Score | null } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function ScoreButton({ score, className = "", ...rest }, ref) {
	return (
		<button
			ref={ref}
			type="button"
			aria-label={score ? `Your score: ${getScoreLabelText(score)}. Change it` : "Score it"}
			title={score ? `Your score: ${getScoreLabelText(score)}` : "Score it"}
			className={`inline-flex h-9 w-full min-w-0 items-center justify-center rounded-lg px-0 text-sm font-bold cursor-pointer transition-colors ${FOCUS} ${
				score ? `bg-vibe-${score * 10} text-white` : "bg-white/10 text-gray-100 hover:bg-white/20"
			} ${className}`}
			{...rest}
		>
			{score ? <span className="tabular-nums">{score}</span> : <StarIcon className="h-4 w-4 shrink-0 text-yellow-300" />}
		</button>
	)
})
