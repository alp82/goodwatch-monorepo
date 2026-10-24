// Phones: the title drawer, the detail as a drawer with the recipe and print drawers' shell (rounded top, grab bar,
// the same spring in and ease out). It slides up from behind the taste bar and stops there, so nothing of it passes
// over the site nav. The page behind dims like it does for the card. One fixed size, a small poster at the top.
// Its code loads on first use (LazyDetail.tsx).
// - next / previous: a sideways swipe anywhere on it (or the arrows under its poster, arrow keys) crossfades to the neighbour.
// - close: drag it down (from the head, or anywhere when its content fits) past 110 px or with a flick, tap the
//   dimmed page, Escape.
// - focus moves into it on opening and stays in it and the taste bar; it returns to the pick's poster on closing.
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import type { Ranked } from "~/domain/for-you-page/rank"
import {
	DetailBody,
	DetailFooter,
	DetailHead,
	detailImages,
} from "./TitleDetail"
import { titleAt, useForYou } from "./context"
import {
	Crossfade,
	DIM,
	DIM_IN,
	DIM_OUT,
	SHEET_IN,
	SHEET_OUT,
} from "./crossfade"
import { useFocusScope } from "./focus"
import { preload, stepTo, useStepToken, useSwipe } from "./swipe"

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

/** Phones: the title detail as a drawer, from behind the taste bar up. */
export function TitleDrawer({
	list,
	openId,
	onOpen,
	onClose,
	answer,
	bottom,
	bar,
}: {
	list: Ranked[]
	openId: string | null
	onOpen: (r: Ranked) => void
	onClose: () => void
	answer: (r: Ranked) => string | null
	/** px from the screen's bottom to the taste bar's top; the drawer stops there. */
	bottom: number
	/** The taste bar, which stays usable below the drawer. */
	bar?: React.RefObject<HTMLElement>
}) {
	const { pool, detail } = useForYou()
	const index = openId
		? list.findIndex((r) => pool.keys[r.index] === openId)
		: -1
	const r = index >= 0 ? list[index] : null
	const cx = useMotionValue(0)
	const co = useMotionValue(1)
	const dy = useMotionValue(0)
	const [dir, setDir] = useState<-1 | 1>(1)

	const imagesOf = useCallback(
		(n: Ranked) => {
			const t = titleAt(pool, n.index)
			return detailImages(t, detail(t.key), "w342")
		},
		[pool, detail],
	)

	// Steps in flight end when the open title changes by anything but the step itself, on closing, and on unmount.
	const token = useStepToken()
	useIso(() => token.bump(), [openId, token])
	useEffect(() => () => token.bump(), [token])
	const close = useCallback(() => {
		token.bump()
		onClose()
	}, [onClose, token])

	const busy = useRef(false)
	const go = useCallback(
		async (d: -1 | 1) => {
			const next = list[index + d]
			if (!next) {
				animate(cx, 0, SHEET_IN)
				animate(co, 1, SHEET_IN)
				return
			}
			if (busy.current) return
			busy.current = true
			try {
				const swapped = await stepTo({
					cx,
					co,
					ready: preload(imagesOf(next)),
					live: token.take(),
					swap: () => {
						setDir(d)
						onOpen(next)
					},
				})
				if (!swapped) {
					cx.set(0)
					co.set(1)
				}
			} finally {
				busy.current = false
			}
		},
		[list, index, onOpen, cx, co, imagesOf, token],
	)

	const open = !!r
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") return close()
			if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
			e.preventDefault()
			e.stopImmediatePropagation()
			go(e.key === "ArrowRight" ? 1 : -1)
		}
		window.addEventListener("keydown", onKey, true)
		const html = document.documentElement
		const was = html.style.overflow
		html.style.overflow = "hidden"
		return () => {
			window.removeEventListener("keydown", onKey, true)
			html.style.overflow = was
		}
	}, [open, close, go])

	const dialog = useRef<HTMLDivElement>(null)
	const clip = useRef<HTMLDivElement>(null)
	const lastId = useRef<string | null>(null)
	if (openId) lastId.current = openId
	useFocusScope({
		active: open,
		scope: () => [clip.current, bar?.current],
		initial: () => dialog.current,
		returnTo: () =>
			lastId.current
				? document.querySelector<HTMLElement>(
						`[data-pop-id="${CSS.escape(lastId.current)}"] a[href]`,
					)
				: null,
	})

	useEffect(() => {
		if (open) {
			dy.set(0)
			cx.set(0)
			co.set(1)
		}
	}, [open, dy, cx, co])

	// The neighbours' images, decoded ahead.
	useEffect(() => {
		if (index < 0) return
		for (const n of [list[index + 1], list[index - 1]])
			if (n) preload(imagesOf(n))
	}, [index, list, imagesOf])

	// When the content fits without scrolling, the whole drawer takes the drag down (else only its head does).
	const scroller = useRef<HTMLDivElement>(null)
	const [fits, setFits] = useState(true)
	useIso(() => {
		const el = scroller.current
		if (!el) return
		setFits(el.scrollHeight <= el.clientHeight + 1)
	}, [openId])

	const swipe = useSwipe({
		cx,
		co,
		dy,
		canPrev: index > 0,
		canNext: index >= 0 && index < list.length - 1,
		onStep: go,
		onClose: close,
	})
	const touch = fits ? "none" : "pan-y"

	return (
		<AnimatePresence>
			{r && (
				<motion.div key="phone" className="lg:hidden">
					<motion.div
						key="scrim"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1, transition: DIM_IN }}
						exit={{ opacity: 0, transition: DIM_OUT }}
						onClick={close}
						className={`fixed inset-x-0 top-0 z-[1099] ${DIM}`}
						style={{ bottom }}
						data-title-scrim=""
					/>
					{/* A clip box that ends at the taste bar, so the drawer slides in from behind it. */}
					<div
						ref={clip}
						className="pointer-events-none fixed inset-x-0 top-[max(4.5rem,10dvh)] z-[1100] overflow-hidden"
						style={{ bottom }}
					>
						<motion.div
							// biome-ignore lint/a11y/useSemanticElements: a sliding drawer, not a modal <dialog>
							role="dialog"
							aria-label={titleAt(pool, r.index).name}
							ref={dialog}
							tabIndex={-1}
							initial={{ y: "100%" }}
							animate={{ y: 0, transition: SHEET_IN }}
							exit={{ y: "100%", transition: SHEET_OUT }}
							className="pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-full flex-col outline-none"
							data-title-drawer=""
						>
							<motion.div
								style={{ y: dy, touchAction: touch }}
								className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-t-3xl bg-gray-900 shadow-[0_-18px_40px_-10px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.14)]"
								{...swipe}
							>
								<div className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center">
									<span
										aria-hidden="true"
										className="h-1 w-10 rounded-full bg-white/25"
									/>
								</div>
								<Crossfade
									k={pool.keys[r.index]}
									dir={dir}
									cx={cx}
									co={co}
									className="min-h-0 flex-1"
								>
									<DetailHead
										r={r}
										rank={index + 1}
										poster="inline"
										headProps={{ style: { touchAction: "none" } }}
										steps={{
											onStep: go,
											canPrev: index > 0,
											canNext: index < list.length - 1,
										}}
									/>
									<div
										ref={scroller}
										className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
										style={{ touchAction: touch }}
									>
										<DetailBody r={r} answer={answer(r)} />
									</div>
								</Crossfade>
								<DetailFooter r={r} />
							</motion.div>
						</motion.div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
