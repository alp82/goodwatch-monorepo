// The title actions of a poster card, loaded on demand by TitleActionsFrame: the hover row, the score popover, the
// phone sheet, and the "Hidden" tile.
import { type RefObject, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import UserAction from "~/ui/auth/UserAction"
import Drawer from "~/ui/modal/Drawer"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"
import { ActionButton, ScoreButton } from "./ActionButton"
import { TitleActionSet } from "./TitleActionSet"
import type { ActionsPlacement, OpenActions } from "./TitleActionsFrame"
import { TitleScore } from "./TitleScore"
import { HideFeedbackContext } from "./hide-feedback"
import { SEEN_INSTRUCTIONS, SEEN_SO_NOT_HIDEABLE, useTitleActions } from "./useTitleActions"

const ROW_AT: Record<ActionsPlacement, string> = {
	bottom: "bottom-2.5",
	raised: "bottom-14",
	top: "top-2.5",
}
// From the card's edge to the far side of the row, plus a small gap: where the popover starts.
const ROW_REACH: Record<ActionsPlacement, number> = { bottom: 58, raised: 104, top: 58 }

export default function CardActions({
	media,
	frame,
	placement,
	touch,
	open,
	setOpen,
	tile,
	setTile,
}: {
	media: ScoredMedia
	frame: RefObject<HTMLDivElement>
	placement: ActionsPlacement
	touch: boolean
	open: OpenActions
	setOpen: (open: OpenActions) => void
	tile: boolean
	setTile: (tile: boolean) => void
}) {
	const a = useTitleActions(media)
	const scoreButton = useRef<HTMLButtonElement>(null)
	const undo = useRef<() => void>(() => {})

	const feedback = useContext(HideFeedbackContext)
	const onHide = (takeBack: () => void) => {
		setOpen(null)
		if (feedback) return feedback(media, takeBack)
		undo.current = takeBack
		setTile(true)
	}
	// The tile goes when hiding failed and the mutation put the title back.
	const failed = tile && !a.hidden && !a.hidePending
	useEffect(() => {
		if (failed) setTile(false)
	}, [failed, setTile])

	if (tile)
		return (
			<div className="absolute inset-0 flex flex-col justify-center gap-2 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/10">
				<p className="text-sm font-bold text-white">Hidden</p>
				<p className="line-clamp-3 text-xs text-gray-400">
					{media.details.title} won't show in your recommendations.
				</p>
				<button
					type="button"
					onClick={() => {
						undo.current()
						setTile(false)
					}}
					className="mt-1 cursor-pointer self-start rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-amber-300 hover:bg-white/20"
				>
					Undo
				</button>
			</div>
		)

	const closeScore = (refocus: boolean) => {
		setOpen(null)
		if (refocus) scoreButton.current?.focus()
	}
	return (
		<>
			{!touch && (
				<div
					className={`absolute inset-x-2.5 z-20 hidden gap-1 rounded-lg bg-gray-900/90 p-1 transition-opacity can-hover:flex ${ROW_AT[placement]} ${
						open === "score" ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
					}`}
				>
					<ScoreButton
						ref={scoreButton}
						score={a.score}
						aria-haspopup="dialog"
						aria-expanded={open === "score"}
						onClick={() => setOpen(open === "score" ? null : "score")}
					/>
					<ActionButton
						kind="want"
						label="none"
						size="sm"
						active={a.want}
						disabled={a.wantPending}
						onClick={a.toggleWant}
					/>
					<UserAction instructions={<>{SEEN_INSTRUCTIONS}</>}>
						<ActionButton
							kind="seen"
							label="none"
							size="sm"
							active={a.seen}
							disabled={a.seenPending}
							onClick={a.toggleSeen}
						/>
					</UserAction>
					<ActionButton
						kind="hide"
						label="none"
						size="sm"
						active={a.hidden}
						disabled={!a.canHide || a.hidePending}
						title={a.hidden ? "Not interested. Press to bring it back." : a.canHide ? "Not interested" : SEEN_SO_NOT_HIDEABLE}
						onClick={() => (a.hidden ? a.unhide() : onHide(a.hide()))}
					/>
				</div>
			)}
			{open === "score" &&
				createPortal(
					<ScorePopover
						media={media}
						frame={frame}
						placement={placement}
						opener={scoreButton}
						onClose={closeScore}
					/>,
					document.body,
				)}
			{touch && (
				<Drawer open={open === "sheet"} onClose={() => setOpen(null)} allSizes>
					<div className="mx-auto max-w-md p-1">
						<h3 className="mb-3 truncate text-sm font-semibold text-gray-300">{media.details.title}</h3>
						{open === "sheet" && <TitleActionSet media={media} onHide={onHide} />}
					</div>
				</Drawer>
			)}
		</>
	)
}

const POPOVER_WIDTH = 320
const EDGE = 8

// Sits beside the row of actions, at the end of the page so no scrolling row or card transform can clip it. Above the
// row when the row is at the card's bottom (below the card when there is no room above), below it when at the top.
function ScorePopover({
	media,
	frame,
	placement,
	opener,
	onClose,
}: {
	media: ScoredMedia
	frame: RefObject<HTMLDivElement>
	placement: ActionsPlacement
	opener: RefObject<HTMLButtonElement>
	onClose: (refocus: boolean) => void
}) {
	const panel = useRef<HTMLDivElement>(null)
	const [at, setAt] = useState<{ left: number; top: number; width: number } | null>(null)

	useLayoutEffect(() => {
		const place = () => {
			const card = frame.current?.getBoundingClientRect()
			const height = panel.current?.offsetHeight ?? 0
			if (!card) return
			const width = Math.min(POPOVER_WIDTH, window.innerWidth - 2 * EDGE)
			const left = Math.max(EDGE, Math.min(card.left + card.width / 2 - width / 2, window.innerWidth - width - EDGE))
			let top = card.top + ROW_REACH[placement]
			if (placement !== "top") {
				top = card.bottom - ROW_REACH[placement] - height
				if (top < EDGE) top = card.bottom + 4
			}
			setAt({ left: left + window.scrollX, top: top + window.scrollY, width })
		}
		place()
		panel.current?.focus({ preventScroll: true })
		window.addEventListener("resize", place)
		return () => window.removeEventListener("resize", place)
	}, [frame, placement])

	useEffect(() => {
		const onDown = (event: MouseEvent) => {
			const target = event.target as Node
			// A press on the score button closes the popover through the button's own click.
			if (panel.current?.contains(target) || opener.current?.contains(target)) return
			onClose(false)
		}
		const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose(true)
		document.addEventListener("mousedown", onDown)
		window.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("mousedown", onDown)
			window.removeEventListener("keydown", onKey)
		}
	}, [onClose, opener])

	return (
		<div
			ref={panel}
			// biome-ignore lint/a11y/useSemanticElements: a non-modal popover beside its button, not a <dialog>.
			role="dialog"
			aria-label={`Your score for ${media.details.title}`}
			tabIndex={-1}
			// Tabbing out of either end returns to the score button, since the popover is not next to it in the page.
			onKeyDown={(event) => {
				if (event.key !== "Tab") return
				const buttons = panel.current?.querySelectorAll("button")
				const edge = event.shiftKey ? buttons?.[0] : buttons?.[buttons.length - 1]
				const leaving =
					document.activeElement === edge || (event.shiftKey && document.activeElement === panel.current)
				if (!leaving) return
				event.preventDefault()
				onClose(true)
			}}
			className="absolute z-[90] rounded-2xl border border-white/10 bg-stone-900 p-4 text-white shadow-2xl shadow-black/70 outline-none"
			style={at ? { left: at.left, top: at.top, width: at.width } : { left: 0, top: 0, width: POPOVER_WIDTH, visibility: "hidden" }}
		>
			<h3 className="mb-3 truncate text-sm font-semibold text-gray-300">{media.details.title}</h3>
			<TitleScore media={media} size="compact" onRated={() => onClose(false)} />
		</div>
	)
}
