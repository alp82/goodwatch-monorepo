// Opening a pick's detail, and the phone title drawer.
// - PickContext: the page tells the results which pick's detail is open and how to toggle it. `PickTap` wraps a
//   result poster: a tap opens the detail instead of the title page (the detail links there; the card's own link
//   stays for middle-click and new tabs). It carries data-pop-id so the pop-out card can lift that poster.
// - TitleDrawer: on phones, the detail as a drawer with the recipe and print drawers' shell (rounded top, grab bar, the
//   same spring in and ease out). It slides up from behind the taste bar and stops there, so nothing of it passes over
//   the site nav. The page behind dims like it does for the card. One fixed size, a small poster at the top.
//   - next / previous: a sideways swipe anywhere on it (or the arrows, arrow keys) crossfades to the neighbour.
//   - close: drag it down (from the head, or anywhere when its content fits) past 110 px or with a flick, tap the
//     dimmed page, Escape.
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion"
import {
	createContext,
	useCallback,
	useContext,
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
import { Crossfade, DIM, DIM_IN, DIM_OUT } from "./crossfade"
import { preload, stepTo, useSwipe } from "./swipe"

export interface PickApi {
	/** The pool key of the pick whose detail is showing. */
	openId: string | null
	toggle: (r: Ranked) => void
}

export const PickContext = createContext<PickApi | null>(null)

/** A result poster: a tap opens its detail (a tap on the open one closes it). */
export function PickTap({
	r,
	children,
}: {
	r: Ranked
	children: React.ReactNode
}) {
	const api = useContext(PickContext)
	const { pool } = useForYou()
	if (!api) return <>{children}</>
	const key = pool.keys[r.index]
	const on = api.openId === key
	return (
		<div
			data-pop-id={key}
			className="relative cursor-pointer"
			onClickCapture={(e) => {
				if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
				e.preventDefault()
				e.stopPropagation()
				api.toggle(r)
			}}
		>
			{children}
			<span
				aria-hidden="true"
				className="pointer-events-none absolute -inset-1 rounded-xl ring-2 ring-amber-400 transition-opacity duration-200"
				style={{ opacity: on ? 1 : 0 }}
			/>
		</div>
	)
}

/** The recipe and print drawers' motion (ForYouPage.tsx), so all three drawers move alike. */
export const SHEET_IN = { type: "spring", stiffness: 330, damping: 34 } as const
export const SHEET_OUT = { duration: 0.28, ease: [0.4, 0, 0.9, 0.6] } as const

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

/** Phones: the title detail as a drawer, from behind the taste bar up. */
export function TitleDrawer({
	list,
	openId,
	onOpen,
	onClose,
	answer,
	bottom,
}: {
	list: Ranked[]
	openId: string | null
	onOpen: (r: Ranked) => void
	onClose: () => void
	answer: (r: Ranked) => string | null
	/** px from the screen's bottom to the taste bar's top; the drawer stops there. */
	bottom: number
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
				await stepTo({
					cx,
					co,
					ready: preload(imagesOf(next)),
					swap: () => {
						setDir(d)
						onOpen(next)
					},
				})
			} finally {
				busy.current = false
			}
		},
		[list, index, onOpen, cx, co, imagesOf],
	)

	const open = !!r
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") return onClose()
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
	}, [open, onClose, go])

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
		onClose,
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
						onClick={onClose}
						className={`fixed inset-x-0 top-0 z-[1099] ${DIM}`}
						style={{ bottom }}
						data-title-scrim=""
					/>
					{/* A clip box that ends at the taste bar, so the drawer slides in from behind it. */}
					<div
						className="pointer-events-none fixed inset-x-0 top-[max(4.5rem,10dvh)] z-[1100] overflow-hidden"
						style={{ bottom }}
					>
						<motion.div
							// biome-ignore lint/a11y/useSemanticElements: a sliding drawer, not a modal <dialog>
							role="dialog"
							aria-label={titleAt(pool, r.index).name}
							initial={{ y: "100%" }}
							animate={{ y: 0, transition: SHEET_IN }}
							exit={{ y: "100%", transition: SHEET_OUT }}
							className="pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-full flex-col"
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
									/>
									<div
										ref={scroller}
										className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
										style={{ touchAction: touch }}
									>
										<DetailBody r={r} answer={answer(r)} />
									</div>
								</Crossfade>
								<DetailFooter
									r={r}
									onStep={go}
									canPrev={index > 0}
									canNext={index < list.length - 1}
								/>
							</motion.div>
						</motion.div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
