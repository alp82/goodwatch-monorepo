// A poster card's actions on a touch screen, after the first tap on the poster: a band under the card (the screen's
// full width on phones, 420 px from 640 px), with the page dimmed around the card. Its size never follows the card's,
// so a small card's actions are as large as a big one's.
//
// The band holds four tiles (Seen, or a show's status; Score; Want; Not for me) and Open details. Seen and Score open
// their drawer inside the band, under the tiles, as one raised piece with the tile: the score picker; a seen movie's
// watch log; a show's status menu. A first Seen on an unscored title opens the score drawer, as Seen asks for the score
// everywhere. Open details is the only way to the title page (or to the page's own view of the title, `onOpen`); a
// second tap on the poster, a tap on the dim, or Escape closes the band (CardActions, MovieTvCard).
//
// Motion is transform and opacity only. The band is placed by hand, outside React's renders, and each change of its
// size or place plays from the last laid-out state (FLIP): the surface scales, the rows move; a drawer that goes fades
// where it was while the band closes over it; the selection slides between tiles.
import {
	BookmarkIcon,
	ChevronRightIcon,
	NoSymbolIcon,
	StarIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import {
	type ReactNode,
	type RefObject,
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import UserAction from "~/ui/auth/UserAction"
import { NESTED_OVERLAY_SELECTOR, useOverlayRoot } from "~/ui/overlay"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import {
	SEEN_INSTRUCTIONS,
	SEEN_SO_NOT_HIDEABLE,
	useTitleActions,
} from "~/ui/title-actions/useTitleActions"
import { STATUS_LOOK } from "~/ui/tracking/status-look"
import { type ScoredMedia, useScoreAction } from "~/ui/user/actions/ScoreAction"
import { WatchLog } from "~/ui/watch-log/WatchLog"
import { useUser } from "~/utils/auth"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { FOCUS } from "./look"
import { useTitleMarks } from "./marks"
import { setRevealed } from "./reveal"
import { seenFaceOf } from "./seen-face"

const ShowStatus = lazy(reloadOnStaleChunk(() => import("./ShowStatus")))
const NotSeenConfirm = lazy(
	reloadOnStaleChunk(() => import("~/ui/details/hero/NotSeenConfirm")),
)

const EASE = "cubic-bezier(.22,.8,.24,1)"
/** The band's size and place changes. */
const MS = 280
/** The band's own way out, which the card waits for before it unmounts it. */
export const BAND_LEAVE_MS = 180
const GAP = 4

const reduced = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

type DrawerKey = "seen" | "score"
const COLUMN: Record<DrawerKey, number> = { seen: 0, score: 1 }

interface Laid {
	top: number
	height: number
	openY: number
}

export function TapBand({
	media,
	href,
	discover,
	onOpen,
	frame,
	leaving,
	onHide,
	onTracking,
}: {
	media: ScoredMedia
	/** The title page. */
	href: string
	discover?: "none"
	/** The page's own view of the title, which Open details opens instead of the title page. */
	onOpen?: () => void
	/** The card, which the band sits under and leaves undimmed. */
	frame: RefObject<HTMLDivElement>
	/** The band is on its way out: it fades and takes no more taps. */
	leaving: boolean
	/** Not interested was turned on; the argument takes it back. */
	onHide: (takeBack: () => void) => void
	/** A show's status menu opened: the card keeps its tracking's toasts from then on. */
	onTracking: () => void
}) {
	const a = useTitleActions(media)
	const { status } = useTitleMarks(media.mediaType, media.details.tmdb_id)
	const { user } = useUser()
	const { rate, isPending: rating } = useScoreAction(media)
	const isShow = media.mediaType === "show"
	const tracked = isShow && Boolean(user)
	const root = useOverlayRoot()

	const [drawer, setDrawer] = useState<DrawerKey | null>(null)
	/** The score drawer opened after a first Seen: it says so. */
	const [afterSeen, setAfterSeen] = useState(false)
	const [logNote, setLogNote] = useState<{
		text: string
		undo: () => void
	} | null>(null)
	const [askNotSeen, setAskNotSeen] = useState(false)
	const seenTile = useRef<HTMLButtonElement>(null)

	const toggle = (key: DrawerKey) => {
		setAfterSeen(false)
		setDrawer((was) => (was === key ? null : key))
	}

	const pressSeen = (event: { currentTarget: HTMLElement }) => {
		if (tracked) {
			onTracking()
			return toggle("seen")
		}
		if (!a.seen) {
			// A watch for now (the watch log's toast offers Change date and Undo), then the score, when there is none.
			a.toggleSeen(event, null)
			if (a.score === null) {
				setAfterSeen(true)
				setDrawer("score")
			}
			return
		}
		toggle("seen")
	}

	// A show that turns Seen in its status menu, still without a score, asks for one next.
	const lastStatus = useRef(status)
	useEffect(() => {
		if (lastStatus.current === status) return
		lastStatus.current = status
		if (drawer === "seen" && status === "seen" && a.score === null) {
			setAfterSeen(true)
			setDrawer("score")
		}
	}, [status, drawer, a.score])

	const closeSoon = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => () => clearTimeout(closeSoon.current), [])
	const onRate = (score: Parameters<typeof rate>[0]) => {
		const firstOnShow = tracked && !status && a.score === null
		if (!rate(score)) return
		clearTimeout(closeSoon.current)
		// A first score on a show that isn't started goes on to its status (how far), as on the title page; otherwise
		// the drawer folds away once the choice has shown.
		closeSoon.current = setTimeout(() => {
			if (firstOnShow) {
				onTracking()
				setAfterSeen(false)
				setDrawer("seen")
			} else setDrawer(null)
		}, 350)
	}

	const pressHide = () => (a.hidden ? a.unhide() : onHide(a.hide()))

	const seenFace = seenFaceOf(isShow, status, a.seen)
	const seenOn = isShow ? Boolean(status) : a.seen
	const seenName = isShow
		? `Status: ${status ? STATUS_LOOK[status].word : "Not started"}. Change it`
		: a.seen
			? "Seen. Open your watches"
			: "Mark as Seen"
	const hideName = a.hidden
		? "Not interested. Press to bring it back."
		: a.canHide
			? "Not interested"
			: SEEN_SO_NOT_HIDEABLE

	const tiles = (
		<>
			<UserAction instructions={SEEN_INSTRUCTIONS}>
				<button
					ref={seenTile}
					type="button"
					aria-label={seenName}
					aria-expanded={drawer === "seen"}
					disabled={!tracked && a.seenPending}
					onPointerEnter={a.seenLog?.onPointerEnter}
					onFocus={a.seenLog?.onFocus}
					onClick={pressSeen}
					className={`${TILE} ${seenOn ? (isShow && status !== "seen" ? "text-sky-300" : "text-green-300") : OFF}`}
				>
					<seenFace.Icon className="shrink-0" aria-hidden />
					<span>
						{isShow
							? status
								? STATUS_LOOK[status].word
								: "Status"
							: a.seen
								? "Seen"
								: "Seen it?"}
					</span>
				</button>
			</UserAction>
			<button
				type="button"
				aria-expanded={drawer === "score"}
				aria-label={
					a.score
						? `Your score: ${a.score}, ${scoreLabels[a.score]}. Change it`
						: "Score it"
				}
				onClick={() => toggle("score")}
				className={`${TILE} text-gray-300`}
			>
				{a.score ? (
					<span
						className="h-5 text-xl font-black leading-5 tabular-nums"
						style={{ color: getVibeColorValue(a.score) }}
					>
						{a.score}
					</span>
				) : (
					<StarIcon className="shrink-0 text-yellow-300/80" aria-hidden />
				)}
				<span>{a.score ? "Your score" : "Score"}</span>
			</button>
			<button
				type="button"
				aria-pressed={a.want}
				aria-label={a.seen ? "Want to rewatch" : "Want to See"}
				disabled={a.wantPending}
				onClick={a.toggleWant}
				className={`${TILE} ${a.want ? "text-amber-300" : OFF}`}
			>
				<BookmarkIcon className="shrink-0" aria-hidden />
				<span>{a.want ? "On Wishlist" : a.seen ? "Rewatch" : "Want"}</span>
			</button>
			<button
				type="button"
				aria-pressed={a.hidden}
				aria-label={hideName}
				disabled={(!a.canHide && !a.hidden) || a.hidePending}
				onClick={pressHide}
				className={`${TILE} ${a.hidden ? "text-pink-300" : OFF}`}
			>
				<NoSymbolIcon className="shrink-0" aria-hidden />
				<span>Not for me</span>
			</button>
		</>
	)

	const scoreBody = (
		<>
			{afterSeen && (
				<p className="mb-3 text-sm text-gray-300">
					Seen.{" "}
					<span className="font-semibold text-white">What's your score?</span>
				</p>
			)}
			<ScoreControl
				value={a.score}
				busy={rating}
				onRate={onRate}
				onClear={() => rate(null)}
			/>
		</>
	)
	const seenBody = tracked ? (
		<Suspense fallback={<p className="py-2 text-sm text-gray-400">Loading…</p>}>
			<ShowStatus
				media={media}
				inline
				anchor={null}
				onClose={() => setDrawer(null)}
				onHide={onHide}
			/>
		</Suspense>
	) : (
		<>
			<WatchLog
				movie={{ tmdbId: media.details.tmdb_id, title: media.details.title }}
				editing={null}
				say={(text, undo) => setLogNote({ text, undo })}
				onNotSeen={() => setAskNotSeen(true)}
			/>
			{logNote && (
				<p
					className="mt-3 flex items-center justify-between gap-3 text-sm text-gray-300"
					aria-live="polite"
				>
					{logNote.text}
					<button
						type="button"
						onClick={() => {
							logNote.undo()
							setLogNote(null)
						}}
						className={`min-h-11 shrink-0 cursor-pointer rounded-lg px-2 font-semibold text-amber-300 ${FOCUS}`}
					>
						Undo
					</button>
				</p>
			)}
		</>
	)

	const open = (
		<Link
			to={href}
			discover={discover}
			onClick={(event) => {
				setRevealed(null)
				if (!onOpen || event.button !== 0) return
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
					return
				event.preventDefault()
				onOpen()
			}}
			className={`flex h-11 w-full items-center justify-center gap-0.5 rounded-xl text-sm font-semibold text-amber-300 ${FOCUS}`}
		>
			Open details
			<ChevronRightIcon className="-mr-0.5 size-4" aria-hidden />
		</Link>
	)

	if (!root) return null
	return (
		<>
			<div
				className={`pointer-events-none absolute inset-0 z-20 rounded-lg ring-2 ring-amber-400/90 transition-opacity duration-200 ${leaving ? "opacity-0" : ""}`}
			/>
			{createPortal(
				<Band
					frame={frame}
					title={media.details.title}
					leaving={leaving}
					tiles={tiles}
					open={open}
					drawer={
						drawer && {
							key: drawer,
							body: drawer === "score" ? scoreBody : seenBody,
						}
					}
				/>,
				root,
			)}
			{askNotSeen && (
				<Suspense fallback={null}>
					<NotSeenConfirm
						media={media}
						score={a.score}
						poster={null}
						year={null}
						anchor={() => seenTile.current}
						onDone={() => {
							setAskNotSeen(false)
							setDrawer(null)
						}}
					/>
				</Suspense>
			)}
		</>
	)
}

/** A tile: no fill; its state is the colour of its icon and word. The selection under it is the band's. */
const TILE = `relative inline-flex h-14 w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl text-[11px] font-semibold leading-none [&_svg]:size-5 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`
const OFF = "text-gray-300 [&_svg]:text-gray-400"

interface Drawer {
	key: DrawerKey
	body: ReactNode
}

function Band({
	frame,
	title,
	leaving,
	tiles,
	open,
	drawer,
}: {
	frame: RefObject<HTMLDivElement>
	title: string
	leaving: boolean
	tiles: ReactNode
	open: ReactNode
	drawer: Drawer | null
}) {
	const panel = useRef<HTMLElement>(null)
	const shell = useRef<HTMLDivElement>(null)
	const surface = useRef<HTMLDivElement>(null)
	const body = useRef<HTMLDivElement>(null)
	const openRow = useRef<HTMLDivElement>(null)
	const selection = useRef<HTMLDivElement>(null)
	const pointerUp = useRef<HTMLDivElement>(null)
	const pointerDown = useRef<HTMLDivElement>(null)
	const slot = useRef<HTMLDivElement>(null)
	const dim = useRef<HTMLDivElement>(null)
	const last = useRef<Laid | null>(null)

	// A drawer that goes stays a moment where it was, fading, while the band closes over it: a copy of its last
	// markup, inert, so nothing of it runs twice.
	const [ghost, setGhost] = useState<{ node: Node; top: number } | null>(null)
	const shownKey = useRef<DrawerKey | null>(drawer?.key ?? null)
	if (shownKey.current !== (drawer?.key ?? null)) {
		shownKey.current = drawer?.key ?? null
		const gone = slot.current?.firstElementChild
		if (gone && slot.current)
			setGhost({ node: gone.cloneNode(true), top: slot.current.offsetTop })
	}
	const ghostBox = useRef<HTMLDivElement>(null)
	useLayoutEffect(() => {
		const box = ghostBox.current
		if (!box || !ghost) return
		box.setAttribute("inert", "")
		box.replaceChildren(ghost.node)
		if (!reduced())
			box.animate([{ opacity: 1 }, { opacity: 0 }], {
				duration: 140,
				easing: "ease-out",
				fill: "forwards",
			})
	}, [ghost])
	useEffect(() => {
		if (!ghost) return
		const timer = setTimeout(() => setGhost(null), MS)
		return () => clearTimeout(timer)
	}, [ghost])

	/** Places the band under the card (over it when there's no room below), and plays the change when `animate`. */
	const lay = useCallback(
		(animate: boolean) => {
			const el = panel.current
			const card = frame.current?.getBoundingClientRect()
			if (!el || !card || !openRow.current) return
			// The screen's width: innerWidth grows past it on a phone when the page overflows sideways, which put the
			// band's right part (Not for me) off screen and Open details off center.
			const vw = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth)
			const vh = window.innerHeight
			const phone = vw < 640
			const width = phone ? vw : 420
			const left = phone
				? 0
				: Math.max(
						8,
						Math.min(vw - width - 8, card.left + card.width / 2 - width / 2),
					)
			const height = el.offsetHeight
			const roomBelow = vh - card.bottom - 18
			const roomAbove = card.top - 18
			const below = height <= roomBelow || roomBelow >= roomAbove
			const top = below
				? Math.min(card.bottom + 10, Math.max(8, vh - 8 - height))
				: Math.max(8, card.top - 10 - height)
			el.style.transform = `translate(${left}px, ${top}px)`
			el.style.width = `${width}px`
			const x = Math.max(
				18,
				Math.min(width - 18, card.left + card.width / 2 - left),
			)
			for (const [pointer, on] of [
				[pointerUp.current, below],
				[pointerDown.current, !below],
			] as const) {
				if (!pointer) continue
				pointer.style.left = `${x - 7}px`
				pointer.style.opacity = on ? "1" : "0"
			}
			if (dim.current)
				dim.current.style.clipPath = `path(evenodd, "M0 0H${vw}V${vh}H0Z M${card.left} ${card.top}h${card.width}v${card.height}h-${card.width}Z")`

			const now: Laid = { top, height, openY: openRow.current.offsetTop }
			const was = last.current
			last.current = now
			if (!animate || !was || reduced()) return
			const dy = was.top - now.top
			const sy = was.height / now.height
			if (Math.abs(dy) < 0.5 && Math.abs(sy - 1) < 0.002) return
			const timing = { duration: MS, easing: EASE }
			surface.current?.animate(
				[
					{ transform: `translateY(${dy}px) scaleY(${sy})` },
					{ transform: "none" },
				],
				timing,
			)
			body.current?.animate(
				[{ transform: `translateY(${dy}px)` }, { transform: "none" }],
				timing,
			)
			const openDy = was.top + was.openY - (now.top + now.openY)
			openRow.current.animate(
				[{ transform: `translateY(${openDy}px)` }, { transform: "none" }],
				timing,
			)
		},
		[frame],
	)

	// The selection under the open drawer's tile, and the pointer joining it to the drawer: they slide between tiles.
	const column = drawer ? COLUMN[drawer.key] : null
	const lastColumn = useRef<number | null>(null)
	const select = useCallback(() => {
		const piece = selection.current
		const row = piece?.parentElement
		if (!piece || !row) return
		const w = (row.clientWidth - GAP * 3) / 4
		piece.style.width = `${w}px`
		const slide = lastColumn.current !== null && column !== null && !reduced()
		piece.style.transition = slide
			? `transform ${MS}ms ${EASE}, opacity 180ms ease-out`
			: "opacity 180ms ease-out"
		if (column !== null)
			piece.style.transform = `translateX(${column * (w + GAP)}px)`
		piece.style.opacity = column === null ? "0" : "1"
		lastColumn.current = column
	}, [column])

	useLayoutEffect(() => {
		lay(true)
		select()
	})
	useEffect(() => {
		const el = panel.current
		const observer = new ResizeObserver(() => {
			lay(true)
			select()
		})
		if (el) observer.observe(el)
		const still = () => lay(false)
		window.addEventListener("scroll", still, true)
		window.addEventListener("resize", still)
		return () => {
			observer.disconnect()
			window.removeEventListener("scroll", still, true)
			window.removeEventListener("resize", still)
		}
	}, [lay, select])

	// In: the dim fades in, the band rises into place. Out: both fade, the band lifting a little.
	useLayoutEffect(() => {
		if (reduced()) return
		dim.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: 220,
			easing: "ease-out",
		})
		shell.current?.animate(
			[
				{ transform: "translateY(-8px)", opacity: 0 },
				{ transform: "none", opacity: 1 },
			],
			{ duration: 240, easing: EASE },
		)
	}, [])
	// A tap on the card again during the fade takes the band back: the fade is cancelled, not left filled.
	const fades = useRef<Animation[]>([])
	useLayoutEffect(() => {
		if (!leaving) {
			for (const fade of fades.current) fade.cancel()
			fades.current = []
			return
		}
		const timing = {
			duration: reduced() ? 1 : BAND_LEAVE_MS,
			easing: "ease-in",
			fill: "forwards" as const,
		}
		fades.current = [
			dim.current?.animate([{ opacity: 1 }, { opacity: 0 }], timing),
			shell.current?.animate(
				[
					{ transform: "none", opacity: 1 },
					{ transform: "translateY(-6px)", opacity: 0 },
				],
				timing,
			),
		].filter((fade): fade is Animation => Boolean(fade))
	}, [leaving])

	// The first tile takes the focus, for a screen reader on a touch screen; the card gives it back when the band goes.
	useEffect(() => {
		panel.current
			?.querySelector<HTMLElement>("button")
			?.focus({ preventScroll: true })
	}, [])

	return (
		<>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes the band too (CardActions). */}
			<div
				ref={dim}
				data-card-dim=""
				onClick={() => setRevealed(null)}
				className={`fixed inset-0 z-[1060] bg-black/70 ${leaving ? "pointer-events-none" : ""}`}
			/>
			<section
				ref={panel}
				data-card-popout=""
				aria-label={`Actions for ${title}`}
				style={{ transform: "translate(0, -9999px)" }}
				className={`fixed top-0 left-0 z-[1070] w-full ${leaving ? "pointer-events-none" : ""}`}
			>
				<div ref={shell} className="max-h-[calc(100dvh-1rem)]">
					{/* The surface: scaled when the band changes size; its content never is. */}
					<div
						ref={surface}
						aria-hidden
						className="absolute inset-0 origin-top bg-gray-900 shadow-[0_10px_40px_rgba(0,0,0,.6)] ring-1 ring-white/10 sm:rounded-2xl"
					/>
					<div
						ref={pointerUp}
						aria-hidden
						className="absolute -top-[7px] size-3.5 rotate-45 bg-gray-900 opacity-0 [clip-path:polygon(0_0,100%_0,0_100%)]"
					/>
					<div ref={body} className="relative px-2 pt-2">
						<div className="relative grid grid-cols-4 gap-1">
							<div
								ref={selection}
								aria-hidden
								className="absolute inset-y-0 left-0 rounded-xl bg-gray-800 opacity-0"
							/>
							{tiles}
						</div>
						<div ref={slot}>
							{drawer && (
								<DrawerCard key={drawer.key}>{drawer.body}</DrawerCard>
							)}
						</div>
						{ghost && (
							<div
								ref={ghostBox}
								aria-hidden
								className="pointer-events-none absolute inset-x-2"
								style={{ top: ghost.top }}
							/>
						)}
					</div>
					<div
						ref={openRow}
						className="relative z-10 bg-gray-900 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl"
					>
						<div className="mt-2 border-t border-white/10 pt-1">{open}</div>
						<div
							ref={pointerDown}
							aria-hidden
							className="absolute -bottom-[7px] size-3.5 rotate-45 bg-gray-900 opacity-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]"
						/>
					</div>
				</div>
			</section>
		</>
	)
}

/**
 * The raised piece under the selected tile: fades in a beat after the band starts to grow. A long one (a watch log,
 * an episode menu) scrolls inside, so the tiles and Open details stay on a short screen.
 */
function DrawerCard({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	useLayoutEffect(() => {
		if (!ref.current || reduced()) return
		ref.current.animate(
			[
				{ opacity: 0, transform: "translateY(-6px)" },
				{ opacity: 1, transform: "none" },
			],
			{ duration: 220, delay: 70, easing: EASE, fill: "backwards" },
		)
	}, [])
	return (
		<div
			ref={ref}
			className="mt-1 max-h-[calc(100dvh-13rem)] overflow-y-auto overscroll-contain rounded-xl bg-gray-800 p-3 text-white"
		>
			{children}
		</div>
	)
}

/**
 * A nested overlay outside the band is open (the not-seen question, a date dialog, a sign-in prompt): Escape is its.
 * The band's own inline menus carry the mark too, and don't count.
 */
export const bandOverlayOpen = () =>
	[...document.querySelectorAll(NESTED_OVERLAY_SELECTOR)].some(
		(node) => !node.closest("[data-card-popout]"),
	)
