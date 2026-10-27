// PROTOTYPE (start page lab, round 4): stage i · "Sheet + band": stage e with pill prompts, one mood row whose More
// moods slides up a full-width sheet (search on top, recent and popular first, then every group), and the tray as a
// band across the whole stage with a soft amber glow behind it, three numbered step dots and bigger posters that are
// themselves the "loved it" toggles.
import { CheckIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { BlockVariant } from "../../lab/types"
import { inertProps, type StageFlow } from "./ab-shared"
import { FilterBox, SearchInstead, useDismiss, useFocusOnOpen, VocabChip } from "./hi-picker"
import { HiStage, HiTop, STEPS, stepOf, trayTitle, useBringIntoView } from "./hi-shared"
import { TrayLayers } from "./hi-tray"
import { GROUP_NAMES, groupsOf, POPULAR_IDS, readRecent, VOCAB, VOCAB_BY_ID, type VocabItem } from "./hi-vocab"

const ids = (list: string[]) => list.flatMap((id) => VOCAB_BY_ID.get(id) ?? [])

function ChipGrid({ f, items, onPicked }: { f: StageFlow; items: VocabItem[]; onPicked: () => void }) {
	return (
		<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-5">
			{items.map((item) => (
				<li key={item.id} className="min-w-0">
					<VocabChip f={f} item={item} onPicked={onPicked} big />
				</li>
			))}
		</ul>
	)
}

function Group({ title, n, children }: { title: string; n?: number; children: React.ReactNode }) {
	return (
		<section className="mb-6 last:mb-0">
			<h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-gray-400">
				{title}
				{n ? <span className="font-semibold text-gray-500"> · {n}</span> : null}
			</h3>
			{children}
		</section>
	)
}

function MoreSheet({ f, open, onClose }: { f: StageFlow; open: boolean; onClose: () => void }) {
	const panel = useRef<HTMLDivElement>(null)
	const input = useRef<HTMLInputElement>(null)
	const [q, setQ] = useState("")
	const [recent, setRecent] = useState<string[]>([])
	useDismiss(open, onClose, panel)
	useFocusOnOpen(open, input)
	useEffect(() => {
		if (!open) return
		setRecent(readRecent())
		const prev = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = prev
		}
	}, [open])
	// Portaled to the body, so no later section's stacking can cover it.
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const groups = groupsOf(q)
	const filtering = q.trim().length > 0
	if (!mounted) return null
	return createPortal(
		<>
			<div
				aria-hidden
				className="fixed inset-0 z-[70] bg-black/65 transition-opacity duration-300"
				style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
			/>
			<div
				ref={panel}
				role="dialog"
				aria-modal="true"
				aria-label="More moods"
				{...inertProps(!open)}
				className="fixed inset-x-0 bottom-0 z-[71] flex h-[min(88svh,820px)] flex-col rounded-t-3xl bg-gray-900 shadow-[0_-30px_80px_rgb(0_0_0/.7)] ring-1 ring-white/12 transition-transform duration-[320ms] ease-[cubic-bezier(.2,.8,.2,1)]"
				style={{ transform: open ? "none" : "translateY(104%)" }}
			>
				<div className="mx-auto w-full max-w-[1120px] shrink-0 px-4 pt-2.5 sm:px-8">
					<span aria-hidden className="mx-auto block h-1.5 w-12 rounded-full bg-white/20" />
					<div className="mt-3 flex items-center gap-3">
						<h2 className="text-lg font-extrabold text-white sm:text-2xl">More moods</h2>
						<span className="hidden text-sm text-gray-400 sm:inline">{VOCAB.length} moods, themes, styles and genres</span>
						<button type="button" onClick={onClose} aria-label="Close" className="ml-auto flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/[.06] text-gray-200 hover:bg-white/10 hover:text-white">
							<XMarkIcon className="h-5 w-5" aria-hidden />
						</button>
					</div>
					<FilterBox value={q} onChange={setQ} inputRef={input} count={VOCAB.length} className="mt-3 !h-12 !rounded-2xl" />
				</div>
				<div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-white/10">
					{/* Bottom room for the lab bar. */}
					<div className="mx-auto w-full max-w-[1120px] px-4 pt-4 pb-24 sm:px-8">
						{filtering ? null : (
							<>
								{recent.length ? (
									<Group title="Recent">
										<ChipGrid f={f} items={ids(recent)} onPicked={onClose} />
									</Group>
								) : null}
								<Group title="Popular">
									<ChipGrid f={f} items={ids(POPULAR_IDS)} onPicked={onClose} />
								</Group>
							</>
						)}
						{groups.length ? (
							groups.map((g) => (
								<Group key={g.group} title={GROUP_NAMES[g.group]} n={g.items.length}>
									<ChipGrid f={f} items={g.items} onPicked={onClose} />
								</Group>
							))
						) : (
							<SearchInstead f={f} q={q.trim()} onPicked={onClose} />
						)}
					</div>
				</div>
			</div>
		</>,
		document.body,
	)
}

/** Three numbered dots joined by lines that fill amber as the guest moves on (scaleX only). */
function StepDots({ f, className = "" }: { f: StageFlow; className?: string }) {
	const now = stepOf(f)
	return (
		<ol className={`flex items-center ${className}`} aria-label="Steps">
			{STEPS.map((s, i) => {
				const n = i + 1
				const done = n < now
				const on = n === now
				return (
					<li key={s.long} className="flex items-center" aria-current={on ? "step" : undefined}>
						{i > 0 ? (
							<span aria-hidden className="relative mx-1 block h-[2px] w-3 overflow-hidden rounded-full bg-white/15 sm:mx-2.5 sm:w-10">
								<span
									className="absolute inset-0 origin-left bg-amber-400 transition-transform duration-500 ease-out"
									style={{ transform: n <= now ? "none" : "scaleX(0)" }}
								/>
							</span>
						) : null}
						<span
							className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold transition-colors sm:h-7 sm:w-7 sm:text-[13px] ${on ? "bg-amber-400 text-gray-950 shadow-[0_0_0_4px_rgb(251_191_36/.2)]" : done ? "bg-amber-400/25 text-amber-300" : "bg-white/10 text-gray-400 ring-1 ring-white/15"}`}
						>
							{done ? <CheckIcon className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden /> : n}
						</span>
						<span className={`ml-1.5 whitespace-nowrap text-[11px] font-semibold transition-colors sm:ml-2 sm:text-sm ${on ? "text-white" : done ? "text-amber-200/80" : "text-gray-400"}`}>
							<span className="sm:hidden">{s.short}</span>
							<span className="hidden sm:inline">{s.long}</span>
						</span>
					</li>
				)
			})}
		</ol>
	)
}

function BandTray({ f }: { f: StageFlow }) {
	const box = useBringIntoView(f)
	const title = trayTitle(f)
	return (
		// Spans the stage's whole width (50cqw: half the stage, which is an inline-size container).
		<div ref={box} className="pointer-events-auto relative isolate mx-[calc(50%-50cqw)] shrink-0">
			{/* The soft amber glow behind the band, static. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 -top-24 -bottom-10 -z-10"
				style={{
					background:
						"radial-gradient(ellipse 60% 55% at 50% 50%, rgb(251 191 36 / .2), rgb(251 191 36 / .07) 55%, rgb(251 191 36 / 0) 80%)",
				}}
			/>
			<div aria-hidden className="absolute inset-0 border-y border-amber-400/35 bg-gray-950/[.93] shadow-[0_-20px_60px_rgb(0_0_0/.5)]" />
			<div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
			<div className="relative mx-auto h-[318px] w-full max-w-[1360px] px-4 sm:h-[400px] sm:px-6 lg:h-[392px] xl:h-[404px]">
				<div className="flex h-[64px] flex-col justify-center gap-1.5 sm:h-[68px] sm:flex-row sm:items-center sm:justify-between sm:gap-6">
					<StepDots f={f} className="sm:order-2" />
					<h2 key={title.text} className="ab-in flex min-w-0 items-center gap-2 text-lg font-extrabold leading-6 tracking-tight text-white sm:text-2xl">
						{title.dot ? <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: title.dot }} /> : null}
						<span className="truncate">{title.text}</span>
					</h2>
				</div>
				<div className="absolute inset-x-0 top-[64px] bottom-0 sm:top-[68px]">
					<TrayLayers f={f} col="w-[112px] sm:w-[150px] xl:w-[160px]" pad="px-4 sm:px-6" bleed="-mx-4 sm:-mx-6" />
				</div>
			</div>
		</div>
	)
}

function SheetBandStage() {
	const [more, setMore] = useState(false)
	const close = useCallback(() => setMore(false), [])
	return (
		<HiStage
			k="i"
			top={(f) => <HiTop f={f} onMore={() => setMore((o) => !o)} moreOpen={more} />}
			tray={(f) => <BandTray f={f} />}
			overlays={(f) => <MoreSheet f={f} open={more} onClose={close} />}
		/>
	)
}

export const variant: BlockVariant = { key: "i", name: "Sheet + band", C: SheetBandStage }
