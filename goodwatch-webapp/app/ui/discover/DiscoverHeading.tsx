// Discover's heading, shared by browsing and searching. Browsing, it names the list ("Discover"); tapping it turns it
// into the search field: the heading and the field share one plate that morphs in 240 ms while their words cross-fade,
// so text never stretches. Typing searches after 800 ms or on Enter, and the query becomes the heading, with a clear
// button that returns to browsing. The explanation (taste chips or "Read as") sits at the top right.
//
// Search text is private: the heading and the field are masked from session replay (as the search page was).
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import {
	AnimatePresence,
	LayoutGroup,
	type Transition,
	motion,
	useReducedMotion,
} from "framer-motion"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { TAP } from "~/ui/filter-bar/motion"
import { EASE_SPRING, Swap } from "./motion"

/** Typing searches once it pauses this long. */
const COMMIT_MS = 800
/** Enter closes the field when the new query lands, or after this long at most. */
const CLOSE_MS = 150

// The plate's morph: a tween that overshoots a hair and settles on time.
const PLATE: Transition = { duration: 0.24, ease: EASE_SPRING }
const CONTENT = {
	initial: { opacity: 0 },
	animate: { opacity: 1, transition: { duration: 0.14, delay: 0.06 } },
	exit: { opacity: 0, transition: { duration: 0.06 } },
}
const PRIVATE = "search-private ph-no-capture sentry-mask"

export function DiscoverHeading({
	q,
	onSearch,
	onClear,
	explanation,
}: {
	/** The query while searching, else null. */
	q: string | null
	/** Search for the text (already trimmed); empty text returns to browsing. */
	onSearch: (text: string) => void
	onClear: () => void
	/** The explanation at the top right. */
	explanation: ReactNode
}) {
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(q ?? "")
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const closing = useRef<ReturnType<typeof setTimeout>>()
	const latest = useRef({ onSearch, q })
	latest.current = { onSearch, q }
	const inputId = useId()
	// With reduced motion, the plate doesn't morph and nothing moves: the heading and the field cross-fade.
	const reduce = useReducedMotion() ?? false
	const plate = reduce ? undefined : "discover-plate"

	// Follow the URL when the query changes elsewhere (the palette, back and forward, a clear).
	const shown = q ?? ""
	const last = useRef(shown)
	useEffect(() => {
		if (last.current === shown) return
		last.current = shown
		setDraft(shown)
	}, [shown])
	useEffect(
		() => () => {
			clearTimeout(timer.current)
			clearTimeout(closing.current)
		},
		[],
	)

	const run = (text: string) => {
		const trimmed = text.trim()
		if (trimmed === (latest.current.q ?? "")) return false
		last.current = trimmed
		latest.current.onSearch(trimmed)
		return true
	}
	const type = (text: string) => {
		setDraft(text)
		clearTimeout(timer.current)
		timer.current = setTimeout(() => run(text), COMMIT_MS)
	}
	// Enter and Done commit at once. Closing waits for the new query, so the plate and the grid start on the same frame.
	const done = () => {
		clearTimeout(timer.current)
		clearTimeout(closing.current)
		if (!run(draft)) return setEditing(false)
		closing.current = setTimeout(() => setEditing(false), CLOSE_MS)
	}
	useEffect(() => {
		if (!closing.current) return
		clearTimeout(closing.current)
		closing.current = undefined
		setEditing(false)
	}, [q])
	const cancel = () => {
		clearTimeout(timer.current)
		setDraft(latest.current.q ?? "")
		setEditing(false)
	}

	return (
		<LayoutGroup id="discover-heading">
			<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 lg:min-h-16">
				<AnimatePresence mode="popLayout" initial={false}>
					{editing ? (
						<motion.div
							key="field"
							exit={{ opacity: 0, transition: { duration: 0.18 } }}
							className={`relative flex h-14 w-full items-center px-4 lg:h-16 lg:max-w-2xl ${PRIVATE}`}
						>
							<motion.span
								layoutId={plate}
								transition={PLATE}
								className="absolute inset-0 rounded-2xl bg-white/[0.07] shadow-[0_20px_60px_-24px_rgba(0,0,0,.9)] ring-1 ring-white/25"
							/>
							<motion.div
								{...CONTENT}
								className="relative flex h-full min-w-0 flex-1 items-center gap-2.5"
							>
								<label htmlFor={inputId} className="sr-only">
									Search Discover
								</label>
								<MagnifyingGlassIcon
									className="h-5 w-5 shrink-0 text-gray-400"
									aria-hidden
								/>
								<input
									id={inputId}
									type="search"
									value={draft}
									// The field opens on the person's tap, so focusing it is what they asked for.
									// biome-ignore lint/a11y/noAutofocus: opened by the person
									autoFocus
									autoComplete="off"
									enterKeyHint="search"
									maxLength={SEARCH_MAX_CHARS}
									data-ph-no-capture
									placeholder="What’s the mood?"
									onChange={(e) => type(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault()
											done()
										}
										if (e.key === "Escape") {
											e.preventDefault()
											cancel()
										}
									}}
									className="brand-header h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-2xl text-white outline-none placeholder:text-gray-500 focus:ring-0 lg:text-3xl [&::-webkit-search-cancel-button]:hidden"
								/>
								{draft && (
									<button
										type="button"
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => type("")}
										aria-label="Clear the text"
										className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 cursor-pointer hover:bg-white/10 hover:text-white"
									>
										<XMarkIcon className="h-4 w-4" />
									</button>
								)}
								<button
									type="button"
									onClick={done}
									className="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold text-gray-400 cursor-pointer hover:bg-white/10 hover:text-white"
								>
									Done
								</button>
							</motion.div>
						</motion.div>
					) : (
						<motion.div
							key="heading"
							exit={{ opacity: 0, transition: { duration: 0.18 } }}
							className="relative flex min-w-0 max-w-full items-center gap-3"
						>
							<motion.span
								layoutId={plate}
								transition={PLATE}
								className="absolute -inset-x-3 -inset-y-2 rounded-2xl bg-white/0 ring-1 ring-white/0"
							/>
							<motion.div
								{...CONTENT}
								className="relative flex min-w-0 items-center gap-3"
							>
								<button
									type="button"
									onClick={() => setEditing(true)}
									aria-label={q ? `Edit the search ${q}` : "Search Discover"}
									className="group flex min-w-0 items-center gap-3 rounded-xl text-left cursor-text outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<h1
										className={`brand-header min-w-0 overflow-hidden text-white ${q ? `text-4xl lg:text-5xl ${PRIVATE}` : "text-3xl lg:text-4xl"}`}
									>
										<Swap
											k={q ?? "browse"}
											className="-my-1 max-w-full py-1 align-middle"
											origin="0% 60%"
										>
											<span className="block truncate">{q ?? "Discover"}</span>
										</Swap>
									</h1>
									<motion.span
										layout={reduce ? false : "position"}
										transition={PLATE}
										className={`grid shrink-0 place-items-center rounded-full ring-1 transition-colors ${q ? "h-9 w-9 text-gray-500 ring-white/10 group-hover:text-white" : "h-11 w-11 bg-white/[0.06] text-gray-200 ring-white/15 group-hover:bg-white/10"}`}
									>
										<MagnifyingGlassIcon className="h-5 w-5" />
									</motion.span>
								</button>
								<AnimatePresence initial={false} mode="popLayout">
									{q && (
										<motion.button
											key="clear"
											type="button"
											layout={reduce ? false : "position"}
											initial={
												reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }
											}
											animate={{
												opacity: 1,
												scale: 1,
												transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] },
											}}
											exit={{
												opacity: 0,
												...(reduce ? {} : { scale: 0.6 }),
												transition: { duration: 0.1 },
											}}
											whileTap={TAP}
											onClick={() => {
												clearTimeout(timer.current)
												last.current = ""
												setDraft("")
												onClear()
											}}
											aria-label="Clear the search, back to Discover"
											className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-gray-300 ring-1 ring-white/10 cursor-pointer hover:bg-white/10 hover:text-white"
										>
											<XMarkIcon className="h-5 w-5" />
										</motion.button>
									)}
								</AnimatePresence>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>
				<motion.div
					layout={reduce ? false : "position"}
					transition={PLATE}
					className="w-full lg:w-auto lg:max-w-[34rem]"
				>
					{explanation}
				</motion.div>
			</div>
		</LayoutGroup>
	)
}
