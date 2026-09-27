// PROTOTYPE - throwaway. Four takes on the mood dropdown for round 7 of Watch next (#176). Everything else
// on the page is the same in all four: round 6's `docked` strip, "On my services" on by default, the sort
// views, the hero with its Then column, and the stepped grid. A variant decides only how the picked moods
// sit in the strip and how the list of all moods opens.
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import type React from "react"
import { useRef } from "react"
import { type Ctx7, type Look, MoodArt, PanelHead, Unpick, countWords, full } from "./kit7"
import { MOOD, MOODS, type MoodKey, inkOn } from "./moods"

const optionProps = (c: Ctx7, m: MoodKey) => ({
	type: "button" as const,
	role: "checkbox" as const,
	"aria-checked": c.sel.moods.includes(m),
	"aria-disabled": full(c, m) || undefined,
	"aria-label": `${MOOD[m].name}. ${MOOD[m].line} ${countWords(c, m)}.`,
	"data-mood": m,
	onClick: () => c.tap(m),
})

// The panel's frame: the head stays put and the options scroll under it when space runs out.
function Frame({ c, children, head, className = "" }: { c: Ctx7; children: React.ReactNode; head?: string; className?: string }) {
	return (
		<div className="flex max-h-[inherit] flex-col">
			<PanelHead c={c} title={head} className="shrink-0 border-b border-white/8 px-3 py-2" />
			<div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${className}`}>{children}</div>
		</div>
	)
}

function Tick({ on, className = "" }: { on: boolean; className?: string }) {
	return (
		<span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-white text-black" : "bg-black/30 ring-1 ring-white/50"} ${className}`}>
			{on && <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

// ============================================================ 1. Poster grid

// Picked moods as small poster chips in the strip; the dropdown is a grid of bigger ones.
function GridPicked({ c, pinned }: { c: Ctx7; pinned: boolean }) {
	return (
		<>
			{c.sel.moods.map((m) => (
				<motion.button
					layout
					key={m}
					type="button"
					data-moodbutton
					onClick={() => c.setOpen(!c.open)}
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					className={`relative isolate inline-flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden rounded-xl pl-2.5 pr-1.5 text-sm font-bold text-white ring-1 ring-white/25 [text-shadow:0_1px_4px_rgba(0,0,0,.6)] ${pinned ? "h-8" : "h-9"}`}
					style={{ boxShadow: `0 4px 18px -6px ${MOOD[m].hue}` }}
				>
					<MoodArt m={m} art={c.per[m].art} />
					<span className="whitespace-nowrap">{MOOD[m].name}</span>
					<span className="rounded-md bg-black/30 px-1 text-xs tabular-nums">{c.per[m].n}</span>
					<Unpick c={c} m={m} />
				</motion.button>
			))}
		</>
	)
}
function GridPanel({ c }: { c: Ctx7; pinned: boolean }) {
	return (
		<Frame c={c} className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
			{MOODS.map(({ key: m, name, line }) => {
				const on = c.sel.moods.includes(m)
				const off = full(c, m)
				return (
					<motion.button
						key={m}
						{...optionProps(c, m)}
						whileTap={{ scale: off ? 1 : 0.97 }}
						className={`group relative isolate flex h-[6.5rem] cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] md:h-28 ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${off ? "opacity-40" : ""}`}
						style={{ boxShadow: on ? `0 8px 28px -8px ${MOOD[m].hue}` : undefined }}
					>
						<MoodArt m={m} art={c.per[m].art} className="transition-transform duration-500 group-hover:scale-105" />
						<span className="flex items-start justify-between gap-2">
							<span className="text-[15px] font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">{name}</span>
							<Tick on={on} />
						</span>
						<span className="block">
							<span className="line-clamp-2 text-xs leading-snug text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">{line}</span>
							<span className="mt-1 block text-[11px] font-semibold tabular-nums text-white/75">{countWords(c, m)}</span>
						</span>
					</motion.button>
				)
			})}
		</Frame>
	)
}
export const grid: Look = { name: "Poster grid panel", mode: "wide", Picked: GridPicked, Panel: GridPanel }

// ============================================================ 2. List with backdrops

// Picked moods as quiet tinted pills; the dropdown is a narrow list, one mood a row with its picture.
function ListPicked({ c, pinned }: { c: Ctx7; pinned: boolean }) {
	return (
		<>
			{c.sel.moods.map((m) => (
				<motion.button
					layout
					key={m}
					type="button"
					data-moodbutton
					onClick={() => c.setOpen(!c.open)}
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full pl-2.5 pr-1 text-sm font-semibold text-white ${pinned ? "h-8" : "h-9"}`}
					style={{ background: `${MOOD[m].hue}2e`, boxShadow: `inset 0 0 0 1px ${MOOD[m].hue}99` }}
				>
					<span className="h-2.5 w-2.5 rounded-full" style={{ background: MOOD[m].hue }} />
					{MOOD[m].name}
					<Unpick c={c} m={m} />
				</motion.button>
			))}
		</>
	)
}
function ListPanel({ c }: { c: Ctx7; pinned: boolean }) {
	return (
		<Frame c={c} head="Up to three" className="p-1.5">
			<ul>
				{MOODS.map(({ key: m, name, line }) => {
					const on = c.sel.moods.includes(m)
					const off = full(c, m)
					return (
						<li key={m}>
							<button {...optionProps(c, m)} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl p-1.5 pr-2.5 text-left transition-colors ${on ? "bg-white/10" : "hover:bg-white/5"} ${off ? "opacity-40" : ""}`}>
								<span className="relative isolate h-12 w-20 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
									<MoodArt m={m} art={c.per[m].art} wash="full" size="w300" />
								</span>
								<span className="min-w-0 flex-1">
									<span className="flex items-center gap-2 text-sm font-bold text-white">
										<span className="h-2 w-2 shrink-0 rounded-full" style={{ background: MOOD[m].hue }} />
										{name}
									</span>
									<span className="block truncate text-xs text-gray-400">{line}</span>
								</span>
								<span className={`shrink-0 text-sm tabular-nums ${c.per[m].n ? "text-gray-300" : "text-gray-600"}`} title={countWords(c, m)}>
									{c.per[m].n}
								</span>
								<Tick on={on} />
							</button>
						</li>
					)
				})}
			</ul>
		</Frame>
	)
}
export const list: Look = { name: "List with backdrops", mode: "anchor", width: "27", Picked: ListPicked, Panel: ListPanel }

// ============================================================ 3. Carousel

// Picked moods as a stack of round pictures with their names; the dropdown is a wide band of big cards.
function StackPicked({ c, pinned }: { c: Ctx7; pinned: boolean }) {
	const ms = c.sel.moods
	return (
		<motion.button
			layout
			type="button"
			data-moodbutton
			onClick={() => c.setOpen(!c.open)}
			className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white/10 pl-1 pr-1.5 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15 ${pinned ? "h-8" : "h-9"}`}
		>
			<span className="flex -space-x-2">
				{ms.map((m) => (
					<span key={m} className={`relative isolate overflow-hidden rounded-full ${pinned ? "h-6 w-6" : "h-7 w-7"}`} style={{ boxShadow: `0 0 0 2px ${MOOD[m].hue}` }}>
						<MoodArt m={m} art={c.per[m].art} wash="full" size="w300" />
					</span>
				))}
			</span>
			{/* A phone has room for the pictures, not all three names. */}
			<span className="whitespace-nowrap sm:hidden">{ms.length === 1 ? MOOD[ms[0]].name : `${ms.length} moods`}</span>
			<span className="hidden whitespace-nowrap sm:inline">{ms.map((m) => MOOD[m].name).join(", ")}</span>
			<span
				role="button"
				tabIndex={0}
				aria-label="Clear moods"
				onClick={(e) => (e.stopPropagation(), c.setSel({ ...c.sel, moods: [] }))}
				onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), e.stopPropagation(), c.setSel({ ...c.sel, moods: [] }))}
				className="flex h-5 w-5 items-center justify-center rounded-full bg-black/30 hover:bg-black/60"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</span>
		</motion.button>
	)
}
function CarouselPanel({ c }: { c: Ctx7; pinned: boolean }) {
	const row = useRef<HTMLDivElement>(null)
	const by = (d: number) => row.current?.scrollBy({ left: d * row.current.clientWidth * 0.8, behavior: "smooth" })
	return (
		<div className="flex max-h-[inherit] flex-col">
			<PanelHead c={c} className="shrink-0 px-3 py-2" />
			<div className="relative min-h-0">
				<div ref={row} className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-3 pb-3 pt-1 [scrollbar-width:none]">
					{MOODS.map(({ key: m, name, line }) => {
						const on = c.sel.moods.includes(m)
						const off = full(c, m)
						return (
							<button key={m} {...optionProps(c, m)} className={`w-44 shrink-0 cursor-pointer snap-start text-left md:w-56 ${off ? "opacity-40" : ""}`}>
								<span className={`relative isolate flex aspect-[16/10] items-end overflow-hidden rounded-xl p-2.5 ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"}`} style={{ boxShadow: on ? `0 10px 30px -10px ${MOOD[m].hue}` : undefined }}>
									<MoodArt m={m} art={c.per[m].art} wash="bottom" size="w780" />
									<Tick on={on} className="absolute right-2 top-2" />
									<span className="text-lg font-bold leading-tight text-white [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">{name}</span>
								</span>
								<span className="mt-1.5 block text-xs leading-snug text-gray-300">{line}</span>
								<span className="mt-0.5 block text-xs tabular-nums text-gray-500">{countWords(c, m)}</span>
							</button>
						)
					})}
				</div>
				<button type="button" aria-label="Earlier moods" onClick={() => by(-1)} className="absolute left-1 top-[38%] hidden h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20 hover:bg-black md:flex">
					<ChevronLeftIcon className="h-5 w-5" />
				</button>
				<button type="button" aria-label="More moods" onClick={() => by(1)} className="absolute right-1 top-[38%] hidden h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20 hover:bg-black md:flex">
					<ChevronRightIcon className="h-5 w-5" />
				</button>
			</div>
		</div>
	)
}
export const carousel: Look = { name: "Carousel band", mode: "wide", Picked: StackPicked, Panel: CarouselPanel }

// ============================================================ 4. Bottom sheet

// Picked moods as solid colour chips with their counts; the dropdown rises from the bottom, for the thumb.
function SolidPicked({ c, pinned }: { c: Ctx7; pinned: boolean }) {
	return (
		<>
			{c.sel.moods.map((m) => {
				const ink = inkOn(MOOD[m].hue)
				return (
					<motion.button
						layout
						key={m}
						type="button"
						data-moodbutton
						onClick={() => c.setOpen(!c.open)}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full pl-3 pr-1 text-sm font-bold ${pinned ? "h-8" : "h-9"}`}
						style={{ background: MOOD[m].hue, color: ink }}
					>
						{MOOD[m].name}
						<span className="text-xs font-semibold tabular-nums opacity-70">{c.per[m].n}</span>
						<Unpick c={c} m={m} ink={ink} />
					</motion.button>
				)
			})}
		</>
	)
}
function SheetPanel({ c }: { c: Ctx7; pinned: boolean }) {
	return (
		<div className="flex max-h-[86vh] flex-col">
			<div className="flex shrink-0 justify-center pt-2.5" aria-hidden>
				<span className="h-1.5 w-10 rounded-full bg-white/25" />
			</div>
			<PanelHead c={c} className="shrink-0 px-4 pb-2 pt-1.5" />
			<div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto overscroll-contain px-4 pb-6 sm:grid-cols-2 md:grid-cols-3">
				{MOODS.map(({ key: m, name, line }) => {
					const on = c.sel.moods.includes(m)
					const off = full(c, m)
					return (
						<motion.button key={m} {...optionProps(c, m)} whileTap={{ scale: off ? 1 : 0.98 }} className={`flex cursor-pointer items-center gap-3 rounded-2xl p-2 text-left transition-colors ${off ? "opacity-40" : ""}`} style={{ background: on ? `${MOOD[m].hue}33` : "rgba(255,255,255,.05)", boxShadow: on ? `inset 0 0 0 2px ${MOOD[m].hue}` : "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
							<span className="relative isolate h-14 w-14 shrink-0 overflow-hidden rounded-xl">
								<MoodArt m={m} art={c.per[m].art} wash="full" size="w300" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-[15px] font-bold text-white">{name}</span>
								<span className="block text-xs leading-snug text-gray-400">{line}</span>
								<span className="block text-xs tabular-nums text-gray-500">{countWords(c, m)}</span>
							</span>
							<Tick on={on} />
						</motion.button>
					)
				})}
			</div>
		</div>
	)
}
export const sheet: Look = { name: "Bottom sheet", mode: "sheet", Picked: SolidPicked, Panel: SheetPanel }
