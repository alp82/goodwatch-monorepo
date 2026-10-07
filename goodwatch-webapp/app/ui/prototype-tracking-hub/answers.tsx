// PROTOTYPE - throwaway (map #365). The owner's answers to the open questions of the tracking prototypes, kept in
// this browser's localStorage under one key. The playground at /prototype/tracking-rules and the hub at
// /prototype/tracking both read and write it, so an answer given in one shows in the other.
import { CheckIcon } from "@heroicons/react/24/solid"
import { useSyncExternalStore } from "react"
import type { HubPrototype, HubQuestion } from "./questions"

const STORAGE_KEY = "PROTOTYPE-tracking-answers-wipe-me"

export interface Answer {
	option?: string
	note?: string
}
export type Answers = Record<string, Answer>

const EMPTY: Answers = {}
let current: Answers | null = null
const listeners = new Set<() => void>()

function read(): Answers {
	if (current) return current
	try {
		current = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Answers
	} catch {
		current = {}
	}
	return current
}

function write(next: Answers) {
	current = next
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
	} catch {}
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	// Another tab answered: the hub and the playground are often open side by side.
	const onStorage = (event: StorageEvent) => {
		if (event.key !== STORAGE_KEY) return
		current = null
		listener()
	}
	window.addEventListener("storage", onStorage)
	return () => {
		listeners.delete(listener)
		window.removeEventListener("storage", onStorage)
	}
}

const change = (id: string, patch: Answer) => {
	const next = { ...read(), [id]: { ...read()[id], ...patch } }
	if (!next[id].option && !next[id].note) delete next[id]
	write(next)
}

export const answerActions = {
	/** Choosing the chosen option again takes the answer back. */
	choose: (id: string, option: string) => change(id, { option: read()[id]?.option === option ? undefined : option }),
	note: (id: string, note: string) => change(id, { note: note || undefined }),
	/** The suggested option for every question that has no answer yet. Answers already given stay. */
	acceptSuggested: (questions: HubQuestion[]) => {
		const next = { ...read() }
		for (const question of questions) {
			const suggested = question.options.find((o) => o.suggested)
			if (suggested && !next[question.id]?.option) next[question.id] = { ...next[question.id], option: suggested.id }
		}
		write(next)
	},
	clear: () => write({}),
}

export const useAnswers = () => useSyncExternalStore(subscribe, read, () => EMPTY)

export const isAnswered = (answers: Answers, id: string) => !!answers[id]?.option
export const countAnswered = (answers: Answers, questions: HubQuestion[]) => questions.filter((question) => isAnswered(answers, question.id)).length

/** The answers as plain text, to paste back to the agent: prototype, question id, short question, option, note. */
export function summary(answers: Answers, prototypes: HubPrototype[]): string {
	const all = prototypes.flatMap((p) => p.questions)
	const lines = [`GoodWatch tracking decisions: ${countAnswered(answers, all)} of ${all.length} answered`]
	for (const prototype of prototypes) {
		lines.push("", `== ${prototype.title} (${prototype.link.split("?")[0]}, #${prototype.issue}): ${countAnswered(answers, prototype.questions)} of ${prototype.questions.length}`)
		for (const question of prototype.questions) {
			const answer = answers[question.id]
			const option = question.options.find((o) => o.id === answer?.option)
			const chosen = option ? `${option.id}) ${option.label}${option.suggested ? " [suggested]" : " [NOT the suggested one]"}` : "(no answer)"
			lines.push(`${question.id} | ${question.short} | ${chosen}${answer?.note ? ` | note: ${answer.note}` : ""}`)
		}
	}
	return lines.join("\n")
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"

/** The option buttons of one question, the suggested one marked, and a free-text note. */
export function AnswerControl({ question, heading }: { question: HubQuestion; heading?: string }) {
	const answer = useAnswers()[question.id]
	return (
		<div data-question={question.id}>
			{heading && <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{heading}</p>}
			<div className="flex flex-col gap-1.5">
				{question.options.map((option) => {
					const on = answer?.option === option.id
					return (
						<button
							key={option.id}
							type="button"
							aria-pressed={on}
							title={option.detail}
							onClick={() => answerActions.choose(question.id, option.id)}
							className={`flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${FOCUS} ${
								on ? "bg-green-500 font-semibold text-black" : "bg-white/[0.07] text-gray-100 hover:bg-white/15"
							}`}
						>
							<span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase ${on ? "bg-black/20" : "bg-white/10 text-gray-300"}`}>
								{on ? <CheckIcon className="h-3.5 w-3.5" /> : option.id}
							</span>
							<span className="min-w-0 flex-1">{option.label}</span>
							{option.suggested && (
								<span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${on ? "bg-black/20 text-black" : "bg-amber-400/20 text-amber-300"}`}>Suggested</span>
							)}
						</button>
					)
				})}
			</div>
			<input
				type="text"
				value={answer?.note ?? ""}
				onChange={(event) => answerActions.note(question.id, event.target.value)}
				placeholder="Note (optional)"
				aria-label={`Note for ${question.id}`}
				className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white placeholder:text-gray-500 focus:border-white/40 focus:outline-none"
			/>
		</div>
	)
}
