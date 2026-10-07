// PROTOTYPE - throwaway. The living room around a home variant of /prototype/watching-2 (#371): the real room photo,
// TV box, canvas scale, hand, and Remote (ui/living-room), without the TV flow. Unlike round 1's room, the Remote's
// wheel and OK reach the screen (`onStep`, `onOk`), and a variant can put its own keys into the Remote's well.
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePhoneOrientation } from "~/ui/living-room/PhoneLivingRoom"
import { Remote, type RemoteProps } from "~/ui/living-room/Remote"
import { HAND_IMAGE, PHONE_ROOM, PHONE_TV_CANVAS, REMOTE_H, REMOTE_TILT_DEG, REMOTE_W, ROOM, TV_CANVAS, layoutPhone, layoutRoom } from "~/ui/living-room/room"

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

export function Room({
	desktop,
	phone,
	lcd,
	onStep,
	onOk,
	well,
}: {
	desktop: ReactNode
	phone: ReactNode
	lcd: [string, string]
	onStep: (by: 1 | -1) => void
	onOk: () => void
	/** Keys that take the place of the Remote's Watch next key. */
	well?: ReactNode
}) {
	const orientation = usePhoneOrientation()
	const root = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState<{ w: number; h: number } | null>(null)
	const [slot, setSlot] = useState<HTMLElement | null>(null)
	useIsoLayoutEffect(() => {
		const el = root.current
		if (!el) return
		const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	// The Remote is the shipped component and takes no keys from outside. For the variant that splits its Watch next
	// key, that key is hidden and a slot is put in its place in the well. Throwaway.
	const ready = !!size
	useEffect(() => {
		const key = root.current?.querySelector<HTMLElement>(".remote-well > button:nth-of-type(2)")
		if (!ready || !key || !well) return setSlot(null)
		const el = document.createElement("div")
		el.className = "grid h-[60px] grid-cols-2 gap-2"
		key.style.display = "none"
		key.after(el)
		setSlot(el)
		return () => {
			key.style.display = ""
			el.remove()
		}
	}, [ready, !!well, orientation])
	const L = useMemo(() => (size ? (orientation ? layoutPhone(size.w, size.h, orientation) : layoutRoom(size.w, size.h)) : null), [size, orientation])
	const portrait = orientation === "portrait"
	const canvas = orientation ? PHONE_TV_CANVAS : TV_CANVAS
	const remote: RemoteProps = {
		screen: { name: "home" },
		power: "on",
		menuOpen: false,
		lcd,
		serviceName: (key) => key,
		activeService: null,
		dispatch: (action) => {
			if (action.type === "step") onStep(action.by)
		},
		onOk,
	}
	return (
		<div ref={root} className="living-room fixed inset-x-0 bottom-[72px] top-16 z-40 overflow-clip bg-[#07080b] text-white lg:bottom-0">
			{L && (
				<>
					<div className="absolute" style={L.photo}>
						{portrait ? (
							<picture>
								<source type="image/avif" srcSet={PHONE_ROOM.avif} />
								<img src={PHONE_ROOM.webp} alt={PHONE_ROOM.alt} className="absolute inset-0 h-full w-full select-none" draggable={false} />
							</picture>
						) : (
							<picture>
								<source type="image/avif" srcSet={ROOM.avif} sizes={`${Math.round(L.photo.width)}px`} />
								<img src={ROOM.fallback} srcSet={ROOM.webp} sizes={`${Math.round(L.photo.width)}px`} alt={ROOM.alt} className="absolute inset-0 h-full w-full select-none" draggable={false} />
							</picture>
						)}
						<div className="absolute inset-0 bg-[#05060a] opacity-[0.12]" />
					</div>
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_100%_at_40%_40%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />
					<div
						className="absolute overflow-hidden rounded-[3px] bg-black"
						data-tv
						style={{ ...L.tv, boxShadow: "0 0 90px 8px rgba(251,191,36,0.16), 0 0 18px 1px rgba(251,191,36,0.2)" }}
					>
						<div
							className="absolute left-0 top-0 origin-top-left overflow-hidden bg-[#07080b]"
							style={{
								width: canvas.w,
								height: canvas.h,
								transform: `translate(${(L.tv.width - canvas.w * L.canvasScale) / 2}px, ${(L.tv.height - canvas.h * L.canvasScale) / 2}px) scale(${L.canvasScale})`,
							}}
						>
							{orientation ? phone : desktop}
						</div>
						<div className="tv-glass pointer-events-none absolute inset-0 rounded-[3px]" />
					</div>
					<motion.div
						className="absolute"
						style={{
							left: L.remote.left,
							top: L.remote.top,
							width: REMOTE_W * L.remote.scale,
							height: REMOTE_H * L.remote.scale,
							originX: 0.5,
							originY: 1,
							transformPerspective: 1400,
							rotateX: REMOTE_TILT_DEG,
						}}
					>
						<picture>
							<source type="image/avif" srcSet={HAND_IMAGE.avif} />
							<img src={HAND_IMAGE.webp} alt="" aria-hidden className="pointer-events-none absolute max-w-none select-none" style={L.hand} draggable={false} />
						</picture>
						<div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${L.remote.scale})` }}>
							<Remote {...remote} />
						</div>
					</motion.div>
					{slot && well && createPortal(well, slot)}
				</>
			)}
		</div>
	)
}

/** One half of the Remote's split key. */
export function WellKey({ label, d, onClick, pressed }: { label: string; d: string; onClick: () => void; pressed?: boolean }) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			onClick={onClick}
			data-well={label}
			className="remote-key flex h-[60px] w-full flex-col items-center justify-center gap-1.5 rounded-[18px] text-[10.5px] font-semibold uppercase tracking-wider"
		>
			<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<path d={d} />
			</svg>
			{label}
		</button>
	)
}
