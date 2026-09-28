// The sort select in the docked strip: a button naming the sort, opening a menu of the six sorts as radio items with
// one line each. Arrow keys move, Enter or Space picks, Escape closes and returns focus to the button. Best match
// needs taste: without it the item says why, and guests see the sign-up prompt.
import {
	ArrowsUpDownIcon,
	CheckIcon,
	ChevronDownIcon,
} from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import type React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { WatchNextSort } from "~/domain/watch-next"
import type { WatchNext } from "~/server/watch-next.server"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { SORT_LABEL, SORT_OPTIONS } from "./labels"
import { EASE } from "./style"

export const RATE_MORE =
	"Rate a few more titles you love and Best match learns your taste."

export function SortMenu({
	sort,
	bestMatch,
	onPick,
}: {
	sort: WatchNextSort
	bestMatch: WatchNext["bestMatch"]
	onPick: (sort: WatchNextSort) => void
}) {
	const [open, setOpen] = useState(false)
	const button = useRef<HTMLButtonElement>(null)
	const menu = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState<{ top: number; right: number } | null>(null)

	useLayoutEffect(() => {
		if (!open) return
		const place = () => {
			const r = button.current?.getBoundingClientRect()
			if (!r) return
			if (r.bottom < 60) return setOpen(false)
			setBox({
				top: r.bottom + 8,
				right: Math.max(8, window.innerWidth - r.right),
			})
		}
		place()
		window.addEventListener("scroll", place, { passive: true })
		window.addEventListener("resize", place)
		return () => {
			window.removeEventListener("scroll", place)
			window.removeEventListener("resize", place)
		}
	}, [open])

	useEffect(() => {
		if (!open) return
		const outside = (event: PointerEvent) => {
			const target = event.target as Node
			if (!menu.current?.contains(target) && !button.current?.contains(target))
				setOpen(false)
		}
		window.addEventListener("pointerdown", outside)
		return () => window.removeEventListener("pointerdown", outside)
	}, [open])

	// Focus goes to the checked item when the menu opens.
	useEffect(() => {
		if (!open || !box) return
		const id = requestAnimationFrame(() =>
			menu.current
				?.querySelector<HTMLElement>(
					'[role="menuitemradio"][aria-checked="true"]',
				)
				?.focus(),
		)
		return () => cancelAnimationFrame(id)
	}, [open, !box])

	const close = () => {
		setOpen(false)
		button.current?.focus()
	}

	const onKeyDown = (event: React.KeyboardEvent) => {
		const items = [
			...(menu.current?.querySelectorAll<HTMLElement>(
				'[role="menuitemradio"]',
			) ?? []),
		]
		const at = items.indexOf(document.activeElement as HTMLElement)
		const move = (to: number) => {
			event.preventDefault()
			items[(to + items.length) % items.length]?.focus()
		}
		if (event.key === "ArrowDown") move(at + 1)
		else if (event.key === "ArrowUp") move(at - 1)
		else if (event.key === "Home") move(0)
		else if (event.key === "End") move(items.length - 1)
		else if (event.key === "Escape" || event.key === "Tab") {
			event.preventDefault()
			close()
		}
	}

	const pick = (key: WatchNextSort) => {
		if (key === "match" && !bestMatch.available) return
		onPick(key)
		close()
	}

	return (
		<>
			<button
				ref={button}
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={`Sort: ${SORT_LABEL[sort]}`}
				data-sort-button
				onClick={() => setOpen(!open)}
				onKeyDown={(event) => {
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault()
						setOpen(true)
					}
				}}
				className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-3 text-sm font-semibold text-gray-100 ring-1 ring-white/15 transition-colors hover:bg-white/20"
			>
				<ArrowsUpDownIcon className="h-4 w-4 text-amber-300" aria-hidden />
				{SORT_LABEL[sort]}
				<ChevronDownIcon
					className={`h-4 w-4 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
					aria-hidden
				/>
			</button>
			{typeof document !== "undefined" &&
				createPortal(
					<AnimatePresence>
						{open && box && (
							<motion.div
								ref={menu}
								role="menu"
								aria-label="Sort"
								onKeyDown={onKeyDown}
								initial={{ opacity: 0, y: -6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.18, ease: EASE }}
								className="fixed z-[70] w-[min(22rem,calc(100vw-1rem))] rounded-2xl bg-gray-900/95 p-1.5 shadow-[0_24px_70px_-12px_rgba(0,0,0,.95)] ring-1 ring-white/12 backdrop-blur-xl"
								style={{ top: box.top, right: box.right }}
							>
								{SORT_OPTIONS.map((option) => {
									const checked = option.key === sort
									const unavailable =
										option.key === "match" && !bestMatch.available
									return (
										<button
											key={option.key}
											type="button"
											role="menuitemradio"
											aria-checked={checked}
											aria-disabled={unavailable || undefined}
											tabIndex={-1}
											data-sort={option.key}
											onClick={() => pick(option.key)}
											className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left outline-none focus-visible:bg-white/12 focus-visible:ring-1 focus-visible:ring-white/40 ${unavailable ? "cursor-default opacity-60" : "cursor-pointer hover:bg-white/8"} ${checked ? "bg-white/10" : ""}`}
										>
											<span
												className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${checked ? "bg-white text-black" : "ring-1 ring-white/30"}`}
												aria-hidden
											>
												{checked && <CheckIcon className="h-3 w-3" />}
											</span>
											<span className="min-w-0">
												<span className="block text-sm font-semibold text-white">
													{option.label}
												</span>
												<span className="block text-xs text-gray-400">
													{unavailable && bestMatch.prompt === "rateMore"
														? RATE_MORE
														: option.line}
												</span>
											</span>
										</button>
									)
								})}
								{(bestMatch.prompt === "signUpToLearn" ||
									bestMatch.prompt === "signUpToKeep") && (
									<div className="px-2 pb-1 pt-2">
										<SignUpPrompt
											feature="bestMatch"
											stage={
												bestMatch.prompt === "signUpToKeep" ? "keep" : "learn"
											}
											size="chip"
										/>
									</div>
								)}
							</motion.div>
						)}
					</AnimatePresence>,
					document.body,
				)}
		</>
	)
}
