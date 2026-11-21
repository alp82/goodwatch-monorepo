// PROTOTYPE - throwaway (prototype/explore-r9). Trope examples, variant "Side by side": every example as one line in a
// list (poster, title, year, a twist mark), the picked one opened beside it: wide still, title, twist, the whole
// write-up. Arrow keys or Prev / Next walk the list. On a phone the open case sits on top and the list is a strip of
// posters under it.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { type CSSProperties, type KeyboardEvent, useRef, useState } from "react"
import { StepButton } from "~/ui/row-arrows"
import { FOCUS, poster } from "../../../../kit/ui"
import { GLIDE_T, QUICK_T } from "../../../../kit/ui/motion"
import type { SlotVariant } from "../../contract"
import type { BodyProps } from "../trope/body"
import { PageFade, TitleLine, WriteUp } from "../trope/pieces"
import { TwistTag } from "../tropes/parts"

function Split({ d, cases, noun, tools }: BodyProps) {
	const [at, setAt] = useState(0)
	const list = useRef<HTMLOListElement>(null)
	const tint = d.trope.color
	const e = cases[at]
	const go = (i: number) => {
		const next = Math.min(cases.length - 1, Math.max(0, i))
		setAt(next)
		list.current
			?.querySelector<HTMLElement>(`[data-case="${next}"]`)
			?.scrollIntoView({ block: "nearest", inline: "nearest" })
	}
	const onKey = (ev: KeyboardEvent) => {
		if (ev.key === "ArrowDown" || ev.key === "ArrowRight") {
			ev.preventDefault()
			go(at + 1)
			list.current?.querySelector<HTMLElement>(`[data-case="${at + 1}"]`)?.focus()
		}
		if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") {
			ev.preventDefault()
			go(at - 1)
			list.current?.querySelector<HTMLElement>(`[data-case="${at - 1}"]`)?.focus()
		}
	}
	if (!e) return null
	const c = e.title.card
	const src = c.backdrop_path ? poster(c.backdrop_path, "w780") : poster(c.poster_path, "w342")
	return (
		<div style={{ "--tint": tint } as CSSProperties}>
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="font-display text-2xl font-bold text-white">Every example</h2>
					<p className="mt-1 text-[15px] text-gray-400">
						{cases.length} {noun}. Pick one to read it.
					</p>
				</div>
				{tools}
			</div>
			<div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-7">
				<ol
					ref={list}
					aria-label="Examples"
					className="relative order-2 -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:order-1 lg:mx-0 lg:block lg:max-h-[34rem] lg:space-y-0.5 lg:overflow-y-auto lg:px-0 lg:pr-1 lg:[scrollbar-width:thin]"
				>
					{cases.map((x, i) => {
						const on = i === at
						const p = poster(x.title.card.poster_path, "w92")
						return (
							<li key={x.title.card.key} className="shrink-0 snap-start">
								<button
									type="button"
									data-case={i}
									aria-pressed={on}
									onClick={() => go(i)}
									onKeyDown={onKey}
									className={`flex items-center gap-2.5 rounded-lg p-1.5 text-left lg:w-full ${QUICK_T} ${on ? "bg-[color-mix(in_oklab,var(--tint)_16%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--tint)_45%,transparent)]" : "hover:bg-white/[0.05]"} ${FOCUS}`}
								>
									<span className="block h-[54px] w-9 shrink-0 overflow-hidden rounded bg-gray-800 ring-1 ring-white/10 max-lg:h-24 max-lg:w-16">
										{p && (
											<img src={p} alt="" loading="lazy" className="h-full w-full object-cover" />
										)}
									</span>
									<span className="min-w-0 max-lg:hidden">
										<span
											className={`block truncate text-[14px] font-semibold ${on ? "text-white" : "text-gray-200"}`}
										>
											{x.title.card.title}
										</span>
										<span className="flex items-center gap-1.5 text-[12px] text-gray-500 tabular-nums">
											{x.title.card.release_year}
											{x.play !== "straight" && (
												<span className="text-amber-200/90">· with a twist</span>
											)}
										</span>
									</span>
									<span className="sr-only lg:hidden">{x.title.card.title}</span>
								</button>
							</li>
						)
					})}
				</ol>
				<div className="order-1 min-w-0 lg:order-2">
					<PageFade k={at}>
						<article className="overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
							<div className="relative aspect-[21/9] bg-gray-800">
								{src && (
									<img src={src} alt="" className={`h-full w-full object-cover ${GLIDE_T}`} />
								)}
								<span
									aria-hidden
									className="absolute top-3 left-3 rounded-md bg-black/60 px-2 py-0.5 font-display text-sm font-bold text-white tabular-nums backdrop-blur-sm"
								>
									{String(at + 1).padStart(2, "0")}
								</span>
							</div>
							<div className="p-5 sm:p-6">
								<TitleLine e={e} big />
								<TwistTag example={e} className="mt-2" />
								<blockquote className="mt-3 border-l-2 border-[color-mix(in_oklab,var(--tint)_55%,transparent)] pl-4">
									<WriteUp
										e={e}
										tint={tint}
										className="text-[16px] leading-relaxed text-gray-200"
									/>
								</blockquote>
							</div>
						</article>
					</PageFade>
					<div className="mt-3 flex items-center justify-end gap-3">
						<span className="text-sm text-gray-400 tabular-nums">
							{at + 1} of {cases.length}
						</span>
						<StepButton label="Previous example" disabled={at === 0} onClick={() => go(at - 1)}>
							<ChevronLeftIcon className="h-5 w-5" />
						</StepButton>
						<StepButton
							label="Next example"
							disabled={at >= cases.length - 1}
							onClick={() => go(at + 1)}
						>
							<ChevronRightIcon className="h-5 w-5" />
						</StepButton>
					</div>
				</div>
			</div>
		</div>
	)
}

export const variant: SlotVariant<never, BodyProps> = {
	id: "split",
	name: "Side by side",
	what: "Every example as one line in a list, the picked one opened beside it with its still and whole write-up. Arrow keys or Prev and Next walk the list; on a phone the list is a poster strip.",
	order: 3,
	View: Split,
}
