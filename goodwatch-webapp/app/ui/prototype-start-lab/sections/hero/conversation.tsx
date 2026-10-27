// PROTOTYPE (start page lab): hero c, conversation: a short exchange plays once (a prompt bubble, then the picks
// arrive as the reply with how we read it), then "Your turn" with the field. A guest's own search replaces the demo.
import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"
import type { FixtureAnswer } from "../../lab/fixture-search"
import { ReadingLine, ResultRow, SearchField, SeeAll, useHeroSearch } from "./shared"

const TYPE_MS = 38

/** 0 nothing, 1 the prompt typing, 2 the reply thinking, 3 the reply with picks, 4 your turn. */
function useScript(text: string, run: boolean) {
	const reduce = useReducedMotion()
	const [step, setStep] = useState(0)
	const [n, setN] = useState(0)
	useEffect(() => {
		if (!run || !text) return
		if (reduce) {
			setN(text.length)
			setStep(4)
			return
		}
		let t: ReturnType<typeof setTimeout>
		if (step === 0) t = setTimeout(() => setStep(1), 300)
		else if (step === 1) {
			if (n < text.length) t = setTimeout(() => setN(n + 1), TYPE_MS)
			else t = setTimeout(() => setStep(2), 250)
		} else if (step === 2) t = setTimeout(() => setStep(3), 650)
		else if (step === 3) t = setTimeout(() => setStep(4), 900)
		return () => clearTimeout(t)
	}, [run, text, reduce, step, n])
	return { step, typed: text.slice(0, n) }
}

const rise = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28, ease: "easeOut" } } as const

function Ask({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex justify-end">
			<div className="brand-header max-w-[85%] rounded-2xl rounded-br-md bg-amber-400 px-4 py-2.5 text-lg leading-snug text-gray-950 sm:text-2xl">{children}</div>
		</div>
	)
}

function Reply({ answer }: { answer: FixtureAnswer }) {
	return (
		<motion.div {...rise} className="rounded-2xl rounded-bl-md bg-white/[0.05] p-3 ring-1 ring-inset ring-white/10 sm:p-4">
			<div className="mb-2.5 flex min-w-0 items-center gap-3">
				<div className="min-w-0 flex-1">
					<p className="text-sm font-semibold text-gray-200">{Math.min(12, answer.titles.length)} picks</p>
					<ReadingLine answer={answer} className="mt-1" />
				</div>
				<SeeAll q={answer.q} className="-mr-2" />
			</div>
			<ResultRow cards={answer.titles} className="!-mx-3 !px-3 sm:!-mx-4 sm:!px-4" />
		</motion.div>
	)
}

function Thinking() {
	return (
		<motion.div {...rise} className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-white/[0.05] px-4 py-3 ring-1 ring-inset ring-white/10" aria-label="Searching">
			{[0, 1, 2].map((i) => (
				<span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" style={{ animationDelay: `${i * 150}ms` }} />
			))}
		</motion.div>
	)
}

export function ConversationHero() {
	const { answer, search, prompt, data } = useHeroSearch()
	const demo = data.guest.prompts[0]?.q ?? ""
	const [own, setOwn] = useState<string | null>(null)
	const [draft, setDraft] = useState("")
	const { step, typed } = useScript(demo, own === null)

	// The demo's reply lands when its picks arrive.
	useEffect(() => {
		if (own === null && step === 3) prompt(demo)
	}, [own, step, demo, prompt])

	const asked = own ?? (step >= 1 ? typed : "")
	const replying = own === null ? step === 2 : false
	const shown = own !== null || step >= 3 ? answer : null

	return (
		<section className="mx-auto max-w-3xl px-4 pt-5 pb-4 sm:px-6 sm:pt-10">
			<h1 className="mb-4 text-sm font-semibold text-gray-400 sm:text-base">Search by mood or anything</h1>
			{/* Room for the exchange is kept from the start, so nothing below jumps while it plays. */}
			<div className="flex min-h-[290px] flex-col gap-3 sm:min-h-[330px]">
				{asked ? (
					<Ask>
						{asked}
						{own === null && step === 1 ? <span aria-hidden className="ml-0.5 inline-block h-[0.9em] w-[2px] animate-pulse bg-gray-950 align-baseline" /> : null}
					</Ask>
				) : null}
				{replying ? <Thinking /> : null}
				{shown ? <Reply key={shown.q} answer={shown} /> : null}
			</div>
			<motion.div
				initial={false}
				animate={{ opacity: step >= 4 || own !== null ? 1 : 0.35 }}
				transition={{ duration: 0.3 }}
				className="mt-4"
			>
				<p className="mb-0.5 text-sm font-semibold text-amber-400">Your turn</p>
				<SearchField
					size="small"
					value={draft}
					onChange={setDraft}
					onSubmit={(v) => {
						if (!v.trim()) return
						setOwn(v.trim())
						search(v)
						setDraft("")
					}}
					onClear={own !== null ? () => {
						setOwn(null)
						prompt(demo)
					} : undefined}
					placeholder="Ask for anything, like a mood or a plot"
				/>
			</motion.div>
		</section>
	)
}
