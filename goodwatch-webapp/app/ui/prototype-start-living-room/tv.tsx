// PROTOTYPE - throwaway. The TV itself, shared by every living room variant: a fixed 960 x 528 canvas that
// scales to whatever screen it sits in, the channel-change static, the on-screen channel number, the
// power-on sweep, the zap sound, and the remote control.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"

export const CANVAS_W = 960
export const CANVAS_H = 528

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

const FULL = "inset(0% 0% 0% 0%)"
const LINE = "inset(49.7% 0% 49.7% 0%)"
const DOT = "inset(49.7% 49.7% 49.7% 49.7%)"

// ---------------------------------------------------------------------------------------------------------
// Channel state: one hook every variant uses, so zapping behaves the same everywhere.

export interface ChannelInfo {
	num: number
	id: string
	name: string
	short: string
	glow: string
	pitch: string
	line: string
}

export function useZapper(count: number, opts: { start?: number; sound?: boolean } = {}) {
	const [ch, setCh] = useState(opts.start ?? 0)
	const [zapId, setZapId] = useState(0)
	const [dir, setDir] = useState<1 | -1>(1)
	const [on, setOn] = useState(false)
	const [muted, setMuted] = useState(false)
	const chRef = useRef(ch)
	const tune = useCallback(
		(next: number, from: "remote" | "auto" | "scroll" = "remote") => {
			const n = ((next % count) + count) % count
			const prev = chRef.current
			if (prev === n) return
			chRef.current = n
			setDir(n > prev ? 1 : -1)
			setZapId((z) => z + 1)
			setCh(n)
			if (from === "remote" && !muted) zapSound()
		},
		[count, muted],
	)
	return { ch, zapId, dir, on, setOn, tune, muted, setMuted }
}

export type Zapper = ReturnType<typeof useZapper>

// Up and down change the channel; digits jump. Left and right belong to the prototype switcher.
export function useRemoteKeys(z: Zapper, count: number, extra?: (e: KeyboardEvent) => void) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement
			if (t.closest("input, textarea, [contenteditable]")) return
			if (e.key === "ArrowUp") {
				e.preventDefault()
				z.tune(z.ch + 1)
			} else if (e.key === "ArrowDown") {
				e.preventDefault()
				z.tune(z.ch - 1)
			} else if (/^[1-9]$/.test(e.key) && Number(e.key) <= count) z.tune(Number(e.key) - 1)
			else extra?.(e)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
}

// Horizontal swipe on the screen zaps; vertical is left to page scrolling.
export function useSwipe(onSwipe: (dir: 1 | -1) => void) {
	const start = useRef<{ x: number; y: number } | null>(null)
	return {
		onPointerDown: (e: React.PointerEvent) => {
			start.current = { x: e.clientX, y: e.clientY }
		},
		onPointerUp: (e: React.PointerEvent) => {
			const s = start.current
			start.current = null
			if (!s) return
			const dx = e.clientX - s.x
			const dy = e.clientY - s.y
			if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) onSwipe(dx < 0 ? 1 : -1)
		},
	}
}

// ---------------------------------------------------------------------------------------------------------
// Sound: a short band-passed noise burst, the click-hiss of an old set changing channel. Made on demand,
// only after the person pressed something, so it never autoplays.

let ctx: AudioContext | null = null
export function zapSound() {
	try {
		ctx ??= new AudioContext()
		const len = Math.floor(ctx.sampleRate * 0.16)
		const buf = ctx.createBuffer(1, len, ctx.sampleRate)
		const data = buf.getChannelData(0)
		for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2
		const src = ctx.createBufferSource()
		src.buffer = buf
		const band = ctx.createBiquadFilter()
		band.type = "bandpass"
		band.frequency.value = 2600
		band.Q.value = 0.7
		const gain = ctx.createGain()
		gain.gain.value = 0.07
		src.connect(band).connect(gain).connect(ctx.destination)
		src.start()
		// The relay click that starts it.
		const osc = ctx.createOscillator()
		const og = ctx.createGain()
		osc.frequency.value = 1900
		og.gain.setValueAtTime(0.05, ctx.currentTime)
		og.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.025)
		osc.connect(og).connect(ctx.destination)
		osc.start()
		osc.stop(ctx.currentTime + 0.03)
	} catch {}
}

// ---------------------------------------------------------------------------------------------------------
// Noise texture, generated once in the browser.

let noiseUrl: string | null = null
function useNoise() {
	const [url, setUrl] = useState<string | null>(noiseUrl)
	useEffect(() => {
		if (noiseUrl) return
		const c = document.createElement("canvas")
		c.width = c.height = 220
		const g = c.getContext("2d")!
		const img = g.createImageData(220, 220)
		for (let i = 0; i < img.data.length; i += 4) {
			const v = Math.random() * 255
			img.data[i] = img.data[i + 1] = img.data[i + 2] = v
			img.data[i + 3] = 255
		}
		g.putImageData(img, 0, 0)
		noiseUrl = c.toDataURL()
		setUrl(noiseUrl)
	}, [])
	return url
}

// ---------------------------------------------------------------------------------------------------------
// The screen: scales the 960 x 528 canvas into its box, plays the zap between channels, adds glass.

export function Screen({
	z,
	channels,
	render,
	className = "",
	radius = 3,
	glass = true,
	osd = true,
	swipe = true,
	pointer = false,
	onPick,
	overlay,
	onPointerOver,
}: {
	z: Zapper
	channels: ChannelInfo[]
	render: (ch: number) => ReactNode
	className?: string
	radius?: number
	glass?: boolean
	osd?: boolean
	swipe?: boolean
	// Round 3: a smart-TV pointer that follows the mouse over the screen, and clicks on [data-pick] items.
	pointer?: boolean
	onPick?: (el: HTMLElement) => void
	overlay?: ReactNode
	onPointerOver?: (over: boolean) => void
}) {
	const box = useRef<HTMLDivElement>(null)
	const [fit, setFit] = useState({ scale: 0, dx: 0, dy: 0 })
	const scale = fit.scale
	const noise = useNoise()
	useIso(() => {
		const el = box.current
		if (!el) return
		// Cover the screen: TVs differ a little from 960 x 528, so crop the overflow evenly.
		const measure = () => {
			const s = Math.max(el.clientWidth / CANVAS_W, el.clientHeight / CANVAS_H)
			setFit({ scale: s, dx: (el.clientWidth - CANVAS_W * s) / 2, dy: (el.clientHeight - CANVAS_H * s) / 2 })
		}
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		measure()
		return () => ro.disconnect()
	}, [])
	const swipeProps = useSwipe((d) => z.tune(z.ch + d))
	const info = channels[z.ch]
	// The pointer moves by writing its transform directly: no React render per mouse move.
	const cur = useRef<HTMLDivElement>(null)
	const [press, setPress] = useState(0)
	const pointerProps = pointer
		? {
				onPointerMove: (e: React.PointerEvent) => {
					const el = cur.current
					if (e.pointerType !== "mouse" || !box.current || !scale || !el) return
					const b = box.current.getBoundingClientRect()
					const x = (e.clientX - b.left - fit.dx) / scale
					const y = (e.clientY - b.top - fit.dy) / scale
					el.style.transform = `translate(${x}px, ${y}px)`
					el.style.opacity = "1"
					el.dataset.hot = (e.target as HTMLElement).closest("[data-pick]") ? "1" : "0"
				},
				onPointerEnter: () => onPointerOver?.(true),
				onPointerLeave: () => {
					if (cur.current) cur.current.style.opacity = "0"
					onPointerOver?.(false)
				},
			}
		: {}

	return (
		<div
			ref={box}
			className={`lr-screen relative overflow-hidden bg-black select-none ${className}`}
			style={{ borderRadius: radius, touchAction: swipe ? "pan-y" : undefined, cursor: pointer ? "none" : undefined }}
			{...(swipe ? swipeProps : {})}
			{...pointerProps}
			onClick={(e) => {
				const el = (e.target as HTMLElement).closest("[data-pick]") as HTMLElement | null
				if (el && onPick) {
					setPress((p) => p + 1)
					onPick(el)
				}
			}}
		>
			<div
				className="absolute left-0 top-0 origin-top-left"
				style={{ width: CANVAS_W, height: CANVAS_H, transform: `translate(${fit.dx}px, ${fit.dy}px) scale(${scale})`, opacity: scale ? 1 : 0 }}
			>
				{/* Power, like an old set. On: a dot, then a line, then the picture. Off: the reverse, then dark. */}
				<motion.div
					className="absolute inset-0"
					initial={false}
					animate={
						z.on
							? { clipPath: [DOT, LINE, FULL], opacity: [1, 1, 1] }
							: { clipPath: [FULL, LINE, DOT, DOT], opacity: [1, 1, 1, 0] }
					}
					transition={z.on ? { duration: 0.85, times: [0, 0.3, 1], ease: [0.6, 0, 0.2, 1] } : { duration: 0.7, times: [0, 0.4, 0.75, 1], ease: "easeIn" }}
				>
					<AnimatePresence initial={false} custom={z.dir}>
						<motion.div
							key={z.ch}
							custom={z.dir}
							className="absolute inset-0"
							variants={{
								enter: (d: number) => ({ opacity: 0, y: d * 26, filter: "brightness(2.2) blur(3px)", scaleY: 1.04 }),
								center: { opacity: 1, y: 0, filter: "brightness(1) blur(0px)", scaleY: 1 },
								exit: (d: number) => ({ opacity: 0, y: d * -18, filter: "brightness(2) blur(4px)", scaleY: 0.97 }),
							}}
							initial="enter"
							animate="center"
							exit="exit"
							transition={{ duration: 0.34, ease: [0.2, 0.7, 0.1, 1], opacity: { duration: 0.2 } }}
						>
							{render(z.ch)}
						</motion.div>
					</AnimatePresence>

					{/* Static burst between channels. */}
					<AnimatePresence>
						{z.zapId > 0 && (
							<motion.div
								key={z.zapId}
								className="lr-static pointer-events-none absolute inset-0 z-30"
								style={{ backgroundImage: noise ? `url(${noise})` : undefined }}
								initial={{ opacity: 0.85 }}
								animate={{ opacity: 0 }}
								transition={{ duration: 0.42, ease: "easeIn" }}
							>
								<div className="lr-roll absolute inset-x-0 h-16 bg-white/25 blur-md" />
							</motion.div>
						)}
					</AnimatePresence>

					{overlay}
					{osd && info && <Osd key={`osd-${z.zapId}`} info={info} />}
					{pointer && (
						<div ref={cur} className="lr-cursor pointer-events-none absolute left-0 top-0 z-50" style={{ opacity: 0 }}>
							<div key={press} className="lr-pointer" />
						</div>
					)}
					{/* White while it's a dot or a line, so it glows even over a black picture. */}
					<motion.div
						className="pointer-events-none absolute inset-0 z-[60] bg-white"
						initial={false}
						animate={{ opacity: z.on ? [1, 1, 0] : [0, 0.2, 1, 1] }}
						transition={z.on ? { duration: 0.85, times: [0, 0.3, 1] } : { duration: 0.7, times: [0, 0.3, 0.45, 1] }}
					/>
				</motion.div>
				{/* The dot: drawn outside the clip so it glows. First on the way on, last on the way off. */}
				<motion.div
					className="pointer-events-none absolute left-1/2 top-1/2 z-50 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_18px_6px_rgba(220,235,255,0.95)]"
					initial={false}
					animate={z.on ? { opacity: [1, 0, 0], scale: [1, 1.4, 1] } : { opacity: [0, 0, 1, 0], scale: [1, 1, 1.2, 0.2] }}
					transition={z.on ? { duration: 0.85, times: [0, 0.3, 1] } : { duration: 0.95, times: [0, 0.55, 0.72, 1] }}
				/>

			</div>

			{glass && (
				<>
					<div className="lr-scan pointer-events-none absolute inset-0 z-40" />
					<div
						className="pointer-events-none absolute inset-0 z-40"
						style={{
							borderRadius: radius,
							boxShadow: "inset 0 0 60px rgba(0,0,0,0.55), inset 0 0 2px rgba(255,255,255,0.12)",
							background: "linear-gradient(115deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 28%, transparent 29%, transparent 100%)",
						}}
					/>
				</>
			)}
		</div>
	)
}

// On-screen display: the channel number in the corner, like a set from the nineties. Fades after a while.
function Osd({ info }: { info: ChannelInfo }) {
	return (
		<motion.div
			className="pointer-events-none absolute right-7 top-5 z-40 text-right lr-vt leading-none text-[#7CFF9B]"
			style={{ textShadow: "0 0 8px rgba(124,255,155,0.7), 2px 0 0 rgba(255,0,80,0.35), -2px 0 0 rgba(0,160,255,0.35)" }}
			initial={{ opacity: 1 }}
			animate={{ opacity: [1, 1, 0] }}
			transition={{ duration: 3.4, times: [0, 0.8, 1] }}
		>
			<div className="text-[52px]">CH {String(info.num).padStart(2, "0")}</div>
			<div className="mt-1 text-[26px] tracking-wider uppercase">{info.short}</div>
		</motion.div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The remote. Real buttons, real labels; it's the page's main control, not a picture of one.

export function Remote({
	z,
	channels,
	onGuide,
	className = "",
	compact = false,
}: {
	z: Zapper
	channels: ChannelInfo[]
	onGuide?: () => void
	className?: string
	compact?: boolean
}) {
	const [blink, setBlink] = useState(0)
	const press = (fn: () => void) => () => {
		setBlink((b) => b + 1)
		fn()
	}
	return (
		<div className={`lr-remote relative ${className}`} role="group" aria-label="Remote control">
			<div className="lr-remote-body relative flex flex-col items-center gap-4 rounded-[46px] px-5 pb-8 pt-5">
				{/* IR window with the send light. */}
				<div className="relative h-3 w-14 rounded-full bg-[#1a0d10] shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]">
					<motion.div
						key={blink}
						className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500"
						initial={{ opacity: blink ? 1 : 0, boxShadow: "0 0 10px 4px rgba(255,40,40,0.8)" }}
						animate={{ opacity: 0, boxShadow: "0 0 0px 0px rgba(255,40,40,0)" }}
						transition={{ duration: 0.35 }}
					/>
				</div>

				<div className="flex w-full items-center justify-between px-1">
					<RButton
						label={z.on ? "Turn off" : "Turn on"}
						onClick={press(() => z.setOn(!z.on))}
						className="h-9 w-9 rounded-full bg-gradient-to-b from-[#c2372f] to-[#8e1f19] text-white shadow-[0_2px_0_#4d0f0b,0_4px_10px_rgba(0,0,0,0.5)]"
					>
						<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
							<path d="M12 3v8" />
							<path d="M6.3 7.3a8 8 0 1 0 11.4 0" />
						</svg>
					</RButton>
					<RButton
						label={z.muted ? "Sound on" : "Sound off"}
						onClick={() => z.setMuted(!z.muted)}
						className="lr-key h-7 w-11 rounded-full text-[10px] font-bold tracking-wider"
					>
						{z.muted ? "MUTED" : "MUTE"}
					</RButton>
				</div>

				{/* Number pad: one button per channel, each with what it shows. */}
				<div className={`grid w-full grid-cols-3 ${compact ? "gap-2" : "gap-x-2.5 gap-y-3"}`}>
					{channels.map((c, i) => (
						<RButton
							key={c.id}
							label={`Channel ${c.num}, ${c.name}`}
							onClick={press(() => z.tune(i))}
							active={z.ch === i}
							className="lr-key flex h-12 flex-col items-center justify-center rounded-2xl"
						>
							<span className="text-[17px] font-semibold leading-none">{c.num}</span>
							<span className="mt-1 text-[7.5px] font-bold uppercase leading-none tracking-[0.12em] opacity-60">{c.short}</span>
						</RButton>
					))}
				</div>

				{/* Channel rocker around the OK ring. */}
				<div className="relative mt-1 h-[132px] w-[132px] rounded-full bg-gradient-to-b from-[#2d2b2a] to-[#1b1a19] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_3px_8px_rgba(0,0,0,0.6)]">
					<RButton
						label="Next channel"
						onClick={press(() => z.tune(z.ch + 1))}
						className="absolute left-1/2 top-1 flex h-11 w-16 -translate-x-1/2 items-start justify-center rounded-t-full pt-2 text-white/70 hover:text-white"
					>
						<Chevron up />
					</RButton>
					<RButton
						label="Previous channel"
						onClick={press(() => z.tune(z.ch - 1))}
						className="absolute bottom-1 left-1/2 flex h-11 w-16 -translate-x-1/2 items-end justify-center rounded-b-full pb-2 text-white/70 hover:text-white"
					>
						<Chevron />
					</RButton>
					<span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold tracking-widest text-white/35">CH</span>
					<span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold tracking-widest text-white/35">CH</span>
					<RButton
						label="Channel guide"
						onClick={press(() => onGuide?.())}
						className="lr-key absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full text-[10px] font-bold tracking-wider"
					>
						GUIDE
					</RButton>
				</div>

				{/* The brand key: amber, where a streaming button would sit. */}
				<a
					href="/taste"
					className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 py-2.5 text-[12px] font-extrabold uppercase tracking-wider text-black shadow-[0_2px_0_#7a4a06,0_5px_12px_rgba(0,0,0,0.45)] transition-transform active:translate-y-[2px] active:shadow-[0_0_0_#7a4a06]"
				>
					Get my picks
				</a>

				<img src={gwLogo} alt="" className="mt-2 h-5 opacity-25" />
			</div>
		</div>
	)
}

function RButton({
	label,
	onClick,
	className,
	active,
	children,
}: {
	label: string
	onClick: () => void
	className: string
	active?: boolean
	children: ReactNode
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			aria-pressed={active}
			onClick={onClick}
			className={`${className} ${active ? "lr-key-on" : ""} cursor-pointer transition-[transform,box-shadow,color] duration-75 active:translate-y-[2px]`}
		>
			{children}
		</button>
	)
}

function Chevron({ up }: { up?: boolean }) {
	return (
		<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
			<path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
		</svg>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Guide overlay: every channel and what's on it. Shared so each variant can open it from its remote.

export function Guide({
	open,
	onClose,
	z,
	channels,
}: {
	open: boolean
	onClose: () => void
	z: Zapper
	channels: ChannelInfo[]
}) {
	useEffect(() => {
		if (!open) return
		const k = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", k)
		return () => window.removeEventListener("keydown", k)
	}, [open, onClose])
	return (
		<AnimatePresence>
			{open && (
				<motion.div
					className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
				>
					<motion.div
						role="dialog"
						aria-label="Channel guide"
						className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d1016]/95 shadow-2xl"
						initial={{ y: 30, scale: 0.97 }}
						animate={{ y: 0, scale: 1 }}
						exit={{ y: 20, opacity: 0 }}
						transition={{ type: "spring", stiffness: 380, damping: 32 }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
							<span className="lr-vt text-2xl tracking-wider text-[#7CFF9B]">GUIDE</span>
							<button type="button" onClick={onClose} className="text-sm text-white/60 hover:text-white">
								Close
							</button>
						</div>
						<ul>
							{channels.map((c, i) => (
								<li key={c.id}>
									<button
										type="button"
										onClick={() => {
											z.tune(i)
											onClose()
										}}
										className={`group flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-white/5 ${z.ch === i ? "bg-white/[0.07]" : ""}`}
									>
										<span className="w-10 lr-vt text-3xl" style={{ color: c.glow }}>
											{String(c.num).padStart(2, "0")}
										</span>
										<span className="flex-1">
											<span className="block font-semibold text-white">{c.name}</span>
											<span className="block text-sm text-white/55">{c.line}</span>
										</span>
										{z.ch === i && <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">ON AIR</span>}
									</button>
								</li>
							))}
						</ul>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Shared CSS for the prototype: fonts, remote plastics, scanlines, static animation, dust.

export const LR_CSS = `
.lr-root { font-family: "Gabarito", ui-sans-serif, system-ui, sans-serif; }
.lr-vt { font-family: "VT323", ui-monospace, monospace; }
.lr-remote-body {
	width: 212px;
	background:
		radial-gradient(120% 60% at 30% 0%, rgba(255,255,255,0.10), transparent 60%),
		linear-gradient(180deg, #3a3736 0%, #252322 38%, #1a1918 100%);
	box-shadow:
		inset 0 1px 0 rgba(255,255,255,0.14),
		inset 0 -2px 0 rgba(0,0,0,0.5),
		inset 2px 0 0 rgba(255,255,255,0.04),
		0 30px 60px -12px rgba(0,0,0,0.85),
		0 12px 24px -8px rgba(0,0,0,0.6);
}
.lr-key {
	color: rgba(255,255,255,0.86);
	background: linear-gradient(180deg, #3b3938, #2a2827);
	box-shadow: 0 2px 0 #121110, 0 4px 8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1);
}
.lr-key:hover { color: #fff; background: linear-gradient(180deg, #454241, #2f2d2c); }
.lr-key:active { box-shadow: 0 0 0 #121110, 0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06); }
.lr-key-on { color: #fbbf24 !important; box-shadow: 0 2px 0 #121110, 0 0 14px rgba(251,191,36,0.28), inset 0 0 0 1px rgba(251,191,36,0.45) !important; }
.lr-scan {
	background: repeating-linear-gradient(180deg, rgba(0,0,0,0.06) 0 1px, transparent 1px 3px);
}
.lr-static { background-size: 220px 220px; animation: lr-noise 0.14s steps(3) infinite; mix-blend-mode: screen; }
@keyframes lr-noise { 0% { background-position: 0 0 } 33% { background-position: -73px 41px } 66% { background-position: 57px -89px } 100% { background-position: 0 0 } }
.lr-roll { animation: lr-roll 0.42s linear; }
@keyframes lr-roll { from { top: -20% } to { top: 110% } }
.lr-flicker { animation: lr-flicker 5.5s infinite; }
@keyframes lr-flicker { 0%,100% { opacity: 1 } 8% { opacity: 0.93 } 9% { opacity: 1 } 47% { opacity: 0.96 } 48% { opacity: 1 } 71% { opacity: 0.9 } 72.5% { opacity: 1 } }
.lr-mote { position: absolute; border-radius: 9999px; background: rgba(255,236,200,0.8); filter: blur(0.6px); animation: lr-drift linear infinite; }
@keyframes lr-drift { 0% { transform: translate(0,0); opacity: 0 } 15% { opacity: .9 } 85% { opacity: .7 } 100% { transform: translate(var(--dx), var(--dy)); opacity: 0 } }
.lr-cursor { will-change: transform; }
/* Progress without layout: scale, not width. */
.lr-progress { animation: lr-progress linear forwards; transform: scaleX(0); }
@keyframes lr-progress { to { transform: scaleX(1); } }
.lr-pointer {
	width: 34px; height: 34px; border-radius: 9999px;
	transform: translate(-50%, -50%) scale(1); transition: transform 140ms cubic-bezier(.2,.7,.1,1);
	animation: lr-press 200ms cubic-bezier(.2,.7,.1,1);
	background: radial-gradient(circle, rgba(255,255,255,0.95) 0 18%, rgba(255,255,255,0.25) 19% 46%, transparent 47%);
	box-shadow: 0 0 0 3px rgba(251,146,60,0.9), 0 0 24px 6px rgba(251,146,60,0.45);
}
.lr-cursor[data-hot="1"] .lr-pointer { transform: translate(-50%, -50%) scale(1.25); }
@keyframes lr-press { from { transform: translate(-50%, -50%) scale(0.7); } }
.lr-pointing [data-pick] { cursor: none; transition: transform 160ms cubic-bezier(.2,.7,.1,1), box-shadow 160ms, filter 160ms; }
.lr-pointing [data-pick]:hover { transform: scale(1.05); filter: brightness(1.12); box-shadow: 0 0 0 3px rgba(251,146,60,0.95), 0 18px 40px rgba(0,0,0,0.6); border-radius: 10px; }
.lr-kenburns { animation: lr-kb 18s ease-in-out infinite alternate; }
@keyframes lr-kb { from { transform: scale(1.04) translate(0,0) } to { transform: scale(1.14) translate(-2%, -1.5%) } }
@media (prefers-reduced-motion: reduce) {
	.lr-static, .lr-roll, .lr-flicker, .lr-mote, .lr-kenburns { animation: none !important; }
}
`

// Dust in the light of the screen: a handful of slow motes, fixed per mount.
export function Motes({ count = 18, className = "" }: { count?: number; className?: string }) {
	const motes = useMemo(
		() =>
			Array.from({ length: count }, (_, i) => {
				const r = (n: number) => {
					const x = Math.sin((i + 1) * 9301 + n * 49297) * 233280
					return x - Math.floor(x)
				}
				return {
					left: `${r(1) * 100}%`,
					top: `${20 + r(2) * 70}%`,
					size: 1 + r(3) * 2.4,
					dur: 14 + r(4) * 18,
					delay: -r(5) * 30,
					dx: `${(r(6) - 0.5) * 120}px`,
					dy: `${-40 - r(7) * 120}px`,
				}
			}),
		[count],
	)
	return (
		<div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
			{motes.map((m, i) => (
				<span
					key={i}
					className="lr-mote"
					style={
						{
							left: m.left,
							top: m.top,
							width: m.size,
							height: m.size,
							animationDuration: `${m.dur}s`,
							animationDelay: `${m.delay}s`,
							"--dx": m.dx,
							"--dy": m.dy,
						} as React.CSSProperties
					}
				/>
			))}
		</div>
	)
}

// Turns the set on shortly after mount, like someone pressed power as the page loaded.
export function useAutoPowerOn(z: Zapper, delay = 700) {
	useEffect(() => {
		const t = setTimeout(() => z.setOn(true), delay)
		return () => clearTimeout(t)
	}, [])
}
