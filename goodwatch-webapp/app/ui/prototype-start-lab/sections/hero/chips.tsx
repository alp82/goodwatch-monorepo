// PROTOTYPE (start page lab): hero b, mood chips: the field plus tappable chips (the 11 Discover moods and a few
// typed prompts), so a guest can try search without a keyboard. A chip shows its results at once.
import { useState } from "react"
import { Answer, CHIP, chipTone, SearchField, useHeroSearch } from "./shared"

const PROMPT_CHIPS = 3

export function ChipsHero() {
	const { answer, search, mood, prompt, clear, data } = useHeroSearch()
	const [draft, setDraft] = useState("")
	const [on, setOn] = useState<string | null>(null)
	const moods = data.guest.moods
	const prompts = data.guest.prompts.slice(0, PROMPT_CHIPS)

	const tapMood = (key: string) => {
		if (on === `m:${key}`) {
			setOn(null)
			return clear()
		}
		setOn(`m:${key}`)
		setDraft("")
		mood(key)
	}
	const tapPrompt = (q: string) => {
		setOn(`p:${q}`)
		setDraft(q)
		prompt(q)
	}

	return (
		<section className="mx-auto max-w-7xl px-4 pt-5 pb-4 sm:px-6 sm:pt-10">
			<h1 className="mb-1 text-sm font-semibold text-gray-400 sm:text-base">Search by mood or anything</h1>
			<SearchField
				value={draft}
				onChange={(v) => {
					setDraft(v)
					if (on?.startsWith("p:")) setOn(null)
				}}
				onSubmit={(v) => {
					setOn(null)
					search(v)
				}}
				onClear={() => {
					setOn(null)
					clear()
				}}
				placeholder="Type it, or tap a mood"
			/>
			{/* Phones: two rows that scroll sideways to the screen's edge; wider screens wrap. */}
			<div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0">
				<div className="grid w-max grid-flow-col grid-rows-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
					{moods.map((m) => (
						<button key={m.key} type="button" onClick={() => tapMood(m.key)} aria-pressed={on === `m:${m.key}`} className={`${CHIP} ${chipTone(on === `m:${m.key}`)}`}>
							{m.label}
						</button>
					))}
					{prompts.map((p) => (
						<button
							key={p.q}
							type="button"
							onClick={() => tapPrompt(p.q)}
							aria-pressed={on === `p:${p.q}`}
							className={`${CHIP} ${chipTone(on === `p:${p.q}`)} italic`}
						>
							“{p.q}”
						</button>
					))}
				</div>
			</div>
			{answer ? <Answer answer={answer} /> : null}
		</section>
	)
}
