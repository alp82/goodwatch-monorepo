// PROTOTYPE (discover-easy) B "Three taps": a guided card like the start page's Tap three. One question at a time
// (What kind, How should it feel, How much time), big answers, Skip on every step. Each answer lands as a step pill in
// the progress row, which also lets the visitor jump back. The results under the card follow every tap.
import { useState } from "react"
import { WORDS } from "~/domain/taste-picker"
import {
	ChoiceChips,
	Count,
	type EasyContext,
	Essentials,
	FineTune,
	MIXES,
	ModeSwitch,
	TIME_CHOICES,
	activeMix,
	backdrop,
	timeKey,
	usePictures,
	wordHue,
	wordIds,
	wordName,
	wordsPatch,
} from "./kit"

export const name = "Three taps"

const STEPS = ["kind", "feel", "time"] as const
type Step = (typeof STEPS)[number] | "done"

const KINDS = [
	{ key: "movie", label: "A movie", line: "One sitting", icon: "🎬" },
	{ key: "show", label: "A show", line: "Something to come back to", icon: "📺" },
	{ key: "all", label: "Either", line: "Surprise me", icon: "✨" },
] as const

const TIME_LINES: Record<string, string> = {
	any: "No limit",
	short: "A quick one",
	mid: "A normal evening",
	long: "Settle in",
}

export function VariantB({ ctx }: { ctx: EasyContext }) {
	const s = ctx.filters.state
	const [step, setStep] = useState<Step>(() => (wordIds(s).length || s.type !== "all" ? "done" : "kind"))
	const next = (from: Step) => setStep(STEPS[STEPS.indexOf(from as never) + 1] ?? "done")
	const pictures = usePictures()
	const mix = activeMix(s)
	const summary: Record<(typeof STEPS)[number], string> = {
		kind: KINDS.find((k) => k.key === s.type)?.label ?? "Either",
		feel: mix?.name ?? (wordIds(s).length ? wordIds(s).map(wordName).join(", ") : "Any feeling"),
		time: TIME_CHOICES.find((c) => c.key === timeKey(s))?.label ?? "Any length",
	}
	return (
		<section>
			<div className="flex items-center justify-between gap-3">
				<h1 className="brand-header text-[23px] leading-tight text-white lg:text-[30px]">Discover</h1>
				<ModeSwitch />
			</div>

			<div className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-b from-gray-800/80 to-gray-900/80 ring-1 ring-white/10">
				{/* Progress: each step is a pill with its answer; any pill reopens its step. */}
				<ol className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 lg:px-6">
					{STEPS.map((id, i) => (
						<li key={id} className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setStep(id)}
								className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
									step === id ? "bg-amber-400 text-gray-950" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.12]"
								}`}
							>
								<span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${step === id ? "bg-gray-950/20" : "bg-white/10"}`}>
									{i + 1}
								</span>
								{summary[id]}
							</button>
							{i < STEPS.length - 1 && <span className="text-gray-600">›</span>}
						</li>
					))}
					<li className="ml-auto flex items-center gap-3 text-sm text-gray-400">
						<Count ctx={ctx} />
					</li>
				</ol>

				<div className="px-4 py-6 lg:px-6 lg:py-8">
					{step === "kind" && (
						<Question title="What are you up for?" onSkip={() => next("kind")}>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
								{KINDS.map((k) => (
									<BigChoice
										key={k.key}
										on={s.type === k.key}
										onClick={() => {
											ctx.filters.set({ type: k.key })
											next("kind")
										}}
										title={k.label}
										line={k.line}
										icon={k.icon}
									/>
								))}
							</div>
						</Question>
					)}
					{step === "feel" && (
						<Question title="How should it feel?" onSkip={() => next("feel")}>
							<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
								{MIXES.map((m) => (
									<button
										key={m.id}
										type="button"
										onClick={() => {
											ctx.filters.set(wordsPatch(m.parts))
											next("feel")
										}}
										className={`group relative h-28 cursor-pointer overflow-hidden rounded-2xl text-left ring-2 transition lg:h-32 ${
											mix?.id === m.id ? "ring-amber-400" : "ring-transparent hover:ring-white/30"
										}`}
										style={{ background: wordHue(m.parts[0]) }}
									>
										{pictures[m.id] && (
											<img src={backdrop(pictures[m.id])} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105" />
										)}
										<span className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
										<span className="absolute bottom-0 p-3 font-bold text-white">{m.name}</span>
									</button>
								))}
							</div>
							<WordCloud ctx={ctx} onDone={() => next("feel")} />
						</Question>
					)}
					{step === "time" && (
						<Question title="How much time do you have?" onSkip={() => next("time")}>
							<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
								{TIME_CHOICES.map((c) => (
									<BigChoice
										key={c.key}
										on={timeKey(s) === c.key}
										onClick={() => {
											ctx.filters.set({ runtime: c.runtime ? { ...c.runtime } : undefined })
											next("time")
										}}
										title={c.label}
										line={TIME_LINES[c.key]}
									/>
								))}
							</div>
						</Question>
					)}
					{step === "done" && (
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div>
								<p className="text-xl font-semibold text-white lg:text-2xl">Here's what fits.</p>
								<div className="mt-3 flex flex-wrap gap-2">
									<Essentials ctx={ctx} />
								</div>
							</div>
							<div className="flex items-center gap-4 text-sm">
								<button type="button" onClick={() => setStep("kind")} className="cursor-pointer font-semibold text-gray-300 hover:text-white">
									Ask again
								</button>
								<FineTune label="More filters →" />
							</div>
						</div>
					)}
				</div>
			</div>
			<div className="mt-4">
				<ChoiceChips ctx={ctx} />
			</div>
		</section>
	)
}

function Question({ title, onSkip, children }: { title: string; onSkip: () => void; children: React.ReactNode }) {
	return (
		<div>
			<div className="mb-5 flex items-baseline justify-between gap-3">
				<p className="text-2xl font-semibold text-white lg:text-3xl">{title}</p>
				<button type="button" onClick={onSkip} className="cursor-pointer text-sm font-semibold text-gray-400 hover:text-white">
					Skip
				</button>
			</div>
			{children}
		</div>
	)
}

function BigChoice({ on, onClick, title, line, icon }: { on: boolean; onClick: () => void; title: string; line: string; icon?: string }) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			className={`flex cursor-pointer flex-col items-start gap-1 rounded-2xl p-5 text-left ring-2 transition ${
				on ? "bg-amber-400/10 ring-amber-400" : "bg-white/[0.05] ring-white/10 hover:bg-white/[0.09] hover:ring-white/25"
			}`}
		>
			{icon && <span className="mb-2 text-3xl" aria-hidden>{icon}</span>}
			<span className="text-lg font-bold text-white">{title}</span>
			<span className="text-sm text-gray-400">{line}</span>
		</button>
	)
}

/** Single words under the mixes, up to three, for a visitor who wants their own blend. */
function WordCloud({ ctx, onDone }: { ctx: EasyContext; onDone: () => void }) {
	const picked = wordIds(ctx.filters.state)
	const [open, setOpen] = useState(false)
	if (!open)
		return (
			<button type="button" onClick={() => setOpen(true)} className="mt-4 cursor-pointer text-sm font-semibold text-amber-400 hover:text-amber-300">
				Or pick your own words →
			</button>
		)
	return (
		<div className="mt-5">
			<p className="mb-2 text-sm text-gray-400">Pick up to three.</p>
			<div className="flex flex-wrap gap-2">
				{WORDS.filter((w) => w.kind === "mood").map((w) => {
					const on = picked.includes(w.id)
					return (
						<button
							key={w.id}
							type="button"
							aria-pressed={on}
							disabled={!on && picked.length >= 3}
							onClick={() => ctx.filters.set(wordsPatch(on ? picked.filter((p) => p !== w.id) : [...picked, w.id]))}
							className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
								on ? "bg-white text-gray-950 ring-white" : "bg-white/[0.05] text-gray-200 ring-white/10 hover:bg-white/[0.1]"
							}`}
						>
							<span className="h-2 w-2 rounded-full" style={{ background: w.hue }} />
							{w.name}
						</button>
					)
				})}
			</div>
			{picked.length > 0 && (
				<button type="button" onClick={onDone} className="mt-4 cursor-pointer rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-amber-300">
					Next
				</button>
			)}
		</div>
	)
}
