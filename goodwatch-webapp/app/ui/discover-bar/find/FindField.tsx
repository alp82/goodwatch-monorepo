// Find: the one field at the right of the tab header row that finds filters, values, titles and people in all four
// tabs (results come with FindResults). Desktop: always there. Phones: a magnifier at the row's end that opens the
// field over the sub-tabs, with Cancel.
//
// Escape belongs to the field while it has focus: it clears the text, and on an empty field it calls `onEmptyEscape`
// (the panel closes, or on phones the field). The phone sheet listens on the document in the capture phase, so the
// field takes the key at the window first.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, type RefObject, useEffect, useRef } from "react"
import { TAP } from "~/ui/filter-bar/motion"
import { PRIVATE } from "../DiscoverBar"

export const FIND_PLACEHOLDER = "Find: Netflix, cozy, a name"
const FIND_LABEL = "Find in every tab"

/** What the results do with the field's keys: arrows move the highlight, Enter picks. */
export interface FindKeys {
	move: (delta: 1 | -1) => void
	enter: () => void
}

export function FindField({
	value,
	onChange,
	onEmptyEscape,
	keys,
	autoFocus = false,
	inputRef,
}: {
	value: string
	onChange: (text: string) => void
	/** Escape with nothing typed. */
	onEmptyEscape?: () => void
	/** The results' keyboard handling, once there are results. */
	keys?: RefObject<FindKeys | null>
	autoFocus?: boolean
	inputRef?: RefObject<HTMLInputElement>
}) {
	const own = useRef<HTMLInputElement>(null)
	const input = inputRef ?? own
	useEffect(() => {
		if (autoFocus) input.current?.focus({ preventScroll: true })
	}, [autoFocus, input])
	const live = useRef({ value, onChange, onEmptyEscape })
	live.current = { value, onChange, onEmptyEscape }
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.target !== input.current) return
			event.preventDefault()
			event.stopPropagation()
			const { value, onChange, onEmptyEscape } = live.current
			if (value) onChange("")
			else onEmptyEscape?.()
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [input])
	return (
		<label className="flex h-9 w-full items-center gap-2.5 rounded-xl bg-white/[0.06] px-3.5 ring-1 ring-white/10 focus-within:ring-amber-500/70">
			<MagnifyingGlassIcon
				className="h-4 w-4 shrink-0 text-gray-500"
				aria-hidden
			/>
			<input
				ref={input}
				type="search"
				value={value}
				maxLength={100}
				autoComplete="off"
				enterKeyHint="search"
				aria-label={FIND_LABEL}
				placeholder={FIND_PLACEHOLDER}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault()
						keys?.current?.move(event.key === "ArrowDown" ? 1 : -1)
					} else if (event.key === "Enter") {
						event.preventDefault()
						keys?.current?.enter()
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
					aria-label="Clear Find"
					className="text-gray-500 cursor-pointer outline-none hover:text-white focus-visible:text-white"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</label>
	)
}

/** Phones: the magnifier that opens Find. */
export function FindOpenButton({ onClick }: { onClick: () => void }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-label={FIND_LABEL}
			className="grid h-10 w-10 place-items-center rounded-full text-gray-300 cursor-pointer outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<MagnifyingGlassIcon className="h-5 w-5" aria-hidden />
		</motion.button>
	)
}

/** Phones: Find over the sub-tabs while it is open or holds text (opacity and a 24 px slide), with Cancel. */
export function FindOverlay({
	shown,
	children,
	onCancel,
}: {
	shown: boolean
	/** The field. */
	children: ReactNode
	onCancel: () => void
}) {
	return (
		<AnimatePresence initial={false}>
			{shown && (
				<motion.div
					key="find"
					initial={{ opacity: 0, x: 24 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: 24 }}
					transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
					className="absolute inset-0 z-10 flex items-center gap-1 bg-gray-950 pr-1 pl-3"
				>
					<div className="min-w-0 flex-1">{children}</div>
					<button
						type="button"
						onClick={onCancel}
						className="h-10 shrink-0 rounded-full px-3 text-[14px] font-semibold text-gray-300 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Cancel
					</button>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
