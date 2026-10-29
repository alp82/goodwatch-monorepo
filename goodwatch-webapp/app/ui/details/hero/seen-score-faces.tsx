// How the Seen and score control looks, apart from what it does: the frame of its two halves, and each half's face
// for a given state. The control (ui/title-actions/SeenScore.tsx) and the preview of a change that removes
// something (NotSeenConfirm.tsx) draw the same faces, so the preview shows the control itself.
import type { ReactNode } from "react"
import type { Score } from "~/server/scores.server"
import { getVibeColorValue, scoreLabels, selectedScoreStyle } from "~/utils/ratings"

/** Keyboard focus inside a half, drawn inset so the frame's rounded corners don't cut it. */
export const HALF_FOCUS =
	"outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"

/** One rounded control, 48px high, in two halves with a line between. A score colours the whole frame. */
export function SplitFrame({
	score,
	left,
	right,
	className = "",
	big = false,
}: {
	score: Score | null
	left: ReactNode
	right: ReactNode
	className?: string
	/** The hero's control: taller, with larger faces, from lg up. A preview stays compact. */
	big?: boolean
}) {
	const color = score ? getVibeColorValue(score) : ""
	return (
		<div
			data-seen-score
			data-big={big || undefined}
			className={`group/split relative flex h-12 min-w-0 ${big ? "lg:h-14" : ""} items-stretch rounded-xl ${score ? "" : "bg-white/[0.05] ring-1 ring-white/15"} ${className}`}
			style={
				score
					? {
							background: `${color}1f`,
							boxShadow: `inset 0 0 0 1.5px ${color}`,
						}
					: undefined
			}
		>
			{/* Not clipped: the status half's menu opens from it. Each face rounds its own corners instead. */}
			<div className="flex shrink-0 rounded-l-xl">{left}</div>
			<span className="w-px shrink-0 bg-white/15" aria-hidden="true" />
			<div className="flex min-w-0 flex-1 overflow-hidden rounded-r-xl">
				{right}
			</div>
		</div>
	)
}

// The icons the control draws (Heroicons 20 solid, MIT), written out here: from the icon package they would join a
// chunk that every page loads.
export function EyeIcon({ className = "" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="currentColor"
			className={className}
			aria-hidden="true"
		>
			<path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
			/>
		</svg>
	)
}

export function EyeSlashIcon({ className = "" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="currentColor"
			className={className}
			aria-hidden="true"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z"
			/>
			<path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
		</svg>
	)
}

function StarIcon({ className = "" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="currentColor"
			className={className}
			aria-hidden="true"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
			/>
		</svg>
	)
}

function ChevronIcon() {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			className="h-3.5 w-3.5 shrink-0 opacity-70 max-sm:hidden"
			aria-hidden="true"
		>
			<path d="m4 6 4 4 4-4" />
		</svg>
	)
}

/** The Seen half's face: green with "Seen", or an outlined eye that asks. */
export function SeenFace({
	seen,
	count = null,
}: { seen: boolean; count?: string | null }) {
	return (
		<span
			className={`flex h-full w-[4.5rem] flex-col rounded-l-xl items-center justify-center gap-0.5 text-[11px] font-semibold lg:group-data-[big]/split:w-20 lg:group-data-[big]/split:text-xs ${seen ? "bg-green-500 text-black" : "text-gray-200"}`}
		>
			<EyeIcon
				className={`h-4 w-4 lg:group-data-[big]/split:h-5 lg:group-data-[big]/split:w-5 ${seen ? "" : "text-green-300"}`}
			/>
			<span>
				{seen ? "Seen" : "Seen?"}
				{count && (
					<span className="ml-0.5 tabular-nums opacity-70">{count}</span>
				)}
			</span>
		</span>
	)
}

export type StatusTone = "none" | "watching" | "on_hold" | "dropped" | "seen" | "new_episodes"

const STATUS_TONE: Record<StatusTone, string> = {
	none: "text-gray-200",
	watching: "bg-sky-500 text-black",
	on_hold: "bg-violet-500 text-white",
	dropped: "bg-pink-500 text-black",
	seen: "bg-green-500 text-black",
	new_episodes: "bg-amber-400 text-black",
}

// The status icons (Heroicons 20 solid, MIT), as the status menu draws them.
const STATUS_PATH: Partial<Record<StatusTone, string>> = {
	watching:
		"M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z",
	on_hold:
		"M5.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 7.25 3h-1.5ZM12.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75h-1.5Z",
	dropped:
		"m5.965 4.904 9.131 9.131a6.5 6.5 0 0 0-9.131-9.131Zm8.07 10.192L4.904 5.965a6.5 6.5 0 0 0 9.131 9.131ZM4.343 4.343a8 8 0 1 1 11.314 11.314A8 8 0 0 1 4.343 4.343Z",
}

function StatusIcon({ tone }: { tone: StatusTone }) {
	if (tone === "none")
		return (
			<EyeSlashIcon className="h-4 w-4 shrink-0 text-gray-400 lg:group-data-[big]/split:h-5 lg:group-data-[big]/split:w-5" />
		)
	if (tone === "seen" || tone === "new_episodes")
		return (
			<EyeIcon className="h-4 w-4 shrink-0 lg:group-data-[big]/split:h-5 lg:group-data-[big]/split:w-5" />
		)
	return (
		<svg
			viewBox="0 0 20 20"
			fill="currentColor"
			className="h-4 w-4 shrink-0 lg:group-data-[big]/split:h-5 lg:group-data-[big]/split:w-5"
			aria-hidden="true"
		>
			<path fillRule="evenodd" clipRule="evenodd" d={STATUS_PATH[tone]} />
		</svg>
	)
}

/** A show's status half: the status and, under it, how far (or what to do while Not started). */
export function StatusFace({
	tone,
	label,
	detail,
	chevron = true,
}: {
	tone: StatusTone
	label: string
	detail: string | null
	chevron?: boolean
}) {
	return (
		<span
			className={`flex h-full items-center gap-1.5 rounded-l-xl px-2 sm:min-w-[6.75rem] sm:gap-2 sm:px-2.5 lg:group-data-[big]/split:min-w-[8rem] lg:group-data-[big]/split:px-3 text-left ${STATUS_TONE[tone]}`}
		>
			<StatusIcon tone={tone} />
			<span className="min-w-0 flex-1 leading-tight">
				<span className="block whitespace-nowrap text-xs font-bold lg:group-data-[big]/split:text-sm">
					{label}
				</span>
				{detail && (
					<span
						className={`block whitespace-nowrap text-[11px] tabular-nums lg:group-data-[big]/split:text-xs ${tone === "none" ? "text-gray-400" : "opacity-80"}`}
					>
						{detail}
					</span>
				)}
			</span>
			{chevron && <ChevronIcon />}
		</span>
	)
}

/** The score half's face: the number on its colour and its word, or a star that asks for one. */
export function ScoreFace({
	score,
	ask,
	due = false,
}: {
	score: Score | null
	ask: string
	/** A tracked show's score is due: an amber dot on the star, and the ask in amber. */
	due?: boolean
}) {
	return (
		// A container: in a narrow place (the title page's rail beside a tracked show's status) the eyebrow steps aside
		// for screen readers only; the ask may take two lines ("Rate it so far"), and a score shows as its colored number
		// alone (its word for screen readers), so nothing cuts off.
		<span className="@container/score flex h-full min-w-0 flex-1 items-center gap-2 pl-2 pr-2 text-left sm:gap-2.5 sm:pr-3 lg:group-data-[big]/split:gap-3 lg:group-data-[big]/split:pl-2.5">
			{score ? (
				<span
					className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-black tabular-nums lg:group-data-[big]/split:h-11 lg:group-data-[big]/split:w-11 lg:group-data-[big]/split:text-xl"
					style={selectedScoreStyle(score)}
				>
					{score}
				</span>
			) : (
				<span className="relative shrink-0">
					<StarIcon className="h-5 w-5 text-amber-300 lg:group-data-[big]/split:h-6 lg:group-data-[big]/split:w-6" />
					{due && (
						<span
							data-rate-due
							className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-stone-950"
						/>
					)}
				</span>
			)}
			<span className="min-w-0 flex-1 leading-tight">
				<span className="block truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 @max-[8.5rem]/score:sr-only">
					Your score
				</span>
				<span
					className={`block truncate text-sm font-bold lg:group-data-[big]/split:text-base ${score ? "@max-[8.5rem]/score:sr-only" : "@max-[8.5rem]/score:line-clamp-2 @max-[8.5rem]/score:whitespace-normal"} ${due ? "text-amber-200" : "text-white"}`}
				>
					{score ? scoreLabels[score] : ask}
				</span>
			</span>
		</span>
	)
}

/**
 * A movie's Seen as a switch, for the score dialog: a pill with a knob that carries the word and slides to the other
 * end. Only transform and opacity move. The track is 128px with 4px padding and the knob 84px, so it travels 36px.
 */
export function SeenSwitch({
	on,
	onPress,
	disabled = false,
}: { on: boolean; onPress: () => void; disabled?: boolean }) {
	const face =
		"absolute inset-0 flex items-center justify-center gap-1 rounded-full transition-opacity duration-200"
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label="Seen"
			data-seen-switch={on ? "on" : "off"}
			disabled={disabled}
			onClick={onPress}
			className={`relative inline-flex h-9 w-32 shrink-0 cursor-pointer items-center rounded-full p-1 text-xs font-bold disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
				on
					? "bg-green-500/[0.16] ring-1 ring-green-400/50"
					: "bg-white/[0.06] ring-1 ring-white/15 hover:bg-white/10"
			}`}
		>
			<span
				className={`relative h-7 w-[5.25rem] rounded-full shadow-[0_2px_8px_rgba(0,0,0,.45)] transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] ${on ? "translate-x-9" : "translate-x-0"}`}
			>
				<span
					className={`${face} bg-stone-600 text-gray-100 ${on ? "opacity-0" : "opacity-100"}`}
				>
					<EyeSlashIcon className="h-3.5 w-3.5" />
					Not seen
				</span>
				<span
					className={`${face} bg-green-500 text-black ${on ? "opacity-100" : "opacity-0"}`}
				>
					<EyeIcon className="h-3.5 w-3.5" />
					Seen
				</span>
			</span>
		</button>
	)
}
