// PROTOTYPE - throwaway (map #365). The hub at /prototype/tracking: the tracking prototypes, each with its
// open questions to answer, and the answers as text to paste back to the agent.
import { ArrowTopRightOnSquareIcon, ClipboardDocumentIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useRef, useState } from "react"
import { AnswerControl, answerActions, countAnswered, isAnswered, summary, useAnswers } from "./answers"
import { ALL_QUESTIONS, HUB, type HubPrototype, REMINDERS } from "./questions"

const SURFACE = "bg-[#141923]"
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
const BUTTON = `inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`
const ISSUES = "https://github.com/alp82/goodwatch-monorepo/issues"

function Meter({ value, max }: { value: number; max: number }) {
	return (
		<span className="block h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
			<span className="block h-full rounded-full bg-green-500 transition-[width]" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
		</span>
	)
}

function PrototypeSection({ prototype }: { prototype: HubPrototype }) {
	const answers = useAnswers()
	const done = countAnswered(answers, prototype.questions)
	const open = prototype.questions.length - done
	let group = ""
	return (
		<section id={prototype.key} data-prototype={prototype.key} className={`scroll-mt-20 rounded-2xl border border-white/10 p-4 sm:p-5 ${SURFACE}`}>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 flex-1 basis-80">
					<h2 className="text-xl font-bold text-white">{prototype.title}</h2>
					<p className="mt-1 text-sm text-gray-400">{prototype.about}</p>
					<p className="mt-1 text-xs text-gray-500">
						Notes: <code>{prototype.readme}</code> ·{" "}
						<a href={`${ISSUES}/${prototype.issue}`} className="underline underline-offset-2 hover:text-gray-300">
							issue #{prototype.issue}
						</a>
					</p>
					{prototype.earlier && (
						<p className="mt-1 text-xs text-gray-500">
							<Link to={prototype.earlier.link} className="underline underline-offset-2 hover:text-gray-300" data-testid={`earlier-${prototype.key}`}>
								{prototype.earlier.label}
							</Link>
						</p>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Link to={prototype.link} className={`${BUTTON} bg-white text-black hover:bg-neutral-200`}>
						Open the prototype
						<ArrowTopRightOnSquareIcon className="h-4 w-4" />
					</Link>
					<button type="button" disabled={open === 0} onClick={() => answerActions.acceptSuggested(prototype.questions)} className={`${BUTTON} bg-amber-400 text-black hover:bg-amber-300`} data-testid={`accept-${prototype.key}`}>
						Accept all suggested{open > 0 && open < prototype.questions.length ? ` (${open} left)` : ""}
					</button>
				</div>
			</div>
			<div className="mt-3 flex items-center gap-3">
				<span className="shrink-0 text-sm font-semibold text-white" data-testid={`progress-${prototype.key}`}>
					{done} of {prototype.questions.length} answered
				</span>
				<span className="flex-1">
					<Meter value={done} max={prototype.questions.length} />
				</span>
			</div>

			<ol className="mt-4 space-y-4">
				{prototype.questions.map((question) => {
					const heading = question.group && question.group !== group ? question.group : ""
					if (question.group) group = question.group
					return (
						<li key={question.id}>
							{heading && <h3 className={`mb-3 mt-6 text-sm font-bold uppercase tracking-wide ${heading === "The rest" ? "text-gray-300" : "text-amber-300"}`}>{heading}</h3>}
							<div className={`rounded-xl border p-3 ${isAnswered(answers, question.id) ? "border-green-500/40 bg-green-500/[0.04]" : "border-white/10 bg-white/[0.03]"}`}>
								<div className="flex flex-wrap items-start gap-x-3 gap-y-1">
									<span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs font-bold text-gray-200">{question.id}</span>
									<p className="min-w-0 flex-1 basis-64 text-sm text-gray-100">
										<b className="text-white">{question.short}.</b> {question.text}
									</p>
									<Link to={question.link} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-sky-300 underline underline-offset-2 hover:text-sky-200" data-testid={`link-${question.id}`}>
										See it
										<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
									</Link>
								</div>
								<div className="mt-2">
									<AnswerControl question={question} />
								</div>
							</div>
						</li>
					)
				})}
			</ol>
		</section>
	)
}

export function Hub() {
	const answers = useAnswers()
	const [copied, setCopied] = useState("")
	const area = useRef<HTMLTextAreaElement>(null)
	const done = countAnswered(answers, ALL_QUESTIONS)
	const text = summary(answers, HUB)
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text)
			setCopied("Copied to the clipboard.")
		} catch {
			// No clipboard permission: select the text, so one Ctrl+C does it.
			area.current?.focus()
			area.current?.select()
			setCopied("Selected below. Press Ctrl+C to copy.")
		}
	}
	return (
		<div className="mx-auto max-w-5xl overflow-x-clip px-3 pb-32 pt-5 text-white sm:px-5">
			<h1 className="text-2xl font-bold">Tracking decisions</h1>
			<p className="mt-1 max-w-3xl text-sm text-gray-400">
				Every open question of the tracking prototypes (map{" "}
				<a href={`${ISSUES}/365`} className="underline underline-offset-2 hover:text-gray-200">
					#365
				</a>
				). Open a question in its prototype with "See it", answer here or in the prototype, then copy the answers and paste them back to the agent. Answers stay in this browser.
			</p>

			<div className={`sticky top-16 z-30 mt-4 rounded-2xl border border-white/10 p-3 shadow-2xl ${SURFACE}`}>
				<div className="flex flex-wrap items-center gap-3">
					<span className="text-lg font-bold" data-testid="progress">
						{done} of {ALL_QUESTIONS.length} answered
					</span>
					<span className="min-w-24 flex-1">
						<Meter value={done} max={ALL_QUESTIONS.length} />
					</span>
					<button type="button" onClick={copy} className={`${BUTTON} bg-green-500 text-black hover:bg-green-400`} data-testid="copy">
						<ClipboardDocumentIcon className="h-4 w-4" />
						Copy answers
					</button>
				</div>
				<nav className="mt-2 hidden flex-wrap gap-x-4 gap-y-1 text-sm sm:flex">
					{HUB.map((prototype) => (
						<a key={prototype.key} href={`#${prototype.key}`} className="text-gray-300 underline decoration-white/20 underline-offset-2 hover:text-white">
							{prototype.title} {countAnswered(answers, prototype.questions)}/{prototype.questions.length}
						</a>
					))}
					<a href="#answers" className="text-gray-300 underline decoration-white/20 underline-offset-2 hover:text-white">
						Answers as text
					</a>
				</nav>
			</div>

			<div className="mt-5 space-y-5">
				{HUB.map((prototype) => (
					<PrototypeSection key={prototype.key} prototype={prototype} />
				))}
			</div>

			<section id="answers" className={`mt-5 scroll-mt-40 rounded-2xl border border-white/10 p-4 sm:p-5 ${SURFACE}`}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="text-xl font-bold">Answers as text</h2>
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-sm text-green-300" aria-live="polite" data-testid="copied">
							{copied}
						</span>
						<button type="button" onClick={copy} className={`${BUTTON} bg-green-500 text-black hover:bg-green-400`}>
							<ClipboardDocumentIcon className="h-4 w-4" />
							Copy answers
						</button>
						<button
							type="button"
							onClick={() => {
								if (window.confirm("Remove every answer and note in this browser?")) answerActions.clear()
							}}
							className={`${BUTTON} bg-white/10 text-gray-100 hover:bg-white/20`}
						>
							Clear all
						</button>
					</div>
				</div>
				<p className="mt-1 text-sm text-gray-400">One line per question: id, short question, the chosen option, your note.</p>
				<textarea ref={area} readOnly value={text} rows={Math.min(24, text.split("\n").length + 1)} data-testid="summary" className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed text-gray-100" />
			</section>

			<section className="mt-5 rounded-2xl border border-dashed border-white/20 p-4 sm:p-5">
				<h2 className="text-lg font-bold">Also waiting, not a prototype</h2>
				<p className="mt-1 text-sm text-gray-400">Reminders only. Nothing to answer here.</p>
				<ul className="mt-3 space-y-2">
					{REMINDERS.map((reminder) => (
						<li key={reminder.issue} className="text-sm text-gray-200">
							<a href={`${ISSUES}/${reminder.issue}`} className="font-semibold text-white underline underline-offset-2">
								{reminder.title} (#{reminder.issue})
							</a>
							. {reminder.text}
						</li>
					))}
				</ul>
			</section>
		</div>
	)
}
