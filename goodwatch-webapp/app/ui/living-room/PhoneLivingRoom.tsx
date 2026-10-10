// The living room on a phone (#189). Portrait is the couch: the portrait room with the TV on top and the Remote in
// the hand below it, plus a "Turn your phone" invitation. Landscape is the main phone view: the whole room above
// the site header, the TV centered on top, and the Remote under it; drag it up, or tap "Lift for more keys", for
// the feature and streaming keys. The TV shows the phone edition of the screens (#224).
//
// Touch has no pointer to follow: tap the TV or press a key and the Remote turns a quarter of the way toward it
// (at most 6 degrees), then settles. No beam. Rendering budget (#190): only transform and opacity animate,
// nothing loops at idle, and nothing blends or blurs over the room photo.
import { assetUrl } from "~/utils/asset-url"
import {
	AnimatePresence,
	animate,
	motion,
	useDragControls,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from "framer-motion"
import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import { PhoneTvScreens } from "./PhoneTvScreens"
import { Icon, Remote, type RemoteProps } from "./Remote"
import type { TvView } from "./TvScreens"
import {
	HAND_IMAGE,
	PHONE_LIP,
	PHONE_ROOM,
	PHONE_TV_CANVAS,
	type PhoneOrientation,
	REMOTE_H,
	REMOTE_TILT_DEG,
	REMOTE_W,
	ROOM,
	layoutPhone,
	phoneRemoteTurnToward,
} from "./room"
import { TV_SCREEN_ATTR } from "./tv-transition"
import { ROOM_ID } from "./use-below-room"

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

/** Phone portrait; living-room.css repeats these queries for the first paint. */
export const PHONE_PORTRAIT_QUERY = "(max-width: 767px)"
const PORTRAIT = PHONE_PORTRAIT_QUERY
const LANDSCAPE = "(orientation: landscape) and (max-height: 540px)"

/** Which phone layout the window wants: portrait when narrow, landscape when short and wide, else none. */
export function usePhoneOrientation(): PhoneOrientation | null {
	const [orientation, setOrientation] = useState<PhoneOrientation | null>(null)
	useIsoLayoutEffect(() => {
		const portrait = window.matchMedia(PORTRAIT)
		const landscape = window.matchMedia(LANDSCAPE)
		const update = () =>
			setOrientation(
				portrait.matches ? "portrait" : landscape.matches ? "landscape" : null,
			)
		update()
		portrait.addEventListener("change", update)
		landscape.addEventListener("change", update)
		return () => {
			portrait.removeEventListener("change", update)
			landscape.removeEventListener("change", update)
		}
	}, [])
	return orientation
}

export type PhoneLivingRoomProps = {
	orientation: PhoneOrientation
	view: TvView
	remote: RemoteProps
	/** The phone has the navigation's dock (REC_NAVIGATION) under the room, not the old bottom navigation. */
	docked?: boolean
	/** The room is out of the window: it takes no input. */
	away?: boolean
}

export function PhoneLivingRoom({
	orientation,
	view,
	remote,
	docked = false,
	away = false,
}: PhoneLivingRoomProps) {
	const landscape = orientation === "landscape"
	const root = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState({ w: 0, h: 0 })
	useIsoLayoutEffect(() => {
		const el = root.current
		if (!el) return
		const measure = () =>
			setSize((s) =>
				s.w === el.clientWidth && s.h === el.clientHeight
					? s
					: { w: el.clientWidth, h: el.clientHeight },
			)
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const L = useMemo(
		() => (size.w ? layoutPhone(size.w, size.h, orientation, PHONE_LIP) : null),
		[size, orientation],
	)

	// ---- Lifting the Remote (landscape): a drag on the hand or the body, or the Lift button.
	const lift = useMotionValue(0)
	const [lifted, setLifted] = useState(false)
	const drag = useDragControls()
	const settle = useCallback(
		(up: boolean) => {
			setLifted(up)
			animate(lift, up ? -(L?.lift ?? 0) : 0, {
				type: "spring",
				stiffness: 320,
				damping: 34,
			})
		},
		[L, lift],
	)
	useEffect(() => {
		if (!landscape) lift.set(0)
	}, [landscape, lift])

	// ---- Aim: a quarter turn toward the tap, or toward the TV's middle after a key press, then settle.
	const reduceMotion = useReducedMotion()
	const turn = useSpring(0, { stiffness: 220, damping: 28 })
	const lastTap = useRef(0)
	const settleTimer = useRef<ReturnType<typeof setTimeout>>()
	const aimAt = useCallback(
		(point: { x: number; y: number }) => {
			if (reduceMotion || !L) return
			turn.set(phoneRemoteTurnToward(L, point, lift.get()))
			clearTimeout(settleTimer.current)
			settleTimer.current = setTimeout(() => turn.set(0), 320)
		},
		[L, reduceMotion, turn, lift],
	)
	useEffect(() => () => clearTimeout(settleTimer.current), [])
	const firstFocus = useRef(true)
	useEffect(() => {
		if (firstFocus.current) {
			firstFocus.current = false
			return
		}
		if (!L || Date.now() - lastTap.current < 300) return
		aimAt({ x: L.tv.left + L.tv.width / 2, y: L.tv.top + L.tv.height / 2 })
	}, [view.focused, view.state.screen])

	const on = view.state.power !== "off"
	const photo = landscape ? ROOM : PHONE_ROOM
	const tvCenter = {
		x: `${((photo.tv.x + photo.tv.w / 2) / photo.w) * 100}%`,
		y: `${((photo.tv.y + photo.tv.h / 2) / photo.h) * 100}%`,
	}

	return (
		<div
			ref={root}
			id={ROOM_ID}
			{...(away && { inert: "" })}
			className={`living-room lr-page overflow-clip bg-[#07080b] text-white ${docked ? "lr-docked" : ""}`}
		>
			{L && (
				<>
					<div
						className="absolute"
						style={{
							left: L.photo.left,
							top: L.photo.top,
							width: L.photo.width,
							height: L.photo.height,
						}}
					>
						<RoomPicture
							landscape={landscape}
							width={Math.round(L.photo.width)}
						/>
						<div
							className="absolute inset-0 bg-[#05060a] transition-opacity duration-[1400ms] ease-out"
							style={{ opacity: on ? 0.12 : 0.6 }}
						/>
						<div
							className="pointer-events-none absolute inset-0 transition-opacity duration-500"
							style={{
								opacity: on ? 0.26 : 0,
								background: `radial-gradient(45% 40% at ${tvCenter.x} ${tvCenter.y}, #fbbf2455 0%, #fbbf241c 45%, #fbbf2400 100%)`,
							}}
						/>
					</div>
					{/* A short photo (a tall window) fades into the page below it. */}
					{L.photo.top + L.photo.height < size.h && (
						<div
							className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-[#07080b] to-40%"
							style={{ top: L.photo.top + L.photo.height - 160 }}
						/>
					)}
					<div
						className={`pointer-events-none absolute inset-0 ${landscape ? "bg-[radial-gradient(130%_100%_at_50%_35%,transparent_60%,rgba(0,0,0,0.55)_100%)]" : "bg-[radial-gradient(120%_80%_at_50%_30%,transparent_55%,rgba(0,0,0,0.5)_100%)]"}`}
					/>

					{/* The TV, with the phone edition of the screens scaled to cover it. */}
					<div
						{...{ [TV_SCREEN_ATTR]: "" }}
						className="absolute overflow-hidden rounded-[3px] bg-black"
						style={{
							left: L.tv.left,
							top: L.tv.top,
							width: L.tv.width,
							height: L.tv.height,
							boxShadow: on
								? "0 0 60px 6px rgba(251,191,36,0.2), 0 0 14px 1px rgba(251,191,36,0.27)"
								: "none",
						}}
						onPointerDownCapture={(e) => {
							const b = root.current?.getBoundingClientRect()
							if (!b) return
							lastTap.current = Date.now()
							aimAt({ x: e.clientX - b.left, y: e.clientY - b.top })
						}}
					>
						<div
							className="absolute left-0 top-0 origin-top-left"
							style={{
								width: PHONE_TV_CANVAS.w,
								height: PHONE_TV_CANVAS.h,
								transform: `translate(${(L.tv.width - PHONE_TV_CANVAS.w * L.canvasScale) / 2}px, ${(L.tv.height - PHONE_TV_CANVAS.h * L.canvasScale) / 2}px) scale(${L.canvasScale})`,
							}}
						>
							<PhoneTvScreens view={view} />
						</div>
						<div className="tv-glass pointer-events-none absolute inset-0 rounded-[3px]" />
					</div>

					<motion.div
						className={`absolute ${landscape ? "touch-none" : ""}`}
						style={{ left: L.remote.left, top: L.remote.top, y: lift }}
						drag={landscape ? "y" : false}
						dragControls={drag}
						dragListener={false}
						dragConstraints={{ top: -L.lift, bottom: 0 }}
						dragElastic={0.08}
						dragMomentum={false}
						onPointerDown={(e) => {
							// Keys and the wheel keep their own touches; the rest of the Remote and the hand lift it.
							if (!landscape) return
							if ((e.target as HTMLElement).closest("button, .remote-wheel"))
								return
							drag.start(e)
						}}
						onDragEnd={(_, info) =>
							settle(
								info.velocity.y < -150 ||
									(info.velocity.y <= 150 && lift.get() < -L.lift / 2),
							)
						}
					>
						<HandRemote
							scale={L.remote.scale}
							hand={L.hand}
							turn={turn}
							remote={remote}
						/>
					</motion.div>

					{landscape ? (
						<>
							{L.lift > 0 && (
								<button
									type="button"
									onClick={() => settle(!lifted)}
									className="absolute bottom-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-semibold text-white/85 ring-1 ring-white/10"
									style={{
										left: L.remote.left + REMOTE_W * L.remote.scale + 14,
									}}
								>
									<Icon
										d="M6 15l6-6 6 6"
										className={`h-3.5 w-3.5 transition-transform ${lifted ? "rotate-180" : ""}`}
									/>
									{lifted ? "Lower the remote" : "Lift for more keys"}
								</button>
							)}
							<a
								href="/"
								className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 py-1.5 pl-2 pr-3 text-[12px] font-semibold text-white/85 ring-1 ring-white/10"
							>
								<img src={assetUrl(gwLogo)} alt="" className="h-4" />
								GoodWatch
							</a>
						</>
					) : (
						<RotateHint />
					)}
				</>
			)}
		</div>
	)
}

function RoomPicture({
	landscape,
	width,
}: { landscape: boolean; width: number }) {
	return landscape ? (
		<picture>
			<source type="image/avif" srcSet={ROOM.avif} sizes={`${width}px`} />
			<img
				{...{ fetchpriority: "high" }}
				src={assetUrl(ROOM.fallback)}
				srcSet={ROOM.webp}
				sizes={`${width}px`}
				alt={ROOM.alt}
				width={ROOM.w}
				height={ROOM.h}
				className="absolute inset-0 h-full w-full select-none"
				draggable={false}
			/>
		</picture>
	) : (
		<picture>
			<source type="image/avif" srcSet={assetUrl(PHONE_ROOM.avif)} />
			<img
				{...{ fetchpriority: "high" }}
				src={assetUrl(PHONE_ROOM.webp)}
				alt={PHONE_ROOM.alt}
				width={PHONE_ROOM.w}
				height={PHONE_ROOM.h}
				className="absolute inset-0 h-full w-full select-none"
				draggable={false}
			/>
		</picture>
	)
}

// The final Remote in the graded hand, tipped back toward the TV and turned by `turn` from the bottom.
function HandRemote({
	scale,
	hand,
	turn,
	remote,
}: {
	scale: number
	hand: { left: number; top: number; width: number; height: number }
	turn: ReturnType<typeof useSpring>
	remote: RemoteProps
}) {
	return (
		<motion.div
			className="relative will-change-transform"
			style={{
				width: REMOTE_W * scale,
				height: REMOTE_H * scale,
				originX: 0.5,
				originY: 1,
				transformPerspective: 1200,
				rotateX: REMOTE_TILT_DEG,
				rotate: turn,
			}}
		>
			<picture>
				<source type="image/avif" srcSet={assetUrl(HAND_IMAGE.avif)} />
				<img
					src={assetUrl(HAND_IMAGE.webp)}
					alt=""
					aria-hidden
					draggable={false}
					className="pointer-events-none absolute max-w-none select-none"
					style={hand}
				/>
			</picture>
			<div
				className="absolute left-0 top-0 origin-top-left"
				style={{ transform: `scale(${scale})` }}
			>
				<Remote {...remote} />
			</div>
		</motion.div>
	)
}

const PHONE_ICON =
	"M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2"

// Portrait: an invitation to turn the phone, at the bottom left over the hand (above the lip of the section below the room), gone by itself
// after 7 s.
function RotateHint(): ReactNode {
	const [gone, setGone] = useState(false)
	useEffect(() => {
		const id = setTimeout(() => setGone(true), 7000)
		return () => clearTimeout(id)
	}, [])
	return (
		<AnimatePresence>
			{!gone && (
				<motion.button
					type="button"
					onClick={() => setGone(true)}
					className={`absolute bottom-[72px] left-3 z-20 flex items-center gap-2.5 rounded-2xl bg-black/70 py-2 pl-2.5 pr-3.5 text-left text-[12.5px] font-semibold leading-tight text-white shadow-2xl ring-1 ring-white/15`}
					initial={{ opacity: 0, y: -6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ delay: 1.2, duration: 0.4 }}
				>
					<motion.span
						className="text-amber-300"
						initial={{ rotate: 0 }}
						animate={{ rotate: -90 }}
						transition={{ delay: 2, duration: 0.7, ease: "easeInOut" }}
					>
						<Icon d={PHONE_ICON} className="h-7 w-7" />
					</motion.span>
					<span>
						Turn your phone
						<br />
						<span className="font-normal text-white/70">
							for the whole room
						</span>
					</span>
				</motion.button>
			)}
		</AnimatePresence>
	)
}
