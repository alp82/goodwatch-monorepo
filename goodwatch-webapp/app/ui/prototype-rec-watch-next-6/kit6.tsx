// PROTOTYPE - throwaway. Shared pieces for round 6 of Watch next (#176): colour swatches that pick or blend
// a mood, the short blend track, a folded line where each word is a coloured chip, and a fold-on-scroll
// hook. Everything else (hero, options, view line) comes from rounds 4 and 5 unchanged.
import { XMarkIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import type { Mood, WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { ORDERS } from "~/ui/prototype-rec-watch-next-4/select"
import type { Ctx } from "~/ui/prototype-rec-watch-next-5/kit5"
import { HUE, LONG, NAME, PATH } from "~/ui/prototype-rec-watch-next-5/mood"
import { type Mix, blendName, inkOn, mixHue, tapMix } from "./mix"

export const EASE = [0.2, 0.7, 0.2, 1] as const

// Per mood, for the current length, services and order: how many Wishlist titles fit, and the first of them.
export type Per = Record<Mood, { n: number; top?: WTitle }>

export type Ctx6 = Ctx & {
	mix: Mix
	setMix: (x: Mix) => void
	// A mix shown in the hero before it is picked (hovering a swatch), or null.
	pv: Mix | null
	setPv: (x: Mix | null) => void
	per: Per
}

export const plainSel = (c: Ctx6) => !c.mix.picks.length && c.sel.length === "any" && !c.sel.services && c.sel.by === "mine"

// ------------------------------------------------------------------ fold on scroll

// Folds once the page scrolls past `at`. Opening it by hand keeps it open until the page moves a good
// distance. With `up`, scrolling back up also opens it, as bottom bars on phones do.
export function useFold(at = 160, up = false) {
	const [folded, setFolded] = useState(false)
	const opened = useRef<number | null>(null)
	const last = useRef(0)
	useEffect(() => {
		const on = () => {
			const y = window.scrollY
			const dy = y - last.current
			last.current = y
			if (opened.current != null && Math.abs(y - opened.current) < 240) return
			opened.current = null
			if (y <= at) return setFolded(false)
			if (!up) return setFolded(true)
			if (dy > 4) setFolded(true)
			else if (dy < -24) setFolded(false)
		}
		on()
		window.addEventListener("scroll", on, { passive: true })
		return () => window.removeEventListener("scroll", on)
	}, [at, up])
	const open = () => {
		opened.current = window.scrollY
		setFolded(false)
	}
	return [folded, open] as const
}

// ------------------------------------------------------------------ swatches

type SwatchLook = {
	// Dot size in px.
	dot?: number
	// Show the mood's name next to the dot: never, from md up, or always.
	names?: "never" | "md" | "always"
	// Show how many titles fit that mood.
	counts?: boolean
	// Hovering with a mouse previews the mood in the hero.
	preview?: boolean
	tone?: "glass" | "solid"
}

function Swatch({ c, m, look }: { c: Ctx6; m: Mood; look: SwatchLook }) {
	const { dot = 28, names = "md", counts = false, preview = false, tone = "solid" } = look
	const on = c.mix.picks.includes(m)
	const n = c.per[m].n
	// With two picked, the others shrink to their dots so the blend track has room.
	const named = names !== "never" && (c.mix.picks.length < 2 || on)
	const nameCls = names === "md" ? "hidden md:inline" : "inline"
	const off = tone === "glass" ? "bg-black/40 ring-1 ring-white/10 backdrop-blur-md hover:bg-black/60" : "bg-white/10 hover:bg-white/20"
	return (
		<motion.button
			layout
			type="button"
			aria-pressed={on}
			aria-label={`${LONG[m]}${counts ? `, ${n} fit` : ""}`}
			onClick={() => (c.setPv(null), c.setMix(tapMix(c.mix, m)))}
			onPointerEnter={(e) => preview && e.pointerType === "mouse" && c.setPv(tapMix(c.mix, m))}
			onPointerLeave={() => preview && c.setPv(null)}
			transition={{ layout: { type: "spring", stiffness: 420, damping: 34 } }}
			whileTap={{ scale: 0.94 }}
			className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full text-sm font-semibold transition-colors duration-200 ${named ? (names === "md" ? "md:pr-3.5" : "pr-3.5") : ""} ${on ? "" : `${off} text-gray-100`}`}
			style={{ background: on ? HUE[m] : undefined, color: on ? inkOn(HUE[m]) : undefined, order: on ? c.mix.picks.indexOf(m) * 2 : 3, padding: 4 }}
		>
			<span
				className={`relative flex shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ring-2 ${on ? "ring-black/20" : "ring-white/10"}`}
				style={{ background: HUE[m], width: dot, height: dot, color: inkOn(HUE[m]) }}
			>
				{counts && !named ? n : null}
				{counts && named ? <span className="md:hidden">{n}</span> : null}
			</span>
			{named && <span className={`${nameCls} whitespace-nowrap`}>{NAME[m]}</span>}
			{counts && named && (
				<span className={`hidden whitespace-nowrap rounded-full px-1.5 text-xs font-bold tabular-nums md:inline ${on ? "bg-black/15" : n ? "bg-white/10 text-gray-300" : "text-gray-500"}`}>{n} fit</span>
			)}
		</motion.button>
	)
}

// Five swatches in a row. Pick one, or a second to blend them: the blend track opens between the two.
export function Swatches({ c, look = {}, blendW = "w-20 md:w-28", className = "" }: { c: Ctx6; look?: SwatchLook; blendW?: string; className?: string }) {
	return (
		<LayoutGroup>
			<div className={`flex min-w-0 items-center gap-1.5 md:gap-2 ${className}`} role="group" aria-label="Mood" onPointerLeave={() => look.preview && c.setPv(null)}>
				{PATH.map((m) => (
					<Swatch key={m} c={c} m={m} look={look} />
				))}
				<AnimatePresence initial={false}>
					{c.mix.picks.length === 2 && (
						<motion.div
							layout
							key="blend"
							initial={{ opacity: 0, width: 0 }}
							animate={{ opacity: 1, width: "auto" }}
							exit={{ opacity: 0, width: 0 }}
							transition={{ duration: 0.25, ease: EASE }}
							className="shrink-0 overflow-hidden"
							style={{ order: 1 }}
						>
							<Blend c={c} className={`mx-1 ${blendW}`} />
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</LayoutGroup>
	)
}

// The short track between two picked moods: drag toward either end to lean that way.
export function Blend({ c, className = "" }: { c: Ctx6; className?: string }) {
	const ref = useRef<HTMLDivElement>(null)
	const [drag, setDrag] = useState(false)
	const [a, b] = c.mix.picks
	if (!a || !b) return null
	const w = c.mix.w
	const at = (x: number) => {
		const r = ref.current!.getBoundingClientRect()
		return Math.max(0, Math.min(1, (x - r.left) / r.width))
	}
	const put = (k: number) => c.setMix({ ...c.mix, w: k })
	return (
		<div
			ref={ref}
			role="slider"
			tabIndex={0}
			aria-label="Blend"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(w * 100)}
			aria-valuetext={blendName(a, b, w)}
			onPointerDown={(e) => {
				e.currentTarget.setPointerCapture(e.pointerId)
				setDrag(true)
				put(at(e.clientX))
			}}
			onPointerMove={(e) => drag && put(at(e.clientX))}
			onPointerUp={() => setDrag(false)}
			onPointerCancel={() => setDrag(false)}
			onKeyDown={(e) => {
				const d = e.key === "ArrowRight" ? 0.1 : e.key === "ArrowLeft" ? -0.1 : 0
				if (!d) return
				e.preventDefault()
				e.stopPropagation()
				put(Math.max(0, Math.min(1, w + d)))
			}}
			className={`group relative flex h-9 cursor-pointer touch-none items-center outline-none ${className}`}
		>
			<div className="h-2 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${HUE[a]}, ${HUE[b]})` }} />
			<motion.span
				className="absolute top-1/2 block h-5 w-5 rounded-full border-[3px] border-white shadow-lg group-focus-visible:ring-4 group-focus-visible:ring-white/40"
				style={{ background: mixHue(c.mix) }}
				initial={false}
				animate={{ left: `${w * 100}%`, x: "-50%", y: "-50%", scale: drag ? 1.2 : 1 }}
				transition={drag ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
			/>
		</div>
	)
}

// ------------------------------------------------------------------ chips

export type Facet = "mood" | "length" | "services" | "order"

export function Chip({ children, bg, fg, ring, onClick, label, className = "", pressed }: { children: React.ReactNode; bg: string; fg: string; ring?: string; onClick?: () => void; label?: string; className?: string; pressed?: boolean }) {
	const cls = `inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold ${className}`
	const style = { background: bg, color: fg, boxShadow: ring ? `inset 0 0 0 1px ${ring}` : undefined }
	return onClick ? (
		<button type="button" onClick={onClick} aria-label={label} aria-expanded={pressed} className={`${cls} cursor-pointer transition-[filter] hover:brightness-110`} style={style}>
			{children}
		</button>
	) : (
		<span className={cls} style={style}>
			{children}
		</span>
	)
}

// The mood chip: filled with the mood's colour, or the blend of two.
export function MoodChip({ c, onClick, className = "", pressed }: { c: Ctx6; onClick?: () => void; className?: string; pressed?: boolean }) {
	const [a, b] = c.mix.picks
	if (!a)
		return (
			<Chip bg="rgba(255,255,255,.06)" fg="#e5e7eb" ring="rgba(255,255,255,.25)" onClick={onClick} label="Mood" className={className} pressed={pressed}>
				<span className="h-2.5 w-2.5 rounded-full" style={{ background: `conic-gradient(${PATH.map((m) => HUE[m]).join(",")},${HUE.comfort})` }} />
				Any mood
			</Chip>
		)
	const bg = b ? `linear-gradient(90deg, ${HUE[a]}, ${HUE[b]})` : HUE[a]
	return (
		<Chip bg={bg} fg={inkOn(mixHue(c.mix))} onClick={onClick} label="Mood" className={className} pressed={pressed}>
			{c.m?.name ?? LONG[a]}
		</Chip>
	)
}

const LENGTH_WORD = { any: "Any length", short: "Short", long: "Long" } as const

// One line where each part of the selection is a small coloured chip, then the count. `onTap` makes each
// chip a button (to open that part); without it the line is a summary.
export function ChipLine({ c, onTap, all = false, open, className = "" }: { c: Ctx6; onTap?: (f: Facet) => void; all?: boolean; open?: Facet | null; className?: string }) {
	const { sel } = c
	const order = ORDERS.find((o) => o.key === sel.by)!
	const tap = (f: Facet) => (onTap ? () => onTap(f) : undefined)
	const plain = plainSel(c)
	return (
		<span className={`flex min-w-0 items-center gap-1.5 ${className}`}>
			<MoodChip c={c} onClick={tap("mood")} pressed={open === "mood"} />
			{(all || sel.length !== "any") && (
				<Chip bg={sel.length === "any" ? "rgba(255,255,255,.06)" : "#e5e7eb"} fg={sel.length === "any" ? "#e5e7eb" : "#030712"} ring={sel.length === "any" ? "rgba(255,255,255,.25)" : undefined} onClick={tap("length")} label="Length" pressed={open === "length"}>
					{LENGTH_WORD[sel.length]}
				</Chip>
			)}
			{(all || sel.services) && (
				<Chip bg={sel.services ? "rgba(34,197,94,.18)" : "rgba(255,255,255,.06)"} fg={sel.services ? "#86efac" : "#e5e7eb"} ring={sel.services ? "rgba(74,222,128,.45)" : "rgba(255,255,255,.25)"} onClick={tap("services")} label="On my services" pressed={open === "services"}>
					{sel.services ? "On my services" : "Any service"}
				</Chip>
			)}
			{(all || sel.by !== "mine") && (
				<Chip bg={sel.by === "mine" ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.16)"} fg={sel.by === "mine" ? "#e5e7eb" : "#ffffff"} ring={sel.by === "mine" ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.7)"} onClick={tap("order")} label="Order" pressed={open === "order"}>
					{order.label}
				</Chip>
			)}
			{!plain && (
				<span className="shrink-0 whitespace-nowrap pl-1 text-sm tabular-nums text-gray-400">
					<motion.span key={c.n} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="font-semibold text-white">
						{c.n}
					</motion.span>{" "}
					fit
				</span>
			)}
			{plain && !all && <span className="truncate text-sm text-gray-400">your saved order, {c.q.count} titles</span>}
		</span>
	)
}

// A small panel under a chip, closed by a tap outside or Escape.
export function Pop({ open, onClose, children, className = "", style }: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const off = (e: PointerEvent) => {
			const t = e.target as HTMLElement
			if (!ref.current?.contains(t) && !t.closest("[data-chipline]")) onClose()
		}
		const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("pointerdown", off)
		window.addEventListener("keydown", esc)
		return () => (window.removeEventListener("pointerdown", off), window.removeEventListener("keydown", esc))
	}, [open])
	return (
		<AnimatePresence>
			{open && (
				<motion.div
					ref={ref}
					initial={{ opacity: 0, y: -6, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -6, scale: 0.98 }}
					transition={{ duration: 0.18, ease: EASE }}
					className={`z-50 rounded-2xl bg-gray-900/95 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl ${className}`}
					style={style}
				>
					<button type="button" onClick={onClose} aria-label="Close" className="absolute right-2 top-2 cursor-pointer rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white md:hidden">
						<XMarkIcon className="h-4 w-4" />
					</button>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	)
}
