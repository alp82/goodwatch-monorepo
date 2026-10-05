// PROTOTYPE - throwaway. The unified action set's parts: the taste quiz's score control (a copy of
// ~/ui/taste-quiz/StackControl.tsx that also shows the current score and clears it), and the list buttons (a copy of
// ActionButton in ~/ui/details/hero/ListActions.tsx with a Not interested kind and forced label lengths).
import { BookmarkIcon, EyeIcon, NoSymbolIcon, StarIcon } from "@heroicons/react/24/solid"
import type React from "react"
import { useState } from "react"
import type { Score } from "~/server/scores.server"
import type { TitleCard } from "~/server/title-cards.server"
import { RATING_LEVELS, levelOf } from "~/ui/taste-quiz/quiz-flow"
import { getScoreLabelText, getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { useStore } from "./store"

const SCORES = Array.from({ length: 10 }, (_, i) => (i + 1) as Score)

/** "full": as in the quiz. "compact": shorter level buttons, for popups. "strip": the 1-10 strip alone. */
export type ScoreSize = "full" | "compact" | "strip"

export function ScoreControl({
	value,
	onRate,
	onClear,
	size = "full",
	header = true,
	narrow = false,
}: {
	value: Score | null
	onRate: (score: Score) => void
	onClear: () => void
	size?: ScoreSize
	header?: boolean
	/** "full" inside a narrow panel (a dialog, a sheet): the quiz's phone look at every screen width. */
	narrow?: boolean
}) {
	const [hot, setHot] = useState<number | null>(null)
	const mine = value == null ? null : levelOf(value)
	const full = size === "full"
	const wide = full && !narrow
	return (
		<div data-score-control={size}>
			{header && (
				<div className="mb-2 flex min-h-5 items-baseline justify-between gap-3">
					<p className={`font-semibold ${full ? "text-sm" : "text-xs"} ${value ? "text-white" : "text-gray-400"}`}>
						{value ? (
							<>
								<span className="text-gray-400">Your score: </span>
								<span style={{ color: getVibeColorValue(value) }}>{getScoreLabelText(value)}</span>
							</>
						) : (
							scoreLabels[0]
						)}
					</p>
					{value && (
						<button
							type="button"
							onClick={onClear}
							className="shrink-0 cursor-pointer text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white"
						>
							Clear score
						</button>
					)}
				</div>
			)}
			<fieldset className={`grid grid-cols-10 ${full ? "gap-1 sm:gap-1.5" : "gap-1"}`} onMouseLeave={() => setHot(null)}>
				<legend className="sr-only">Your score</legend>
				{size !== "strip" &&
					RATING_LEVELS.map((level, i) => {
						const on = mine === i
						const color = getVibeColorValue(level.score)
						return (
							<button
								key={level.name}
								type="button"
								onClick={() => onRate(level.score)}
								onMouseEnter={() => setHot(i)}
								onFocus={() => setHot(i)}
								aria-label={`${level.name}, ${level.score}`}
								aria-pressed={on}
								className={`flex cursor-pointer items-center justify-center rounded-xl text-left ring-2 transition focus-visible:outline-none ${
									wide ? "h-14 gap-2 px-1 sm:h-16 sm:justify-start sm:px-3" : full ? "h-14 px-1" : "h-9 px-0.5"
								} ${on ? "" : "bg-gray-800 hover:bg-gray-700"} ${hot === i ? "ring-amber-400" : "ring-transparent"}`}
								style={{
									gridColumn: `span ${level.hi - level.lo + 1}`,
									...(on ? { background: `${color}55`, boxShadow: `inset 0 0 0 2px ${color}` } : {}),
								}}
							>
								{wide && <span className="hidden h-7 w-1.5 shrink-0 rounded-full sm:block" style={{ background: color }} />}
								<span className={wide ? "text-xs font-extrabold sm:text-lg" : full ? "text-xs font-extrabold" : "text-[11px] font-extrabold"}>{level.name}</span>
								{wide && (
									<span className="ml-auto hidden text-[11px] tabular-nums text-gray-500 md:inline">
										{level.lo}–{level.hi}
									</span>
								)}
							</button>
						)
					})}
				{SCORES.map((score) => {
					const picked = value === score
					const on = hot != null && levelOf(score) === hot
					const off = hot != null && !on
					return (
						<button
							key={score}
							type="button"
							onClick={() => onRate(score)}
							onFocus={() => setHot(levelOf(score))}
							onMouseEnter={() => setHot(levelOf(score))}
							aria-label={`${score}, ${scoreLabels[score]}`}
							aria-pressed={picked}
							title={`${score} · ${scoreLabels[score]}`}
							className={`flex cursor-pointer items-center justify-center rounded-md text-xs font-black tabular-nums transition hover:scale-110 hover:text-gray-950 focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-amber-400 ${
								size === "strip" ? "h-8" : "h-5"
							} ${picked ? "scale-110 text-gray-950 ring-2 ring-white" : on ? "text-white" : off ? "text-white/35" : "text-white/75"}`}
							style={{ background: `${getVibeColorValue(score)}${picked ? "" : on ? "77" : off ? "22" : "44"}` }}
						>
							{score}
						</button>
					)
				})}
			</fieldset>
		</div>
	)
}

/** The score control bound to the store for one title. */
export function TitleScore({ card, size, header, narrow, onDone }: { card: TitleCard; size?: ScoreSize; header?: boolean; narrow?: boolean; onDone?: () => void }) {
	const s = useStore()
	return (
		<ScoreControl
			value={s.scoreOf(card.key)}
			size={size}
			header={header}
			narrow={narrow}
			onRate={(score) => {
				s.score(card.key, score)
				onDone?.()
			}}
			onClear={() => s.score(card.key, null)}
		/>
	)
}

// Want and Seen as the title page draws them. Not interested takes the look of the title page's Skip.
export const ACTIONS = {
	want: { Icon: BookmarkIcon, short: "Want", on: "Want to see", off: "Want to see", active: "bg-amber-500 text-black", tint: "text-amber-300" },
	seen: { Icon: EyeIcon, short: "Seen", on: "Seen it", off: "Seen it", active: "bg-green-500 text-black", tint: "text-green-300" },
	hide: { Icon: NoSymbolIcon, short: "Not for me", on: "Not interested", off: "Not interested", active: "bg-pink-500 text-black", tint: "text-pink-300" },
} as const
export type ActionKind = keyof typeof ACTIONS

/**
 * `label`: "auto" switches from the short to the long label at sm as the title page does; "long" and "short" force
 * one; "none" is the icon alone (the quick row on a card). `size`: "md" is the title page's 44px, "sm" a 36px step.
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
	label?: "auto" | "long" | "short" | "none"
	size?: "md" | "sm"
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	const a = ACTIONS[kind]
	const long = active ? a.on : a.off
	return (
		<button
			type="button"
			aria-pressed={active}
			aria-label={label === "none" ? long : undefined}
			title={label === "none" ? long : undefined}
			className={`inline-flex ${size === "md" ? "h-11" : "h-9"} w-full min-w-0 items-center justify-center gap-2 rounded-lg ${
				label === "none" ? "px-0" : label === "auto" ? "px-2 text-xs sm:px-4 sm:text-sm" : size === "md" ? "px-3 text-sm" : "px-2 text-xs"
			} font-semibold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 ${
				active ? a.active : "bg-white/10 text-gray-100 hover:bg-white/20"
			} ${className}`}
			{...rest}
		>
			<a.Icon className={`h-4 w-4 shrink-0 ${active ? "" : a.tint}`} />
			{label === "auto" && (
				<>
					<span className="sm:hidden">{active ? a.on : a.short}</span>
					<span className="hidden truncate sm:inline">{long}</span>
				</>
			)}
			{label === "long" && <span className="truncate">{long}</span>}
			{label === "short" && <span className="truncate">{a.short}</span>}
		</button>
	)
}

/** One list button bound to the store. `onHide` runs after Not interested turns on (the surface drops the title). */
export function TitleAction({
	card,
	kind,
	onHide,
	quiet,
	...rest
}: {
	card: TitleCard
	kind: ActionKind
	onHide?: () => void
	/** Not interested without the toast. */
	quiet?: boolean
} & Omit<React.ComponentProps<typeof ActionButton>, "kind" | "active">) {
	const s = useStore()
	const key = card.key
	if (kind === "want") return <ActionButton kind="want" active={s.isWant(key)} onClick={() => s.toggleWant(key)} {...rest} />
	if (kind === "seen") return <ActionButton kind="seen" active={s.isSeen(key)} onClick={() => s.toggleSeen(key)} {...rest} />
	// "I haven't seen it and don't want to": not offered for a title that is seen or scored.
	const seen = s.isSeen(key) || s.scoreOf(key) != null
	return (
		<ActionButton
			kind="hide"
			active={s.isHidden(key)}
			disabled={seen}
			title={seen ? "You've seen it. Not interested is for titles you haven't seen." : undefined}
			onClick={() => {
				const turningOn = !s.isHidden(key)
				s.notInterested(key, quiet)
				if (turningOn) onHide?.()
			}}
			{...rest}
		/>
	)
}

/** The score button of a card's quick row and of the collapsed sets: a star, or the score in its vibe color. */
export function ScoreChip({
	card,
	label = false,
	size = "sm",
	className = "",
	...rest
}: { card: TitleCard; label?: boolean; size?: "md" | "sm" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	const score = useStore().scoreOf(card.key)
	return (
		<button
			type="button"
			aria-label={score ? `Your score: ${getScoreLabelText(score)}. Change it` : "Score it"}
			title={score ? `Your score: ${getScoreLabelText(score)}` : "Score it"}
			className={`inline-flex ${size === "md" ? "h-11 text-sm" : "h-9 text-xs"} w-full min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 font-bold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
				score ? "text-white" : "bg-white/10 text-gray-100 hover:bg-white/20"
			} ${className}`}
			style={score ? { background: getVibeColorValue(score) } : undefined}
			{...rest}
		>
			<StarIcon className={`h-4 w-4 shrink-0 ${score ? "" : "text-yellow-300"}`} />
			{score ? <span className="tabular-nums">{score}</span> : label ? <span className="truncate">Score</span> : null}
		</button>
	)
}

/**
 * The action set, three ways:
 * "full": the score control as in the quiz, then the three list buttons in a row.
 * "compact": the compact score control, Want and Seen in a row, Not interested as a quieter line beneath.
 * "collapsed": one row of four (Score, Want, Seen, Not interested); Score opens the compact control in place.
 */
export function ActionSet({
	card,
	form,
	onHide,
	quiet,
	hideAs = "button",
	narrow,
}: {
	card: TitleCard
	form: "full" | "compact" | "collapsed"
	onHide?: () => void
	quiet?: boolean
	/** In "compact": Not interested as a third button under the two, or as a text link. */
	hideAs?: "button" | "link"
	narrow?: boolean
}) {
	const [rating, setRating] = useState(false)
	if (form === "full")
		return (
			<div>
				<TitleScore card={card} size="full" narrow={narrow} />
				<div className="mt-3 flex items-center gap-2 [&>*]:min-w-0 [&>*]:flex-1">
					<TitleAction card={card} kind="want" />
					<TitleAction card={card} kind="seen" />
					<TitleAction card={card} kind="hide" onHide={onHide} quiet={quiet} />
				</div>
			</div>
		)
	if (form === "compact")
		return (
			<div>
				<TitleScore card={card} size="compact" />
				<div className="mt-2 grid grid-cols-2 gap-1.5">
					<TitleAction card={card} kind="want" label="long" />
					<TitleAction card={card} kind="seen" label="long" />
					{hideAs === "button" && <TitleAction card={card} kind="hide" label="long" size="sm" className="col-span-2" onHide={onHide} quiet={quiet} />}
				</div>
			</div>
		)
	return (
		<div>
			<div className="grid grid-cols-4 gap-1.5">
				<ScoreChip card={card} label size="md" className="!gap-1 !px-1 !text-xs" aria-expanded={rating} onClick={() => setRating(!rating)} />
				<TitleAction card={card} kind="want" label="short" className="!gap-1 !px-1 !text-xs" />
				<TitleAction card={card} kind="seen" label="short" className="!gap-1 !px-1 !text-xs" />
				<TitleAction card={card} kind="hide" label="none" onHide={onHide} quiet={quiet} />
			</div>
			{rating && (
				<div className="mt-2">
					<TitleScore card={card} size="compact" onDone={() => setRating(false)} />
				</div>
			)}
		</div>
	)
}

/** Not interested as a text link, in the style of the Explorer card's "Open the title page". */
export function HideLink({ card, onHide, quiet, className = "" }: { card: TitleCard; onHide?: () => void; quiet?: boolean; className?: string }) {
	const s = useStore()
	const on = s.isHidden(card.key)
	const seen = s.isSeen(card.key) || s.scoreOf(card.key) != null
	if (seen) return null
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={() => {
				s.notInterested(card.key, quiet)
				if (!on) onHide?.()
			}}
			className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[13px] font-semibold underline underline-offset-[3px] decoration-white/25 hover:text-white ${on ? "text-pink-300" : "text-[rgba(222,229,255,0.62)]"} ${className}`}
		>
			<NoSymbolIcon className="h-4 w-4" />
			{on ? "Not interested (undo)" : "Not interested"}
		</button>
	)
}
