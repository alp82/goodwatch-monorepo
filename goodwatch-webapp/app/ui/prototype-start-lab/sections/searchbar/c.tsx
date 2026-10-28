// PROTOTYPE (start page lab, round 12): search bar c · "Inline suggestions": one line, as stage j's field today, with
// the "Try" presets as ghost chips inside it, just right of the caret when it's empty (a combobox hint row). Once a
// search is on, Discover's "Read as" chips take the same place, right after the query. The button is a round amber
// icon whose magnifier turns into ↵ on hover, on focus, and while there's text not searched yet.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { useLayoutEffect, useRef, useState } from "react"
import type { StageFlow } from "../stage/ab-shared"
import { BAR_CSS, BAR_SHADOW, BarChipRow, BarInput, searchActive, useBarSearch } from "./shared"

const TEXT = "text-[22px] sm:text-[32px] lg:text-[40px]"

const CSS = `.sbc-btn .sbc-mag,.sbc-btn .sbc-ret{transition:opacity .2s ease-out,transform .25s cubic-bezier(.2,.8,.2,1)}
.sbc-btn .sbc-ret{opacity:0;transform:scale(.6) rotate(-30deg)}
.sbc-btn:hover .sbc-mag,.sbc-btn:focus-visible .sbc-mag,.sbc-btn[data-hint] .sbc-mag{opacity:0;transform:scale(.6) rotate(30deg)}
.sbc-btn:hover .sbc-ret,.sbc-btn:focus-visible .sbc-ret,.sbc-btn[data-hint] .sbc-ret{opacity:1;transform:none}`

/** Where the hint row starts: right after the query (measured in the input's own font), at most 45% in. */
function useAfterText(draft: string) {
	const box = useRef<HTMLDivElement>(null)
	const mirror = useRef<HTMLSpanElement>(null)
	const [x, setX] = useState(0)
	useLayoutEffect(() => {
		const measure = () => {
			const w = box.current?.clientWidth ?? 0
			const t = draft ? (mirror.current?.offsetWidth ?? 0) : 0
			const next = t ? Math.round(Math.min(t + 14, w * 0.45)) : 10
			setX((p) => (p === next ? p : next))
		}
		measure()
		const ro = new ResizeObserver(measure)
		if (box.current) ro.observe(box.current)
		return () => ro.disconnect()
	}, [draft])
	return { box, mirror, x }
}

export function SearchBarC({ f }: { f: StageFlow }) {
	const input = useRef<HTMLInputElement>(null)
	const s = useBarSearch(f, input)
	const [focused, setFocused] = useState(false)
	const sent = f.source.kind === "typed" || f.source.kind === "prompt" ? f.source.q : null
	const unsent = !!f.draft.trim() && f.draft.trim() !== sent
	const on = searchActive(f)
	// The hint row shows when the field is empty (presets) or a search is on and its text is the query (Read as).
	const show = on ? !(focused && unsent) : !f.draft
	const after = useAfterText(on ? (f.draft || sent || "") : "")
	return (
		<form
			role="search"
			className="sb-field pointer-events-auto relative mx-auto w-full"
			onSubmit={(e) => {
				e.preventDefault()
				s.submit()
			}}
		>
			<style>{BAR_CSS + CSS}</style>
			<span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-[22px]" style={{ boxShadow: BAR_SHADOW }} />
			<span
				aria-hidden
				className="sb-glow pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-amber-400/80 shadow-[0_0_0_6px_rgb(251_191_36/.12),0_0_70px_10px_rgb(251_191_36/.28)] sm:rounded-[22px]"
			/>
			<div className="relative flex h-[62px] items-center gap-1.5 rounded-2xl bg-gray-900 pl-4 pr-2 ring-1 ring-white/12 sm:h-[84px] sm:gap-3 sm:rounded-[22px] sm:pl-7 sm:pr-3.5 lg:h-[88px]">
				<BarInput
					f={f}
					inputRef={input}
					onChange={s.onChange}
					onClear={s.clear}
					onFocusChange={setFocused}
					text={TEXT}
					className="h-full"
					placeholder={show ? "" : "A cozy mystery, a funny show…"}
					after={
						<div ref={after.box} className="pointer-events-none absolute inset-0">
							<span ref={after.mirror} aria-hidden className={`brand-header invisible absolute left-0 top-0 whitespace-pre leading-tight ${TEXT}`}>
								{on ? (f.draft || sent || "") : ""}
							</span>
							<div
								className="absolute inset-y-0 right-0 cursor-text transition-[opacity,transform] duration-300 ease-out"
								// The row covers the input to its right: a press on its empty space still goes to the field.
								onMouseDown={(e) => {
									if ((e.target as HTMLElement).closest("button")) return
									e.preventDefault()
									input.current?.focus()
								}}
								style={{
									left: after.x,
									opacity: show ? 1 : 0,
									transform: show ? "none" : "translateX(8px)",
									pointerEvents: show ? "auto" : "none",
								}}
							>
								{/* Over a long query, the row's left edge fades the text under it out. */}
								<span aria-hidden className="absolute inset-y-0 -left-6 w-6 bg-linear-to-r from-gray-900/0 to-gray-900" />
								<BarChipRow f={f} ghost className="h-full bg-gray-900 [&>div]:pr-2" />
							</div>
						</div>
					}
				/>
				<button
					type="submit"
					aria-label="Search"
					title="Search (Enter)"
					{...(unsent ? { "data-hint": "" } : {})}
					className="sbc-btn relative grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-amber-400 text-gray-950 shadow-[0_6px_18px_-4px_rgb(251_191_36/.55),inset_0_-2px_0_rgb(0_0_0/.15)] outline-none transition-colors hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 sm:h-14 sm:w-14"
				>
					<MagnifyingGlassIcon className="sbc-mag col-start-1 row-start-1 h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
					<span aria-hidden className="sbc-ret col-start-1 row-start-1 text-[22px] font-bold leading-none sm:text-[26px]">
						↵
					</span>
				</button>
			</div>
		</form>
	)
}
