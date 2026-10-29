// PROTOTYPE (Discover lab, round 21): the header's one search field, top right of every tab. Desktop: always there.
// Phones: a magnifier at the row's right end that opens the field over the sub-tabs. Escape clears it (and closes it
// when empty), ↑ ↓ move through the results, Enter picks.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type MutableRefObject, useEffect, useRef } from "react"
import { TAP } from "~/ui/filter-bar/motion"
import { PRIVATE } from "../shell-parts"

/** What the results list does with the field's keys. */
export interface Nav {
	move: (delta: number) => void
	enter: () => void
}

const PLACEHOLDER = "Find: Netflix, cozy, a name"

export function FindBox({
	value,
	onChange,
	nav,
	onEmptyEscape,
	autoFocus = false,
	big = false,
}: {
	value: string
	onChange: (t: string) => void
	nav: MutableRefObject<Nav | null>
	/** Escape with nothing typed. */
	onEmptyEscape?: () => void
	autoFocus?: boolean
	big?: boolean
}) {
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (autoFocus) input.current?.focus()
	}, [autoFocus])
	// Escape is ours while the field has focus: the phone sheet listens on document in the capture phase (and the
	// desktop panel on document), so take it at the window first.
	const live = useRef({ value, onChange, onEmptyEscape })
	live.current = { value, onChange, onEmptyEscape }
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || e.target !== input.current) return
			e.preventDefault()
			e.stopPropagation()
			const l = live.current
			if (l.value) l.onChange("")
			else l.onEmptyEscape?.()
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])
	return (
		<label
			data-find-box
			className={`flex w-full items-center gap-2.5 rounded-xl bg-white/[0.06] px-3.5 ring-1 ring-white/10 focus-within:ring-amber-500/70 ${big ? "h-10" : "h-9"}`}
		>
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
			<input
				ref={input}
				type="search"
				value={value}
				autoComplete="off"
				enterKeyHint="search"
				aria-label="Find in every tab"
				placeholder={PLACEHOLDER}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault()
						nav.current?.move(e.key === "ArrowDown" ? 1 : -1)
					} else if (e.key === "Enter") {
						e.preventDefault()
						nav.current?.enter()
					}
				}}
				className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${PRIVATE}`}
			/>
			{value && (
				<button
					type="button"
					onClick={() => {
						onChange("")
						input.current?.focus()
					}}
					aria-label="Clear the search"
					className="text-gray-500 cursor-pointer hover:text-white"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</label>
	)
}

/** Phones: the magnifier in the row, and the field over the sub-tabs while it is open or holds text. */
export function phoneFind({
	value,
	onChange,
	open,
	setOpen,
	nav,
}: {
	value: string
	onChange: (t: string) => void
	open: boolean
	setOpen: (o: boolean) => void
	nav: MutableRefObject<Nav | null>
}) {
	const shown = open || value !== ""
	const close = () => {
		onChange("")
		setOpen(false)
	}
	return {
		button: (
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={() => setOpen(true)}
				aria-label="Find in every tab"
				data-find-open
				className="grid h-10 w-10 place-items-center rounded-full text-gray-300 cursor-pointer outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<MagnifyingGlassIcon className="h-5 w-5" aria-hidden />
			</motion.button>
		),
		overlay: (
			<AnimatePresence initial={false}>
				{shown && (
					<motion.div
						key="find"
						initial={{ opacity: 0, x: 24 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 24 }}
						transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
						className="absolute inset-y-0 right-0 left-0 z-10 flex items-center gap-1 bg-[#0b1120] pr-1 pl-3"
					>
						<div className="min-w-0 flex-1">
							<FindBox value={value} onChange={onChange} nav={nav} onEmptyEscape={close} autoFocus={open} />
						</div>
						<button
							type="button"
							onClick={close}
							className="h-10 shrink-0 rounded-full px-3 text-[14px] font-semibold text-gray-300 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							Cancel
						</button>
					</motion.div>
				)}
			</AnimatePresence>
		),
	}
}
