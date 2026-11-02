// PROTOTYPE (discover-easy) round 3 B "Tokens": nothing under the search but one hint. The field itself shows what
// was understood: the filters as pills (× removes, a tap changes it in Advanced) and then the words searched by
// meaning. A press on the field's free space edits the typed request again.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { Fragment, useEffect, useRef, useState } from "react"
import { interpreted, useInterpretedSearch } from "./ProtoSearch"
import { EXAMPLES, type Easy, Pill, and, filtersOf, wantsOf } from "./bits"

export const name = "Tokens"

export function EasyB({ e }: { e: Easy }) {
	const { run, busy } = useInterpretedSearch()
	const filters = filtersOf(e)
	const wants = wantsOf(e).slice(0, 3)
	const typed = e.query !== null ? (interpreted.get(e.query)?.typed ?? e.query) : ""
	const asked = e.query !== null || filters.length > 0
	const [editing, setEditing] = useState(false)
	const [text, setText] = useState(typed)
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => setText(typed), [typed])
	useEffect(() => {
		if (editing) input.current?.focus()
	}, [editing])
	const showTokens = asked && !editing
	const submit = async () => {
		const t = text.trim()
		setEditing(false)
		if (t) await run(t)
		else e.clearSearch()
	}
	return (
		<div>
			<form
				role="search"
				onSubmit={(ev) => {
					ev.preventDefault()
					submit()
				}}
				onClick={(ev) => ev.target === ev.currentTarget && setEditing(true)}
				className={`relative flex cursor-text items-center gap-3 bg-white/[0.045] ring-1 ring-white/10 transition focus-within:ring-2 focus-within:ring-amber-400/60 ${
					e.phone ? "min-h-[62px] rounded-[22px] pl-4" : "min-h-[76px] rounded-[38px] pl-7"
				}`}
			>
				<MagnifyingGlassIcon className="pointer-events-none h-5 w-5 shrink-0 text-amber-300/90" aria-hidden />
				{showTokens ? (
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 py-3" onClick={(ev) => ev.target === ev.currentTarget && setEditing(true)}>
						{filters.map((c) => (
							<Pill key={c.key} chip={c} e={e} />
						))}
						{e.query !== null && (
							<button type="button" onClick={() => setEditing(true)} className="search-private brand-header cursor-text text-[19px] text-white lg:text-[21px]">
								{e.query}
							</button>
						)}
					</div>
				) : (
					<input
						ref={input}
						value={text}
						onChange={(ev) => setText(ev.target.value)}
						onFocus={() => setEditing(true)}
						onBlur={() => setTimeout(() => setEditing(false), 150)}
						placeholder={e.phone ? "What do you feel like?" : "What do you feel like watching?"}
						aria-label="Search by mood, plot, or title"
						className="brand-header search-private min-w-0 flex-1 bg-transparent text-[19px] text-white placeholder:text-gray-500 focus:outline-none lg:text-[21px]"
					/>
				)}
				{asked && (
					<button
						type="button"
						aria-label="Start over"
						onClick={() => {
							setText("")
							e.clearSearch()
							for (const c of filters) e.remove(c)
						}}
						className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
					>
						<XMarkIcon className="h-5 w-5" />
					</button>
				)}
				{(!showTokens || !asked) && (
					<button type="submit" disabled={busy} className={`mr-2 shrink-0 cursor-pointer rounded-full bg-amber-400 font-bold text-gray-950 hover:bg-amber-300 ${e.phone ? "px-3.5 py-2 text-sm" : "px-5 py-3"}`}>
						{busy ? "Reading…" : "Search"}
					</button>
				)}
				{showTokens && <span className="w-3" />}
			</form>
			<div className="mt-3 flex flex-col gap-3 px-1 lg:flex-row lg:items-center lg:justify-between">
				<p className="text-sm text-gray-500">
					{asked ? (
						<>
							{wants.length > 0 && <>Best fits first for {and(wants.map((w) => w.label.toLowerCase()))}. </>}
							<button type="button" onClick={e.customize} className="cursor-pointer font-semibold text-amber-400 hover:text-amber-300">
								More filters
							</button>
						</>
					) : (
						<>
							Try{" "}
							{EXAMPLES.map((x, i) => (
								<Fragment key={x}>
									{i > 0 && " · "}
									<button type="button" onClick={() => run(x)} className="cursor-pointer text-gray-300 hover:text-white">
										{x}
									</button>
								</Fragment>
							))}
						</>
					)}
				</p>
				<div className="shrink-0">{e.ready}</div>
			</div>
		</div>
	)
}
