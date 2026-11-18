// The Trivia chapter's quiz: questions with three answers each (quiz-questions.ts), as one short run at the top of the
// chapter. A run rather than cards mixed into the trivia masonry: the masonry fills column by column, so mixed-in
// questions would have no reading order, and a run gives the score one place to count up and the verdict a natural
// end. Tap an answer to lock it in: the right one turns amber, a wrong pick goes muted, every answer shows its real
// number, and a line explains with a link. Pixel effects on right, wrong and perfect (loaded on first use); none with
// reduced motion. Answer order shuffles after mount, so the server render and the first paint agree.
import { CheckIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { Kicker, MoreLink } from "~/ui/info-page"
import { DISPLAY } from "~/ui/my-pages/style"
import { PosterImg } from "~/ui/profile/parts"
import { flag } from "~/ui/profile/taste/model"
import { seededRandomMixed } from "~/utils/random"
import { loadEffects } from "./effects/load"
import type { HostStage } from "./effects/stage"
import { PANEL, reducedMotion } from "./parts"
import { type QuizAnswer, type QuizQuestion, verdict } from "./quiz-questions"
import { PrimaryButton } from "~/ui/button/PrimaryButton"

/** CSS px per effect pixel: smaller than the hero's 3, so a burst stays near the answer it celebrates. */
const PX = 2
const GOLD = [
	"#1e1206",
	"#4a2c08",
	"#86520c",
	"#c48412",
	"#f0b424",
	"#ffe066",
	"#fff6c4",
	"#ffffff",
]
const GOLD5 = ["#7a4a12", "#c48412", "#f0b424", "#fff6c4", "#ffffff"]
const GOLD7 = GOLD.slice(1)
const WORDS = [
	"Zero",
	"One",
	"Two",
	"Three",
	"Four",
	"Five",
	"Six",
	"Seven",
	"Eight",
	"Nine",
	"Ten",
	"Eleven",
	"Twelve",
]
const FOCUS =
	"outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"

type Picks = Record<string, string>

/** An answer's picture (its poster or thumb), or the answer itself without one. */
const pictureOf = (answer: Element) => answer.querySelector("img")?.parentElement ?? answer
type State = "open" | "right" | "wrong" | "other"

/** Each question's answer order, shuffled with a seed from the moment of the shuffle. Browser only. */
function shuffled(quiz: QuizQuestion[]): Record<string, number[]> {
	const seed = `${Date.now()}`
	return Object.fromEntries(
		quiz.map((q) => {
			const o = [0, 1, 2]
			for (let i = o.length - 1; i > 0; i--) {
				const j = Math.floor(seededRandomMixed(`${seed}|${q.id}|${i}`) * (i + 1))
				;[o[i], o[j]] = [o[j], o[i]]
			}
			return [q.id, o]
		}),
	)
}

/** One stacked cell: every child takes the same grid cell, only `at` shows, the rest hold its size. */
function Stack({
	at,
	items,
	className = "",
}: {
	at: number
	items: ReactNode[]
	className?: string
}) {
	return (
		<div className={`grid ${className}`}>
			{items.map((x, k) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of layers
					key={k}
					aria-hidden={k !== at || undefined}
					className={`col-start-1 row-start-1 ${k === at ? "" : "invisible"}`}
				>
					{x}
				</div>
			))}
		</div>
	)
}

/** A small square per question: amber for right, gray for wrong, an outline for not answered yet. */
function Dots({ quiz, picks }: { quiz: QuizQuestion[]; picks: Picks }) {
	return (
		<span aria-hidden className="flex gap-1">
			{quiz.map((q) => {
				const p = picks[q.id]
				return (
					<span
						key={q.id}
						className={`size-2 rounded-[2px] transition-colors duration-300 motion-reduce:transition-none ${
							!p
								? "ring-1 ring-white/20 ring-inset"
								: p === q.right
									? "bg-amber-400"
									: "bg-gray-600"
						}`}
					/>
				)
			})}
		</span>
	)
}

function Score({ quiz, picks }: { quiz: QuizQuestion[]; picks: Picks }) {
	const answered = Object.keys(picks).length
	const right = quiz.filter((q) => picks[q.id] === q.right).length
	return (
		<div className="flex min-h-8 items-center gap-2.5 rounded-full bg-white/[0.04] px-3 text-xs font-bold ring-1 ring-white/10">
			<Dots quiz={quiz} picks={picks} />
			<Stack
				at={answered ? 1 : 0}
				items={[
					<span key="0" className="text-gray-400">
						{quiz.length} questions
					</span>,
					<span key="1" className="text-white tabular-nums">
						<b className="text-amber-300">{right}</b> of {answered} right
					</span>,
					// The widest it gets, so the pill never changes width.
					<span key="2" className="tabular-nums">
						{quiz.length} of {quiz.length} right
					</span>,
				]}
			/>
		</div>
	)
}

function StateMark({ state, className = "" }: { state: State; className?: string }) {
	if (state === "right")
		return <CheckIcon aria-hidden className={`size-5 text-amber-300 ${className}`} />
	if (state === "wrong")
		return <XMarkIcon aria-hidden className={`size-5 text-gray-500 ${className}`} />
	return <span aria-hidden className={`size-5 ${className}`} />
}

/** What the marks say, for screen readers. */
const srState = (state: State) =>
	state === "right" ? (
		<span className="sr-only">, the right answer</span>
	) : state === "wrong" ? (
		<span className="sr-only">, your pick</span>
	) : null

type AnswerProps = {
	q: QuizQuestion
	a: QuizAnswer
	state: State
	onPick: (el: HTMLElement) => void
}

function PosterAnswer({ q, a, state, onPick }: AnswerProps) {
	const revealed = state !== "open"
	return (
		<button
			type="button"
			data-quiz-answer={`${q.id}:${a.key}`}
			aria-disabled={revealed || undefined}
			onClick={(e) => onPick(e.currentTarget)}
			className={`group flex min-w-0 flex-col gap-1.5 rounded-lg text-left ${FOCUS} ${revealed ? "cursor-default" : ""}`}
		>
			<span
				className={`relative block overflow-hidden rounded-md transition-[box-shadow,opacity] duration-300 motion-reduce:transition-none ${
					state === "right"
						? "ring-2 ring-amber-400"
						: state === "open"
							? "ring-1 ring-white/10 group-hover:ring-white/40"
							: "ring-1 ring-white/10"
				} ${state === "wrong" ? "opacity-40 grayscale" : state === "other" ? "opacity-60" : ""}`}
			>
				<PosterImg title={{ poster: a.poster ?? null }} />
				{(state === "right" || state === "wrong") && (
					<span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-gray-950/85 ring-1 ring-white/10">
						<StateMark state={state} className="size-4" />
					</span>
				)}
			</span>
			<span
				className={`line-clamp-2 min-h-[2lh] text-xs leading-tight font-bold ${
					state === "right"
						? "text-amber-300"
						: state === "open"
							? "text-gray-200 group-hover:text-white"
							: state === "wrong"
								? "text-gray-500 line-through decoration-gray-600"
								: "text-gray-400"
				}`}
			>
				{a.label}
				{srState(state)}
			</span>
			<span
				className={`min-h-[2lh] text-[11px] leading-tight text-gray-400 tabular-nums ${revealed ? "" : "invisible"}`}
			>
				{a.detail}
			</span>
		</button>
	)
}

function TextAnswer({ q, a, state, onPick }: AnswerProps) {
	const revealed = state !== "open"
	return (
		<button
			type="button"
			data-quiz-answer={`${q.id}:${a.key}`}
			aria-disabled={revealed || undefined}
			onClick={(e) => onPick(e.currentTarget)}
			className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-[background-color,box-shadow,opacity] duration-300 motion-reduce:transition-none ${FOCUS} ${
				state === "right"
					? "cursor-default bg-amber-400/15 ring-2 ring-amber-400"
					: state === "wrong"
						? "cursor-default bg-white/[0.02] ring-1 ring-white/10"
						: state === "other"
							? "cursor-default opacity-60 ring-1 ring-white/5"
							: "bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.07] hover:ring-white/25"
			}`}
		>
			{a.thumb !== undefined && (
				<span className={`block w-7 shrink-0 ${state === "wrong" ? "opacity-40 grayscale" : ""}`}>
					<PosterImg title={{ poster: a.thumb }} className="rounded-sm" />
				</span>
			)}
			{a.country && (
				<span
					aria-hidden
					className={`text-xl leading-none ${state === "wrong" ? "opacity-40 grayscale" : ""}`}
				>
					{flag(a.country)}
				</span>
			)}
			<span className="flex min-w-0 flex-1 flex-col">
				<span
					className={`text-sm font-bold sm:text-base ${
						state === "right"
							? "text-amber-200"
							: state === "wrong"
								? "text-gray-500 line-through decoration-gray-600"
								: state === "other"
									? "text-gray-300"
									: "text-gray-100"
					}`}
				>
					{a.label}
					{srState(state)}
				</span>
				{a.sub && <span className="truncate text-[11px] text-gray-500">{a.sub}</span>}
			</span>
			<span
				className={`max-w-[42%] shrink-0 text-right text-xs leading-tight tabular-nums ${state === "right" ? "text-amber-200/90" : "text-gray-400"} ${revealed ? "" : "invisible"}`}
			>
				{a.detail}
			</span>
			<StateMark state={state} className="shrink-0" />
		</button>
	)
}

function QuizCard({
	q,
	n,
	total,
	order,
	pick,
	onPick,
}: {
	q: QuizQuestion
	n: number
	total: number
	order: number[]
	pick: string | undefined
	onPick: (q: QuizQuestion, a: QuizAnswer, el: HTMLElement) => void
}) {
	const posters = q.answers.every((a) => a.poster !== undefined)
	const answers = order.map((i) => q.answers[i])
	const stateOf = (a: QuizAnswer): State =>
		!pick ? "open" : a.key === q.right ? "right" : a.key === pick ? "wrong" : "other"
	const line = (ok: boolean) => (
		<p className="text-sm text-gray-400">
			<b className={ok ? "text-amber-300" : "text-gray-200"}>{ok ? "Right." : "Not quite."}</b>{" "}
			{q.explain}
			{q.link && (
				<>
					{" "}
					<MoreLink to={q.link.to} className="text-sm">
						{q.link.label}
					</MoreLink>
				</>
			)}
		</p>
	)
	return (
		<article
			id={q.id}
			aria-labelledby={`${q.id}-q`}
			className={`${PANEL} relative flex scroll-mt-24 flex-col gap-4 p-4 sm:p-5`}
		>
			<div className="flex items-center justify-between gap-2">
				<Kicker>{q.category}</Kicker>
				<span className="text-xs font-bold text-gray-500 tabular-nums">
					{n} of {total}
				</span>
			</div>
			<h3
				id={`${q.id}-q`}
				className={`${DISPLAY} text-2xl leading-tight text-white sm:text-[1.7rem]`}
			>
				{q.question}
			</h3>
			<div className="flex flex-col gap-4">
				<fieldset>
					<legend className="sr-only">Answers</legend>
					{posters ? (
						<div className="grid grid-cols-3 gap-2 sm:gap-3">
							{answers.map((a) => (
								<PosterAnswer
									key={a.key}
									q={q}
									a={a}
									state={stateOf(a)}
									onPick={(el) => onPick(q, a, el)}
								/>
							))}
						</div>
					) : (
						<div className="flex flex-col gap-2">
							{answers.map((a) => (
								<TextAnswer
									key={a.key}
									q={q}
									a={a}
									state={stateOf(a)}
									onPick={(el) => onPick(q, a, el)}
								/>
							))}
						</div>
					)}
				</fieldset>
				{/* The explanation's space is held from the start: the hint and both reveals, stacked. */}
				<Stack
					at={!pick ? 0 : pick === q.right ? 1 : 2}
					items={[
						<p key="hint" className="text-sm text-gray-500">
							Pick one of three.
						</p>,
						line(true),
						line(false),
					]}
				/>
			</div>
		</article>
	)
}

/** "Ten", for "Ten questions"; the digits past twelve. */
export const numberWord = (n: number) => WORDS[n] ?? String(n)

export function Quiz({ quiz }: { quiz: QuizQuestion[] }) {
	const total = quiz.length
	const identity = useMemo(() => Object.fromEntries(quiz.map((q) => [q.id, [0, 1, 2]])), [quiz])
	const [picks, setPicks] = useState<Picks>({})
	const [orders, setOrders] = useState<Record<string, number[]>>(identity)
	const [round, setRound] = useState(0)
	const [said, setSaid] = useState("")
	const host = useRef<HTMLElement>(null)
	const verdictBox = useRef<HTMLDivElement>(null)
	const stage = useRef<HostStage | null>(null)
	const seed = useRef(1)
	const timer = useRef(0)
	const alive = useRef(true)

	const answered = Object.keys(picks).length
	const right = quiz.filter((q) => picks[q.id] === q.right).length
	const done = total > 0 && answered === total
	const v = verdict(right, total)

	// Shuffle after mount only: the server render and the first paint use the written order.
	useEffect(() => setOrders(shuffled(quiz)), [quiz])

	useEffect(() => {
		alive.current = true
		return () => {
			alive.current = false
			stage.current?.destroy()
			stage.current = null
			window.clearTimeout(timer.current)
		}
	}, [])

	const ensureStage = async () => {
		if (stage.current) return stage.current
		// reduced motion plays no effects, so it never fetches them
		if (reducedMotion()) return null
		const effects = await loadEffects()
		if (!alive.current || !host.current) return null
		stage.current ??= effects.createHostStage(host.current, PX, {
			pad: 160,
			maxLive: 12,
		})
		return stage.current
	}

	// A new round puts focus on the first answer, with the quiz's top in view.
	useEffect(() => {
		if (!round || !host.current) return
		host.current.querySelector<HTMLElement>("[data-quiz-answer]")?.focus({ preventScroll: true })
		host.current.scrollIntoView({
			behavior: reducedMotion() ? "auto" : "smooth",
			block: "start",
		})
	}, [round])

	/** An element's box in host-local CSS px. */
	const spot = (el: Element) => {
		const h = host.current?.getBoundingClientRect()
		const r = el.getBoundingClientRect()
		if (!h) return null
		return {
			x: r.left - h.left + r.width / 2,
			y: r.top - h.top + r.height / 2,
			top: r.top - h.top,
			left: r.left - h.left,
			w: r.width,
			h: r.height,
		}
	}

	const celebrate = async (ok: boolean, el: HTMLElement, q: QuizQuestion, perfect: boolean) => {
		if (reducedMotion()) return
		const st = await ensureStage()
		if (!st) return
		const n = seed.current++
		// An answer with a picture bursts from the picture, not from the picture and its caption.
		const p = spot(pictureOf(el))
		if (!p) return
		if (ok) {
			st.play("pickups/collect-burst", p.x, p.y, { palette: GOLD, seed: n })
			st.play("cinema/glint", p.left + p.w - 8, p.top + 8, { palette: GOLD5, seed: n }, 0.18)
		} else {
			st.play("quiz/fizzle", p.x, p.y + 4, { seed: n })
			// Then a wink on the answer that was right, so the eye goes there.
			const r = host.current?.querySelector(
				`[data-quiz-answer="${CSS.escape(`${q.id}:${q.right}`)}"]`,
			)
			const rt = r ? spot(pictureOf(r)) : null
			if (rt)
				st.play(
					"cinema/glint",
					rt.left + rt.w - 10,
					rt.top + 10,
					{ palette: GOLD5, seed: n, s: 1.2 },
					0.45,
				)
		}
		if (!perfect) return
		// The perfect score: fireworks over the verdict where they fit, coins from it everywhere.
		window.clearTimeout(timer.current)
		timer.current = window.setTimeout(() => {
			const box = verdictBox.current && spot(verdictBox.current)
			if (!box) return
			if (box.w >= 640) {
				st.play("explosions/firework-burst", box.left + box.w * 0.25, box.top + 40, {
					palette: GOLD7,
					core: GOLD7,
					seed: n + 3,
				})
				st.play(
					"explosions/firework-burst",
					box.left + box.w * 0.75,
					box.top + 20,
					{ palette: GOLD7, core: GOLD7, seed: n + 7 },
					0.45,
				)
			} else {
				st.play("pickups/collect-burst", box.x, box.top + 40, { palette: GOLD, seed: n + 3 }, 0.1)
			}
			st.play(
				"stats/coin-fountain",
				box.x,
				box.top + box.h * 0.45,
				{ palette: GOLD, seed: n + 9 },
				0.9,
			)
			st.play("cinema/glint", box.left + 24, box.top + 20, { palette: GOLD5, seed: n }, 1.3)
			st.play(
				"cinema/glint",
				box.left + box.w - 24,
				box.top + 28,
				{ palette: GOLD5, seed: n + 1 },
				1.5,
			)
		}, 450)
	}

	const onPick = (q: QuizQuestion, a: QuizAnswer, el: HTMLElement) => {
		if (picks[q.id]) return
		const ok = a.key === q.right
		const nAnswered = answered + 1
		const nRight = right + (ok ? 1 : 0)
		setPicks((p) => ({ ...p, [q.id]: a.key }))
		const rightLabel = q.answers.find((x) => x.key === q.right)?.label
		let message = `${ok ? "Right." : `Not quite. The answer is ${rightLabel}.`} ${q.explain} ${nRight} of ${nAnswered} right.`
		if (nAnswered === total) {
			const final = verdict(nRight, total)
			message += ` Quiz done. ${final.label}. ${final.line}`
		}
		setSaid(message)
		void celebrate(ok, el, q, nAnswered === total && nRight === total)
	}

	const again = () => {
		stage.current?.clear()
		window.clearTimeout(timer.current)
		setPicks({})
		setOrders(shuffled(quiz))
		setRound((r) => r + 1)
		setSaid(`New round. The answers are shuffled. ${total} questions.`)
	}

	if (!total) return null
	return (
		<section
			ref={host}
			aria-labelledby="trivia-quiz-h"
			onPointerEnter={() => void ensureStage()}
			className="relative flex scroll-mt-[calc(8rem_+_var(--visitor-bar-h,0px))] flex-col gap-4"
		>
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<Kicker>Quiz</Kicker>
					<h3
						id="trivia-quiz-h"
						className={`${DISPLAY} text-2xl leading-tight text-white sm:text-3xl`}
					>
						{numberWord(total)} questions, three answers each.
					</h3>
				</div>
				<Score quiz={quiz} picks={picks} />
			</div>
			<p aria-live="polite" className="sr-only">
				{said}
			</p>
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{quiz.map((q, i) => (
					<QuizCard
						key={q.id}
						q={q}
						n={i + 1}
						total={total}
						order={orders[q.id] ?? [0, 1, 2]}
						pick={picks[q.id]}
						onPick={onPick}
					/>
				))}
				<div
					ref={verdictBox}
					className={`${PANEL} relative flex flex-col justify-center p-4 sm:p-5 md:col-span-2 xl:col-span-2 ${done && right === total ? "ring-amber-400/60" : ""}`}
				>
					<Stack
						at={done ? 1 : 0}
						items={[
							<div key="pending" className="flex flex-col gap-3">
								<Kicker>Your score</Kicker>
								<p
									className={`${DISPLAY} text-4xl leading-none text-white tabular-nums sm:text-5xl`}
								>
									<span className="text-amber-400">{right}</span>
									<span className="font-light text-gray-500"> of {total}</span>
								</p>
								<p className="text-sm text-gray-400">
									{answered
										? `${answered} answered, ${total - answered} to go. Answer all ${total} to see how you did.`
										: `Answer all ${total} to see how you did.`}
								</p>
								<Dots quiz={quiz} picks={picks} />
							</div>,
							<div key="done" className="flex flex-col gap-3">
								<Kicker>
									{right} of {total} right
								</Kicker>
								<p className={`${DISPLAY} text-4xl leading-none text-amber-400 sm:text-5xl`}>
									{v.label}
								</p>
								<p className="text-sm text-gray-300">{v.line}</p>
								<div className="flex flex-wrap items-center gap-3">
									<PrimaryButton
										type="button"
										onClick={again}
										tabIndex={done ? 0 : -1}
										className={`inline-flex min-h-10 items-center gap-1.5 px-4 text-sm ${FOCUS}`}
									>
										Try again
									</PrimaryButton>
									<Dots quiz={quiz} picks={picks} />
								</div>
							</div>,
						]}
					/>
				</div>
			</div>
		</section>
	)
}
