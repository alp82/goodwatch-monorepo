// PROTOTYPE (start page lab, round 2): member b "Three quick questions": How much time? → What kind? → What mood?
// (each skippable) lead to one pick with its reasons and two alternatives; the answers stay as chips that change the
// pick in place. Everything lives in one fixed box, so nothing below moves. Then the inline deep dives.
// Ranking: ab-rank.tsx.
import { ArrowPathIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"
import { EASE } from "~/ui/watch-next/style"
import type { BlockVariant } from "../../lab/types"
import { DISPLAY, posterSrc } from "../member/shared"
import { BOX, CHIP, CardFace, RoomBackdrop, WatchLink, chipLook } from "./ab-card"
import { DeepDives } from "./ab-dives"
import { type Ask, type Candidate, type Kind, type Mood, type Time, fitsOf, ranked, reasonOf, useCandidates } from "./ab-rank"

type Q = "time" | "kind" | "mood"
type Answers = { time?: Time; kind?: Kind; mood?: Mood }
type Option = { value: string; label: string; short: string; sub: string }

const ORDER: Q[] = ["time", "kind", "mood"]
const QUESTION: Record<Q, string> = { time: "How much time?", kind: "What kind?", mood: "What mood?" }
const ANY: Record<Q, string> = { time: "Any length", kind: "Anything", mood: "Any mood" }

function optionsOf(q: Q, all: Candidate[]): Option[] {
	const n = (f: (c: Candidate) => boolean) => all.filter(f).length
	const titles = (k: number) => `${k} ${k === 1 ? "title" : "titles"}`
	if (q === "time")
		return [
			{ value: "u30", label: "Under 30 minutes", short: "Under 30 min", sub: titles(n((c) => c.runtime != null && c.runtime <= 30)) },
			{ value: "hour", label: "About an hour", short: "About an hour", sub: titles(n((c) => c.runtime != null && c.runtime >= 40 && c.runtime <= 75)) },
			{ value: "night", label: "A movie night", short: "Movie night", sub: titles(n((c) => c.card.media_type === "movie" && (c.runtime ?? 0) >= 80)) },
		]
	if (q === "kind") {
		const k = n((c) => c.source === "tonight" || c.source === "continue")
		return [
			{ value: "keep", label: "Keep watching", short: "Keep watching", sub: `${k} ${k === 1 ? "show" : "shows"} with a next episode` },
			{ value: "new", label: "Something new", short: "Something new", sub: "From your Wishlist and For you" },
		]
	}
	return [
		{ value: "light", label: "Light", short: "Light", sub: "Funny, warm, easy" },
		{ value: "gripping", label: "Gripping", short: "Gripping", sub: "Tense, dark, twisty" },
	]
}

function QuickQuestions() {
	const all = useCandidates()
	const [answers, setAnswers] = useState<Answers>({})
	const [step, setStep] = useState(0) // 0-2: asking, 3: the pick
	const [editing, setEditing] = useState<Q | null>(null)
	const [page, setPage] = useState(0)
	const [sel, setSel] = useState<number | null>(null)

	const ask: Ask = answers
	const list = useMemo(() => ranked(all, ask, 30), [all, ask])
	const pages = Math.max(1, Math.ceil(list.length / 3))
	const three = list.slice((page % pages) * 3, (page % pages) * 3 + 3)
	const pick = three.find((c) => c.card.key === sel) ?? three[0] ?? null
	const alts = three.filter((c) => c !== pick).slice(0, 2)
	const posters = useMemo(() => list.slice(0, 16).map((c) => c.card), [list])

	const answer = (q: Q, value: string | undefined) => {
		setAnswers((a) => ({ ...a, [q]: value }))
		setPage(0)
		setSel(null)
	}
	const done = step >= 3

	return (
		<div className="pb-28">
			<RoomBackdrop posters={posters} className="pb-6 pt-5 md:pb-10 md:pt-10">
				<div className={BOX}>
					<div className="flex items-end justify-between gap-3">
						<div className="min-w-0">
							<p className="text-xs font-semibold text-gray-300 md:text-sm">Welcome back, Sam</p>
							<h1 className={`${DISPLAY} text-3xl leading-none text-white md:text-4xl`}>Tonight</h1>
						</div>
						{done ? (
							<button
								type="button"
								onClick={() => {
									setAnswers({})
									setStep(0)
									setEditing(null)
									setPage(0)
									setSel(null)
								}}
								className="h-9 shrink-0 cursor-pointer rounded-md px-2 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300"
							>
								Ask again
							</button>
						) : (
							<button
								type="button"
								onClick={() => setStep(3)}
								className="h-9 shrink-0 cursor-pointer rounded-md px-2 text-sm font-semibold text-gray-300 hover:bg-white/10 hover:text-white"
							>
								Just pick one
							</button>
						)}
					</div>

					{/* The answers: one row, always this tall. Tapping an answer swaps the row for its options. */}
					<div className="relative mt-3 h-9">
						<AnimatePresence initial={false} mode="popLayout">
							{editing && done ? (
								<motion.div
									key={`edit-${editing}`}
									initial={{ opacity: 0, y: 6 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -6 }}
									transition={{ duration: 0.16, ease: EASE }}
									className="absolute inset-0 -mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
								>
									{[...optionsOf(editing, all), { value: "", label: ANY[editing], short: ANY[editing], sub: "" }].map((o) => {
										const on = (answers[editing] ?? "") === o.value
										return (
											<button
												key={o.value || "any"}
												type="button"
												aria-pressed={on}
												onClick={() => {
													answer(editing, o.value || undefined)
													setEditing(null)
												}}
												className={`${CHIP} ${chipLook(on)}`}
											>
												{o.short}
											</button>
										)
									})}
									<button
										type="button"
										aria-label="Close"
										onClick={() => setEditing(null)}
										className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-300 hover:bg-white/10"
									>
										<XMarkIcon className="h-5 w-5" />
									</button>
								</motion.div>
							) : (
								<motion.div
									key="answers"
									initial={{ opacity: 0, y: -6 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: 6 }}
									transition={{ duration: 0.16, ease: EASE }}
									className="absolute inset-0 -mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
								>
									{ORDER.map((q, i) => {
										const value = answers[q]
										const label = value ? optionsOf(q, all).find((o) => o.value === value)?.short : ANY[q]
										const reached = done || i < step
										return (
											<button
												key={q}
												type="button"
												disabled={!reached}
												onClick={() => (done ? setEditing(q) : setStep(i))}
												className={`${CHIP} gap-1 ${reached ? chipLook(!!value) : "bg-transparent text-gray-500 ring-white/10"} disabled:cursor-default`}
											>
												{reached ? label : QUESTION[q].replace("?", "")}
												{done ? <ChevronDownIcon className="h-4 w-4 opacity-70" aria-hidden /> : null}
											</button>
										)
									})}
								</motion.div>
							)}
						</AnimatePresence>
					</div>

					{/* The questions and the pick share this box. */}
					<div className="relative mt-4 h-[28rem] md:h-[31rem]">
						<AnimatePresence initial={false} mode="wait">
							{!done ? (
								<motion.div
									key={`q-${step}`}
									initial={{ opacity: 0, x: 28 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -28 }}
									transition={{ duration: 0.18, ease: EASE }}
									className="absolute inset-0 flex flex-col rounded-2xl bg-gray-950/75 p-4 ring-1 ring-white/10 md:p-8"
								>
									<p className="text-sm font-semibold tabular-nums text-gray-400">{step + 1} of 3</p>
									<h2 className={`${DISPLAY} mt-1 text-3xl leading-tight text-white md:text-5xl`}>{QUESTION[ORDER[step]]}</h2>
									<ul className="mt-5 grid gap-2.5 md:mt-8 md:auto-cols-fr md:grid-flow-col md:gap-3">
										{optionsOf(ORDER[step], all).map((o) => (
											<li key={o.value}>
												<button
													type="button"
													onClick={() => {
														answer(ORDER[step], o.value)
														setStep(step + 1)
													}}
													className="flex h-[4.5rem] w-full cursor-pointer flex-col justify-center rounded-xl bg-white/[0.08] px-4 text-left ring-1 ring-white/10 transition-colors duration-150 hover:bg-amber-400 hover:text-black hover:ring-amber-400 active:bg-amber-400 active:text-black md:h-36 md:px-6"
												>
													<span className="text-lg font-bold md:text-2xl">{o.label}</span>
													<span className="truncate text-xs opacity-70 md:text-sm">{o.sub}</span>
												</button>
											</li>
										))}
									</ul>
									<div className="mt-auto flex items-center justify-between pt-3">
										<button
											type="button"
											disabled={step === 0}
											onClick={() => setStep(step - 1)}
											className="h-10 cursor-pointer rounded-md px-2 text-sm font-semibold text-gray-300 hover:bg-white/10 disabled:invisible"
										>
											← Back
										</button>
										<button
											type="button"
											onClick={() => {
												answer(ORDER[step], undefined)
												setStep(step + 1)
											}}
											className="h-10 cursor-pointer rounded-md px-3 text-sm font-semibold text-gray-300 hover:bg-white/10 hover:text-white"
										>
											Skip
										</button>
									</div>
								</motion.div>
							) : (
								<motion.div
									key="pick"
									initial={{ opacity: 0, y: 12 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.22, ease: EASE }}
									className="absolute inset-0 flex flex-col"
								>
									<div className="relative h-[19rem] shrink-0 md:h-[22rem]">
										<AnimatePresence initial={false}>
											{pick ? (
												<motion.div
													key={pick.card.key}
													initial={{ opacity: 0, scale: 0.98 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0 }}
													transition={{ duration: 0.22, ease: EASE }}
													className="absolute inset-0"
												>
													<CardFace c={pick} lines={<FitLines fits={fitsOf(pick, ask)} />} />
												</motion.div>
											) : (
												<p className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gray-900 text-gray-400">Nothing fits. Change an answer.</p>
											)}
										</AnimatePresence>
									</div>

									<ul className="mt-3 grid h-[4.5rem] shrink-0 grid-cols-2 grid-rows-1 gap-2 overflow-hidden" aria-label="Or one of these">
										{alts.map((c) => (
											<li key={c.card.key} className="h-[4.5rem] min-w-0">
												<button
													type="button"
													onClick={() => setSel(c.card.key)}
													className="flex h-full w-full cursor-pointer items-center gap-2.5 rounded-xl bg-gray-950/75 p-2 text-left ring-1 ring-white/10 hover:bg-white/10"
												>
													<img src={posterSrc(c.card)} alt="" className="h-14 w-[2.375rem] shrink-0 rounded-md object-cover" />
													<span className="min-w-0">
														<span className="line-clamp-1 text-sm font-bold text-white">{c.card.title}</span>
														<span className="line-clamp-1 text-xs text-amber-300">{reasonOf(c)}</span>
													</span>
												</button>
											</li>
										))}
									</ul>

									<div className="mt-3 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
										<WatchLink c={pick} />
										<button
											type="button"
											disabled={pages < 2}
											onClick={() => {
												setPage((p) => p + 1)
												setSel(null)
											}}
											className="inline-flex h-12 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-4 font-semibold text-white hover:bg-white/15 disabled:opacity-40"
										>
											<ArrowPathIcon className="h-5 w-5" aria-hidden />3 more
										</button>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</RoomBackdrop>

			<DeepDives all={all} />
		</div>
	)
}

/** The pick's reasons: the first in amber, the rest under it. */
function FitLines({ fits }: { fits: string[] }) {
	const [first, ...rest] = fits
	return (
		<>
			<p className="truncate text-sm font-semibold text-amber-300 md:text-base">{first}</p>
			<p className="truncate text-sm text-gray-300">{rest.length ? rest.join(" · ") : " "}</p>
		</>
	)
}

export const variant: BlockVariant = { key: "b", name: "Three quick questions", C: QuickQuestions }
