// PROTOTYPE (start page lab, round 4): stage h · "Popover + card": stage e with pill prompts, one mood row whose
// More moods opens a popover under it (grouped grid, filter box), and the tray as a framed card with an amber top band
// holding its title and the step line; the posters themselves are the "loved it" toggles.
import { CheckIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useCallback, useEffect, useRef, useState } from "react"
import type { BlockVariant } from "../../lab/types"
import { inertProps, type StageFlow } from "./ab-shared"
import { FilterBox, SearchInstead, useDismiss, useFocusOnOpen, VocabChip } from "./hi-picker"
import { HiStage, HiTop, STEPS, stepOf, trayTitle, useBringIntoView } from "./hi-shared"
import { TrayLayers } from "./hi-tray"
import { GROUP_NAMES, groupsOf, VOCAB } from "./hi-vocab"

function MorePopover({ f, open, onClose }: { f: StageFlow; open: boolean; onClose: () => void }) {
	const panel = useRef<HTMLDivElement>(null)
	const input = useRef<HTMLInputElement>(null)
	const [q, setQ] = useState("")
	useDismiss(open, onClose, panel)
	useFocusOnOpen(open, input)
	// Opened low on the screen: bring the whole panel into view (above the lab bar).
	useEffect(() => {
		if (!open) return
		const t = setTimeout(() => {
			const r = panel.current?.getBoundingClientRect()
			const room = window.innerHeight - 76
			if (r && r.bottom > room) window.scrollBy({ top: Math.min(r.top - 72, r.bottom - room), behavior: "smooth" })
		}, 30)
		return () => clearTimeout(t)
	}, [open])
	const groups = groupsOf(q)
	return (
		<div
			ref={panel}
			role="dialog"
			aria-label="More moods"
			{...inertProps(!open)}
			className="absolute inset-x-0 top-full z-40 mx-auto mt-1 w-full max-w-[980px] origin-top rounded-2xl bg-gray-900 shadow-[0_30px_80px_rgb(0_0_0/.75),0_8px_24px_rgb(0_0_0/.5)] ring-1 ring-white/15 transition-[opacity,transform] duration-200 ease-out"
			style={{ opacity: open ? 1 : 0, transform: open ? "none" : "translateY(-8px) scale(.985)", pointerEvents: open ? "auto" : "none" }}
		>
			<div className="flex items-center gap-3 border-b border-white/10 px-3 pt-3 pb-3 sm:px-5">
				<h2 className="shrink-0 text-base font-extrabold text-white">More moods</h2>
				<FilterBox value={q} onChange={setQ} inputRef={input} count={VOCAB.length} className="min-w-0 flex-1 sm:max-w-[360px]" />
				<button type="button" onClick={onClose} aria-label="Close" className="ml-auto flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-300 hover:bg-white/10 hover:text-white">
					<XMarkIcon className="h-5 w-5" aria-hidden />
				</button>
			</div>
			<div className="max-h-[min(52svh,420px)] overflow-y-auto overscroll-contain px-3 pt-3 pb-4 sm:max-h-[min(46vh,400px)] sm:px-5">
				{groups.length ? (
					groups.map((g) => (
						<section key={g.group} className="mb-4 last:mb-0">
							<h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
								{GROUP_NAMES[g.group]} <span className="font-semibold text-gray-500">· {g.items.length}</span>
							</h3>
							<ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
								{g.items.map((item) => (
									<li key={item.id} className="min-w-0">
										<VocabChip f={f} item={item} onPicked={onClose} />
									</li>
								))}
							</ul>
						</section>
					))
				) : (
					<SearchInstead f={f} q={q.trim()} onPicked={onClose} />
				)}
			</div>
		</div>
	)
}

/** "1 Pick a mood or search · 2 Tap three you loved · 3 Your picks", the current step bright, done ones checked. */
function StepLine({ f, className = "" }: { f: StageFlow; className?: string }) {
	const now = stepOf(f)
	return (
		<ol className={`flex min-w-0 items-center gap-1.5 text-[11px] font-semibold sm:gap-2 sm:text-[13px] ${className}`} aria-label="Steps">
			{STEPS.map((s, i) => {
				const n = i + 1
				const done = n < now
				const on = n === now
				return (
					<li key={s.long} className="flex min-w-0 items-center gap-1.5 sm:gap-2" aria-current={on ? "step" : undefined}>
						{i > 0 ? <span aria-hidden className="text-gray-500">·</span> : null}
						<span
							className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold transition-colors sm:h-5 sm:w-5 sm:text-[11px] ${on ? "bg-amber-400 text-gray-950" : done ? "bg-amber-400/25 text-amber-300" : "bg-white/10 text-gray-400"}`}
						>
							{done ? <CheckIcon className="h-3 w-3" aria-hidden /> : n}
						</span>
						<span className={`whitespace-nowrap transition-colors ${on ? "text-white" : done ? "text-amber-200/80" : "text-gray-400"}`}>
							<span className="sm:hidden">{s.short}</span>
							<span className="hidden sm:inline">{s.long}</span>
						</span>
					</li>
				)
			})}
		</ol>
	)
}

function CardTray({ f }: { f: StageFlow }) {
	const box = useBringIntoView(f)
	const title = trayTitle(f)
	return (
		<div
			ref={box}
			className="pointer-events-auto relative h-[290px] shrink-0 overflow-hidden rounded-2xl bg-gray-950 shadow-[0_30px_80px_rgb(0_0_0/.7),0_0_0_1px_rgb(0_0_0/.7)] ring-1 ring-amber-400/35 sm:h-[364px]"
		>
			{/* The band: an amber edge on top, a warm wash fading right. */}
			<div className="relative flex h-[60px] flex-col justify-center gap-1 border-b border-amber-400/25 bg-gradient-to-r from-amber-400/[.22] via-amber-400/[.09] to-amber-400/[.04] px-3 sm:h-[60px] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
				<span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-amber-400" />
				<StepLine f={f} className="sm:order-2" />
				<h2 key={title.text} className="ab-in flex min-w-0 items-center gap-2 text-[17px] font-extrabold leading-6 tracking-tight text-white sm:text-xl">
					{title.dot ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: title.dot }} /> : null}
					<span className="truncate">{title.text}</span>
				</h2>
			</div>
			<div className="absolute inset-x-0 top-[60px] bottom-0">
				<TrayLayers f={f} col="w-[96px] sm:w-[132px]" pad="px-3 sm:px-5" bleed="-mx-3 sm:-mx-5" />
			</div>
		</div>
	)
}

function PopoverCardStage() {
	const [more, setMore] = useState(false)
	const close = useCallback(() => setMore(false), [])
	return (
		<HiStage
			k="h"
			top={(f) => <HiTop f={f} onMore={() => setMore((o) => !o)} moreOpen={more} moreSlot={<MorePopover f={f} open={more} onClose={close} />} />}
			tray={(f) => <CardTray f={f} />}
		/>
	)
}

export const variant: BlockVariant = { key: "h", name: "Popover + card", C: PopoverCardStage }
