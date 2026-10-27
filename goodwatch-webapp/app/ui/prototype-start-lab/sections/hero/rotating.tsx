// PROTOTYPE (start page lab): hero a, rotating prompts: one big search field whose empty state types out the example
// prompts in turn; tapping the example runs it, Enter runs typed text, results show below.
import { useReducedMotion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { Answer, useHeroSearch, SearchField } from "./shared"

const TYPE_MS = 45
const HOLD_MS = 2200
const ERASE_MS = 18

/** Types out each prompt, holds it, erases it, then the next. Reduced motion swaps whole prompts. */
function useTypedPrompts(prompts: string[], paused: boolean) {
	const reduce = useReducedMotion()
	const [i, setI] = useState(0)
	const [n, setN] = useState(0)
	const [phase, setPhase] = useState<"type" | "hold" | "erase">("type")
	const text = prompts[i % Math.max(1, prompts.length)] ?? ""
	useEffect(() => {
		if (paused || !prompts.length) return
		if (reduce) {
			const t = setTimeout(() => setI((x) => x + 1), 3500)
			return () => clearTimeout(t)
		}
		let t: ReturnType<typeof setTimeout>
		if (phase === "type") {
			if (n < text.length) t = setTimeout(() => setN(n + 1), TYPE_MS)
			else setPhase("hold")
		} else if (phase === "hold") t = setTimeout(() => setPhase("erase"), HOLD_MS)
		else if (n > 0) t = setTimeout(() => setN(n - 1), ERASE_MS)
		else {
			setI((x) => x + 1)
			setPhase("type")
		}
		return () => clearTimeout(t)
	}, [paused, prompts.length, reduce, phase, n, text])
	return { full: text, shown: reduce ? text : text.slice(0, n), done: reduce || phase === "hold" }
}

export function RotatingHero() {
	const { answer, search, prompt, clear, data } = useHeroSearch()
	const prompts = data.guest.prompts.map((p) => p.q)
	const [draft, setDraft] = useState("")
	const [focused, setFocused] = useState(false)
	const input = useRef<HTMLInputElement>(null)
	const typed = useTypedPrompts(prompts, focused || !!draft)

	const example = prompts.length ? (
		<span className="flex min-w-0 max-w-full items-center gap-2">
			<button
				type="button"
				onMouseDown={(e) => e.preventDefault()}
				onClick={() => {
					setDraft(typed.full)
					prompt(typed.full)
				}}
				title="Search this"
				className="pointer-events-auto min-w-0 truncate rounded text-left text-gray-400 cursor-pointer outline-none hover:text-gray-200 focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				{typed.shown || " "}
				<span aria-hidden className="ml-0.5 inline-block w-[2px] translate-y-[0.1em] animate-pulse bg-amber-400 align-baseline" style={{ height: "0.9em" }} />
			</button>
			<span
				aria-hidden
				className={`hidden shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 font-sans text-xs font-semibold text-gray-400 transition-opacity duration-200 sm:inline ${typed.done ? "opacity-100" : "opacity-0"}`}
			>
				Tap to try
			</span>
		</span>
	) : null

	return (
		<section className="mx-auto max-w-7xl px-4 pt-6 pb-4 sm:px-6 sm:pt-12">
			<h1 className="mb-1 text-sm font-semibold text-gray-400 sm:text-base">Search by mood or anything</h1>
			<SearchField
				inputRef={input}
				value={draft}
				onChange={setDraft}
				onSubmit={search}
				onClear={answer ? clear : undefined}
				placeholder="Or type your own"
				overlay={focused ? null : example}
				onFocusChange={setFocused}
			/>
			{answer ? (
				<Answer answer={answer} />
			) : (
				<p className="mt-3 text-sm text-gray-500">Tap the example or type your own. No account needed.</p>
			)}
		</section>
	)
}
