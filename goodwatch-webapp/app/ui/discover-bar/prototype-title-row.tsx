// PROTOTYPE - throwaway. Phone Discover: the page title "Discover" repeats the nav bar's, so its row holds the
// Easy | Advanced switch instead. The count moves to the left; the switch never sits first in the top left.
// Variants via ?variant= (sticky in sessionStorage because filter changes rewrite the URL):
//   0 Today (title + count, full-width tabs over the field)
//   A Pill      - count left, segmented pill with a sliding amber thumb at the right
//   B Folder    - count left, two folder tabs at the right growing out of the search field's top edge
//   C Underline - count left, quiet underline text tabs at the right (desktop style)
//   D Switch    - count left, one "Advanced" toggle switch at the right (Easy = off)
// Round 2 (compact D): D1 bare switch, D2 icon thumb, D3 labeled track, D4 chip, D5 mode word.
// Desktop is unchanged in every variant.
import { useSearchParams } from "@remix-run/react"
import { AdjustmentsHorizontalIcon, CheckIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import type { DiscoverMode } from "./mode"
import { ModeTabs } from "./ModeTabs"

export const TITLE_VARIANTS = {
	"0": "Today",
	C: "Underline",
	B: "Folder tabs (smooth)",
	D: "Switch",
	D1: "Bare switch",
	D2: "Icon thumb",
	D3: "Labeled track",
	D4: "Chip",
	D5: "Mode word",
} as const
// Round 1 (A Pill) are still rendered by key but out of the cycle.
type AnyVariant = keyof typeof TITLE_VARIANTS | "A"
export type TitleVariant = AnyVariant
const KEY = "proto-discover-title-variant"

export function useTitleVariant(): TitleVariant {
	const [params, setParams] = useSearchParams()
	const fromUrl = params.get("variant") as TitleVariant | null
	const [stored, setStored] = useState<TitleVariant | null>(null)
	useEffect(() => {
		if (fromUrl && (fromUrl in TITLE_VARIANTS || fromUrl === "A")) {
			try {
				sessionStorage.setItem(KEY, fromUrl)
			} catch {}
			setStored(fromUrl)
			return
		}
		let saved: string | null = null
		try {
			saved = sessionStorage.getItem(KEY)
		} catch {}
		if (saved && saved in TITLE_VARIANTS) {
			setStored(saved as TitleVariant)
			const next = new URLSearchParams(params)
			next.set("variant", saved)
			setParams(next, { replace: true, preventScrollReset: true })
		}
	}, [fromUrl, params, setParams])
	if (fromUrl && (fromUrl in TITLE_VARIANTS || fromUrl === "A")) return fromUrl
	return stored ?? "C"
}

export function TitleVariantSwitcher() {
	return (
		<PrototypeSwitcher
			variants={TITLE_VARIANTS}
			position="bottom-24 left-1/2 -translate-x-1/2"
		/>
	)
}

const MODES: { mode: DiscoverMode; label: string }[] = [
	{ mode: "easy", label: "Easy" },
	{ mode: "advanced", label: "Advanced" },
]
const SPRING = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const

function Pill({
	mode,
	onChange,
}: { mode: DiscoverMode; onChange: (m: DiscoverMode) => void }) {
	return (
		<div
			role="group"
			aria-label="Discover mode"
			className="relative flex h-10 shrink-0 items-center rounded-full bg-black/30 p-1 ring-1 ring-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,.4)]"
		>
			{MODES.map((item) => {
				const on = mode === item.mode
				return (
					<button
						key={item.mode}
						type="button"
						aria-pressed={on}
						onClick={() => onChange(item.mode)}
						className={`relative h-8 cursor-pointer rounded-full px-3.5 text-[13px] font-bold outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-amber-300 ${
							on ? "text-gray-950" : "text-gray-400 hover:text-white"
						}`}
					>
						{on && (
							<motion.span
								layoutId="proto-mode-thumb"
								transition={SPRING}
								className="absolute inset-0 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_2px_10px_rgba(245,158,11,.35),inset_0_1px_0_rgba(255,255,255,.45)]"
							/>
						)}
						<span className="relative">{item.label}</span>
					</button>
				)
			})}
		</div>
	)
}

// B (round 2): both tabs are always folder tabs with static outlines; only the bright front layer (field color, amber
// line, covering the field's top line) slides between them with a transform. No borders appear or disappear.
const TAB_W = 92
function Folder({
	mode,
	onChange,
}: { mode: DiscoverMode; onChange: (m: DiscoverMode) => void }) {
	const index = MODES.findIndex((m) => m.mode === mode)
	return (
		<div
			role="group"
			aria-label="Discover mode"
			className="relative z-10 -mb-px flex shrink-0 items-end self-end"
		>
			<motion.span
				aria-hidden
				initial={false}
				animate={{ x: index * TAB_W }}
				transition={SPRING}
				style={{ width: TAB_W }}
				className="absolute top-0 left-0 h-full rounded-t-[16px] bg-gray-900"
			>
				<span className="absolute inset-0 rounded-t-[16px] border-x border-t border-white/10 bg-white/[0.045]">
					<span className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-amber-400" />
				</span>
			</motion.span>
			{MODES.map((item) => {
				const on = mode === item.mode
				return (
					<button
						key={item.mode}
						type="button"
						aria-pressed={on}
						onClick={() => onChange(item.mode)}
						style={{ width: TAB_W }}
						className={`relative h-10 cursor-pointer rounded-t-[16px] border-x border-t border-white/[0.06] bg-white/[0.015] text-[13px] font-bold outline-none transition-colors duration-200 focus-visible:text-amber-300 ${
							on ? "text-white" : "text-gray-500 hover:text-gray-300"
						}`}
					>
						<span className="relative">{item.label}</span>
					</button>
				)
			})}
		</div>
	)
}

function Toggle({
	mode,
	onChange,
}: { mode: DiscoverMode; onChange: (m: DiscoverMode) => void }) {
	const on = mode === "advanced"
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			onClick={() => onChange(on ? "easy" : "advanced")}
			className="group flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-full pr-1 pl-3.5 outline-none ring-1 ring-white/10 transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<span
				className={`text-[13px] font-bold transition-colors ${on ? "text-white" : "text-gray-400"}`}
			>
				Advanced
			</span>
			<span
				className={`relative flex h-8 w-[52px] items-center rounded-full p-1 transition-colors duration-200 ${on ? "bg-amber-500" : "bg-white/10"}`}
			>
				<motion.span
					animate={{ x: on ? 20 : 0 }}
					transition={SPRING}
					className="h-6 w-6 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,.4)]"
				/>
			</span>
		</button>
	)
}

type ModeProps = { mode: DiscoverMode; onChange: (m: DiscoverMode) => void }
const flip = (mode: DiscoverMode): DiscoverMode => (mode === "advanced" ? "easy" : "advanced")
const SW = "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

// D1: no frame, small label + small switch.
function Bare({ mode, onChange }: ModeProps) {
	const on = mode === "advanced"
	return (
		<button type="button" role="switch" aria-checked={on} onClick={() => onChange(flip(mode))} className={`flex h-8 shrink-0 items-center gap-2 rounded-full px-1 ${SW}`}>
			<span className={`text-[12px] font-semibold transition-colors ${on ? "text-white" : "text-gray-500"}`}>Advanced</span>
			<span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-200 ${on ? "bg-amber-500" : "bg-white/15"}`}>
				<motion.span animate={{ x: on ? 16 : 0 }} transition={SPRING} className="h-4 w-4 rounded-full bg-white shadow" />
			</span>
		</button>
	)
}

// D2: the thumb carries a sliders icon; the label is a tiny caption.
function IconThumb({ mode, onChange }: ModeProps) {
	const on = mode === "advanced"
	return (
		<button type="button" role="switch" aria-checked={on} aria-label="Advanced" onClick={() => onChange(flip(mode))} className={`flex h-8 shrink-0 items-center gap-2 rounded-full ${SW}`}>
			<span className={`text-[10px] font-bold tracking-[0.12em] uppercase transition-colors ${on ? "text-amber-300" : "text-gray-500"}`}>Advanced</span>
			<span className={`flex h-7 w-12 items-center rounded-full p-0.5 ring-1 transition-colors duration-200 ${on ? "bg-amber-500/25 ring-amber-400/60" : "bg-black/30 ring-white/10"}`}>
				<motion.span animate={{ x: on ? 20 : 0 }} transition={SPRING} className={`grid h-6 w-6 place-items-center rounded-full shadow transition-colors duration-200 ${on ? "bg-amber-400 text-gray-950" : "bg-gray-600 text-gray-300"}`}>
					<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
				</motion.span>
			</span>
		</button>
	)
}

// D3: one track that names the current mode, thumb on the other side.
function LabeledTrack({ mode, onChange }: ModeProps) {
	const on = mode === "advanced"
	return (
		<button type="button" role="switch" aria-checked={on} aria-label="Advanced" onClick={() => onChange(flip(mode))} className={`relative flex h-7 w-[104px] shrink-0 items-center rounded-full p-0.5 ring-1 transition-colors duration-200 ${on ? "bg-amber-500 ring-amber-400" : "bg-white/[0.06] ring-white/10"} ${SW}`}>
			<span className={`absolute inset-y-0 flex items-center text-[12px] font-bold transition-all duration-200 ${on ? "left-3 text-gray-950" : "left-8 text-gray-300"}`}>{on ? "Advanced" : "Easy"}</span>
			<motion.span animate={{ x: on ? 76 : 0 }} transition={SPRING} className={`h-6 w-6 rounded-full shadow ${on ? "bg-white" : "bg-gray-400"}`} />
		</button>
	)
}

// D4: a chip that fills when on, no switch.
function Chip({ mode, onChange }: ModeProps) {
	const on = mode === "advanced"
	return (
		<button type="button" role="switch" aria-checked={on} onClick={() => onChange(flip(mode))} className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold ring-1 transition-colors duration-200 ${on ? "bg-amber-400 text-gray-950 ring-amber-300" : "text-gray-300 ring-white/15 hover:bg-white/[0.05]"} ${SW}`}>
			<AnimatePresence initial={false} mode="popLayout">
				<motion.span key={on ? "on" : "off"} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.15 }}>
					{on ? <CheckIcon className="h-3.5 w-3.5" /> : <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />}
				</motion.span>
			</AnimatePresence>
			Advanced
		</button>
	)
}

// D5: a small "Mode" caption over the current mode's name, tiny switch beside it.
function ModeWord({ mode, onChange }: ModeProps) {
	const on = mode === "advanced"
	return (
		<button type="button" role="switch" aria-checked={on} aria-label="Advanced" onClick={() => onChange(flip(mode))} className={`flex shrink-0 items-center gap-2.5 rounded-lg px-1 py-0.5 ${SW}`}>
			<span className="flex flex-col items-end leading-none">
				<span className="text-[9px] font-bold tracking-[0.14em] text-gray-500 uppercase">Mode</span>
				<span className="relative mt-1 h-4 w-[62px] overflow-hidden text-right text-[13px] font-bold text-white">
					<AnimatePresence initial={false}>
						<motion.span key={mode} initial={{ y: on ? 14 : -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: on ? -14 : 14, opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0">
							{on ? "Advanced" : "Easy"}
						</motion.span>
					</AnimatePresence>
				</span>
			</span>
			<span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-200 ${on ? "bg-amber-500" : "bg-white/15"}`}>
				<motion.span animate={{ x: on ? 16 : 0 }} transition={SPRING} className="h-4 w-4 rounded-full bg-white shadow" />
			</span>
		</button>
	)
}

/** The phone row in place of the title + count; null for today's layout. */
export function PhoneTitleRow({
	variant,
	mode,
	onChange,
	count,
}: {
	variant: TitleVariant
	mode: DiscoverMode
	onChange: (m: DiscoverMode) => void
	count: React.ReactNode
}) {
	if (variant === "0") return null
	return (
		<div
			className={`flex justify-between gap-3 lg:hidden ${variant === "B" ? "items-end" : "items-center"}`}
		>
			<div className={variant === "B" ? "pb-1.5" : ""}>{count}</div>
			{variant === "A" && <Pill mode={mode} onChange={onChange} />}
			{variant === "B" && <Folder mode={mode} onChange={onChange} />}
			{variant === "C" && (
				<div className="pt-1.5">
					<ModeTabs mode={mode} onChange={onChange} />
				</div>
			)}
			{variant === "D" && <Toggle mode={mode} onChange={onChange} />}
			{variant === "D1" && <Bare mode={mode} onChange={onChange} />}
			{variant === "D2" && <IconThumb mode={mode} onChange={onChange} />}
			{variant === "D3" && <LabeledTrack mode={mode} onChange={onChange} />}
			{variant === "D4" && <Chip mode={mode} onChange={onChange} />}
			{variant === "D5" && <ModeWord mode={mode} onChange={onChange} />}
		</div>
	)
}
