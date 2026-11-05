// PROTOTYPE - throwaway. Phone Discover: the page title "Discover" repeats the nav bar's, so its row holds the
// Easy | Advanced switch instead. The count moves to the left; the switch never sits first in the top left.
// Variants via ?variant= (sticky in sessionStorage because filter changes rewrite the URL):
//   0 Today (title + count, full-width tabs over the field)
//   A Pill      - count left, segmented pill with a sliding amber thumb at the right
//   B Folder    - count left, two folder tabs at the right growing out of the search field's top edge
//   C Underline - count left, quiet underline text tabs at the right (desktop style)
//   D Switch    - count left, one "Advanced" toggle switch at the right (Easy = off)
// Desktop is unchanged in every variant.
import { useSearchParams } from "@remix-run/react"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import type { DiscoverMode } from "./mode"
import { ModeTabs } from "./ModeTabs"

export const TITLE_VARIANTS = {
	"0": "Today",
	A: "Pill",
	B: "Folder tabs",
	C: "Underline",
	D: "Switch",
} as const
export type TitleVariant = keyof typeof TITLE_VARIANTS
const KEY = "proto-discover-title-variant"

export function useTitleVariant(): TitleVariant {
	const [params, setParams] = useSearchParams()
	const fromUrl = params.get("variant") as TitleVariant | null
	const [stored, setStored] = useState<TitleVariant | null>(null)
	useEffect(() => {
		if (fromUrl && fromUrl in TITLE_VARIANTS) {
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
	if (fromUrl && fromUrl in TITLE_VARIANTS) return fromUrl
	return stored ?? "A"
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

function Folder({
	mode,
	onChange,
}: { mode: DiscoverMode; onChange: (m: DiscoverMode) => void }) {
	return (
		<div
			role="group"
			aria-label="Discover mode"
			className="relative z-10 -mb-px flex shrink-0 items-end self-end"
		>
			{MODES.map((item) => {
				const on = mode === item.mode
				return (
					<button
						key={item.mode}
						type="button"
						aria-pressed={on}
						onClick={() => onChange(item.mode)}
						className={`relative cursor-pointer rounded-t-[16px] text-[13px] font-bold outline-none transition-colors duration-200 focus-visible:text-amber-300 ${
							on
								? "h-11 bg-gray-900 px-4 text-white"
								: "h-9 px-3.5 text-gray-500 hover:text-gray-300"
						}`}
					>
						{on && (
							<span
								aria-hidden
								className="absolute inset-0 rounded-t-[16px] border-x border-t border-white/10 bg-white/[0.045]"
							>
								<span className="absolute inset-x-4 top-0 h-0.5 rounded-b-full bg-amber-400" />
							</span>
						)}
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
		</div>
	)
}
