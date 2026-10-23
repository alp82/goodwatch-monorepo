// The member's own score for a season, an episode, or a part an import brought (#759), in the Episodes section. It
// looks like the score half of the title page's Seen and score control (ui/details/hero/seen-score-faces.tsx) and
// opens the same score picker (ui/scoring/ScoreDialog.tsx), which loads on first use. A score here never records a
// watch, never changes the show's status, and never changes taste.
import { Suspense, lazy, type ReactNode, useRef, useState } from "react"
import type { MemberEpisodeScore } from "~/domain/episode-scores"
import type { Score } from "~/server/scores.server"
import { HALF_FOCUS, ScoreFace } from "~/ui/details/hero/seen-score-faces"
import { useOpenedOnce } from "~/utils/first-use"
import {
	getVibeColorValue,
	scoreLabels,
	selectedScoreStyle,
} from "~/utils/ratings"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { EpisodeScoreStore, ScoreTarget } from "./episode-score-store"
import { FOCUS } from "./store"

const loadScoreDialog = () => import("~/ui/scoring/ScoreDialog")
const ScoreDialog = lazy(reloadOnStaleChunk(loadScoreDialog))
const preload = () => {
	void loadScoreDialog().catch(() => {})
}

const asScore = (value: number | null | undefined) =>
	value != null && value >= 1 && value <= 10 ? (value as Score) : null

/** A small star (Heroicons 20 solid, MIT): the mark of the member's own score beside IMDb's. */
function StarMark({ className = "" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="currentColor"
			aria-hidden="true"
			className={className}
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
			/>
		</svg>
	)
}

/**
 * The member's score, small: a star and the number in the "your score" look (dark fill, the score's colour as its
 * rim), so it reads apart from IMDb's filled tiles. Nothing when there is no score.
 */
export function OwnScoreChip({
	score,
	className = "h-[18px] min-w-8 text-[11px]",
}: {
	score: number | null
	className?: string
}) {
	const value = asScore(score)
	if (!value) return null
	return (
		<span
			data-own-score-chip={value}
			title={`Your score ${value}`}
			className={`inline-flex shrink-0 items-center justify-center gap-0.5 rounded-full px-1.5 font-bold tabular-nums ${className}`}
			style={selectedScoreStyle(value)}
		>
			<StarMark className="h-2.5 w-2.5 opacity-80" />
			{value}
		</span>
	)
}

/** The picker, loaded on first use, for one target. */
function Picker({
	open,
	title,
	value,
	opener,
	onRate,
	onClear,
	onClose,
}: {
	open: boolean
	title: string
	value: Score | null
	opener: React.RefObject<HTMLElement | null>
	onRate: (score: Score) => void
	onClear: () => void
	onClose: () => void
}) {
	const opened = useOpenedOnce(open)
	if (!opened) return null
	return (
		<Suspense fallback={null}>
			<ScoreDialog
				title={title}
				open={open}
				value={value}
				busy={false}
				opener={opener}
				onRate={onRate}
				onClear={onClear}
				onClose={onClose}
			/>
		</Suspense>
	)
}

/** What a control needs: the store, the target, and the words. */
interface ControlProps {
	store: EpisodeScoreStore
	target: ScoreTarget
	/** The key of the target's stored score. */
	scoreKey: string
	/** The picker's title, "S1 E3 · Pilot". */
	title: string
	/** What the target is called in a label, "S1 E3", "Season 2". */
	name: string
}

function usePicker({ store, target, scoreKey }: ControlProps) {
	const [open, setOpen] = useState(false)
	const opener = useRef<HTMLButtonElement>(null)
	const score = store.get(scoreKey)
	const value = asScore(score?.score)
	return {
		open,
		opener,
		value,
		press: () => setOpen(true),
		close: () => setOpen(false),
		rate: (next: Score) => {
			void store.set(target, next)
			setOpen(false)
		},
		clear: () => {
			void store.set(target, null)
			setOpen(false)
		},
	}
}

/**
 * An episode's score in its opened row: the score half of the title page's control on its own, in the same frame,
 * coloured by the score once there is one.
 */
export function EpisodeScoreFrame(props: ControlProps & { ask: string }) {
	const picker = usePicker(props)
	const { value } = picker
	const color = value ? getVibeColorValue(value) : ""
	return (
		<>
			<div
				data-episode-score={value ?? "none"}
				className={`flex h-12 w-full min-w-0 items-stretch rounded-xl sm:w-64 ${value ? "" : "bg-white/[0.05] ring-1 ring-white/15"}`}
				style={
					value
						? {
								background: `${color}1f`,
								boxShadow: `inset 0 0 0 1.5px ${color}`,
							}
						: undefined
				}
			>
				<button
					ref={picker.opener}
					type="button"
					aria-haspopup="dialog"
					aria-expanded={picker.open}
					aria-label={
						value
							? `Your score for ${props.name}: ${value}, ${scoreLabels[value]}. Change it`
							: `Rate ${props.name}`
					}
					onClick={picker.press}
					onPointerEnter={preload}
					onTouchStart={preload}
					onFocus={preload}
					className={`flex min-w-0 flex-1 cursor-pointer rounded-xl hover:bg-white/[0.06] ${HALF_FOCUS}`}
				>
					<ScoreFace score={value} ask={props.ask} />
				</button>
			</div>
			<Picker
				open={picker.open}
				title={props.title}
				value={value}
				opener={picker.opener}
				onRate={picker.rate}
				onClear={picker.clear}
				onClose={picker.close}
			/>
		</>
	)
}

/**
 * A season's score in the open season's head, beside IMDb's season score: the member's score as a chip, or a star
 * that asks for one. As tall as the head's other buttons.
 */
export function SeasonScoreButton(
	props: ControlProps & {
		onPress?: (event: { stopPropagation: () => void }) => void
	},
) {
	const picker = usePicker(props)
	const { value } = picker
	return (
		<>
			<button
				ref={picker.opener}
				type="button"
				data-season-own-score={value ?? "none"}
				aria-haspopup="dialog"
				aria-expanded={picker.open}
				aria-label={
					value
						? `Your score for ${props.name}: ${value}, ${scoreLabels[value]}. Change it`
						: `Rate ${props.name}`
				}
				onClick={(event) => {
					props.onPress?.(event)
					picker.press()
				}}
				onPointerEnter={preload}
				onTouchStart={preload}
				onFocus={preload}
				className={`flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs font-semibold hover:bg-white/10 lg:h-8 ${FOCUS} ${picker.open ? "bg-white/10" : ""}`}
			>
				{value ? (
					<OwnScoreChip score={value} className="h-6 min-w-10 text-[12.5px]" />
				) : (
					<>
						<StarMark className="h-4 w-4 text-amber-300" />
						<span className="hidden text-gray-200 sm:inline">Rate</span>
					</>
				)}
			</button>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: only keeps the picker's presses from closing the season */}
			<span
				className="contents"
				// The head closes the season on a press; the picker's presses reach it through React, so stop them here.
				onClick={(event) => event.stopPropagation()}
			>
				<Picker
					open={picker.open}
					title={props.title}
					value={value}
					opener={picker.opener}
					onRate={picker.rate}
					onClear={picker.clear}
					onClose={picker.close}
				/>
			</span>
		</>
	)
}

/** An imported part's score, as one quiet line of the open season: "Your score for S1 E1–12 · Spy x Family  ★ 8". */
export function PartScoreLine(
	props: ControlProps & { part: MemberEpisodeScore; children?: ReactNode },
) {
	const picker = usePicker(props)
	return (
		<>
			<button
				ref={picker.opener}
				type="button"
				data-part-score={props.part.key}
				aria-haspopup="dialog"
				aria-expanded={picker.open}
				aria-label={`Your score for ${props.name}${props.part.label ? `, ${props.part.label}` : ""}: ${picker.value ?? "none"}. Change it`}
				onClick={picker.press}
				onPointerEnter={preload}
				onFocus={preload}
				className={`flex h-10 w-full cursor-pointer items-center gap-2 border-t border-white/[0.06] px-3 text-left text-xs text-gray-300 hover:bg-white/[0.05] lg:h-8 ${FOCUS}`}
			>
				<span className="shrink-0">Your score for {props.name}</span>
				{props.part.label && (
					<span className="min-w-0 truncate text-gray-500">
						· {props.part.label}
					</span>
				)}
				<span className="flex-1" />
				<OwnScoreChip score={picker.value} />
			</button>
			<Picker
				open={picker.open}
				title={props.title}
				value={picker.value}
				opener={picker.opener}
				onRate={picker.rate}
				onClear={picker.clear}
				onClose={picker.close}
			/>
		</>
	)
}
