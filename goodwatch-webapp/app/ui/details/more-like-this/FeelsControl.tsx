// The Feels the same shelf's control: which feelings the shelf matches. The title's rare mixes (pairs or threes of its
// effects that few popular titles share) are the presets; the shelf starts on the rarest, and its heading says the
// pick in the effects' colors ("Also takes you somewhere else and draws you into power games"). Under the heading, the
// mini print lit by the pick sits beside "Rare mix 1 of 7 · Only 1 in 70 movies do both" with previous and next (or
// a swipe on touch). The print opens the Tuner: the print to tap (a section adds its strongest feeling), the rare
// mixes, and the effect lines to make one's own pick, up to three. The same control travels with the shelf into the
// expanded view. Motion: opacity and transform only, none with reduced motion.
// transform only.
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline"
import {
	type CSSProperties,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import type { EffectReading } from "~/domain/fingerprint-effects/effects"
import { Print } from "~/ui/details/fingerprint-section/Print"
import {
	type Reading,
	effectColor,
	phraseOf,
	shortName,
} from "~/ui/details/fingerprint-section/reading"
import {
	lightOf,
	nextSelection,
} from "~/ui/details/fingerprint-section/selection"
import { type Recipe, type Sources, fmt } from "./sources"

/** The one RidgeSprite the control's prints draw from (MoreLikeThis.tsx renders it). */
export const FEELS_RIDGES = "feels-ridges"

const DISPLAY = '"Gabarito", ui-sans-serif, system-ui, sans-serif'
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const noun = (src: Sources) => src.noun

const CSS = /* css */ `
@keyframes feels-pop { from { opacity: 0; transform: translateY(-4px) scale(.98); } }
@keyframes feels-sheet { from { transform: translateY(100%); } }
@keyframes feels-fade { from { opacity: 0; } }
@keyframes feels-next { from { opacity: 0; transform: translateX(10px); } }
@keyframes feels-prev { from { opacity: 0; transform: translateX(-10px); } }
.feels-pop { animation: feels-pop 160ms cubic-bezier(.2,.8,.2,1) both; transform-origin: top right; }
.feels-sheet { animation: feels-sheet 260ms cubic-bezier(.2,.8,.2,1) both; }
.feels-fade { animation: feels-fade 200ms ease both; }
.feels-next { animation: feels-next 220ms cubic-bezier(.2,.8,.2,1) both; }
.feels-prev { animation: feels-prev 220ms cubic-bezier(.2,.8,.2,1) both; }
.feels-lit { transition: opacity .18s ease, color .18s ease; }
@media (prefers-reduced-motion: reduce) { .feels-pop, .feels-sheet, .feels-fade, .feels-next, .feels-prev { animation: none; } }
`

/** The picked effects in running text, each in its color: "takes you somewhere else and draws you into power games". */
function ColorWords({ rs }: { rs: EffectReading[] }) {
	return (
		<>
			{rs.map((r, i) => (
				<span key={r.effect.id}>
					{i > 0 && (i === rs.length - 1 ? " and " : ", ")}
					<span className="feels-lit" style={{ color: effectColor(r) }}>
						{lowerFirst(r.effect.name)}
					</span>
				</span>
			))}
		</>
	)
}

/** The shelf's heading: the picked feelings in their colors. */
export function feelsTitle(src: Sources): ReactNode {
	const m = src.mix
	return m.effects.length ? (
		<>
			Also <ColorWords rs={m.effects} />
		</>
	) : (
		"Pick what it should feel like"
	)
}

/** The muted line under the heading: what the control doesn't already say (nothing while a rare mix is picked). */
export function feelsNote(src: Sources): ReactNode {
	const m = src.mix
	return m.recipeAt >= 0 ? undefined : m.note
}

/** What sits under the heading: the mini print and the rare mix stepper. */
export function feelsControls(src: Sources): ReactNode {
	return <PrintStepper src={src} />
}

// --- shared pieces -------------------------------------------------------------------------------------------------

/** "Somewhere else + Power games", each in its color. */
function RecipeName({
	r,
	className = "",
	style,
}: { r: Recipe; className?: string; style?: CSSProperties }) {
	return (
		<span className={className} style={style}>
			{r.effects.map((e, i) => (
				<span key={e.effect.id}>
					{i > 0 && <span className="text-gray-500"> + </span>}
					<span style={{ color: effectColor(e) }}>{shortName(e)}</span>
				</span>
			))}
		</span>
	)
}

function Dots({ rs }: { rs: EffectReading[] }) {
	return (
		<span aria-hidden="true" className="flex shrink-0 -space-x-1">
			{rs.map((e) => (
				<span
					key={e.effect.id}
					className="h-2.5 w-2.5 rounded-full ring-2 ring-[#0c0a09]"
					style={{ background: effectColor(e) }}
				/>
			))}
		</span>
	)
}

/**
 * The print lit by the pick: only the picked feelings' ridges, in their family colors (the heading's colors), without
 * the ingredient names (too small for them) or the axis fans (an axis's color is its lead's, not always the pick's).
 */
function MiniPrint({
	src,
	selected,
	onAxis,
	className = "",
	labels = "none",
}: {
	src: Sources
	selected: readonly string[]
	onAxis?: (axis: string) => void
	className?: string
	labels?: "none" | "bold" | "all"
}) {
	const m = src.mix
	if (!m.reading) return null
	const lit = lightOf(selected, m.reading)
	const light = lit
		? {
				...lit,
				axes: new Set<string>(),
				keys: lit.keys.map((k) => ({ ...k, named: false })),
			}
		: null
	return (
		<div className={className}>
			<Print
				reading={m.reading}
				geo={m.geo}
				ridges={FEELS_RIDGES}
				light={light}
				labels={labels}
				onPick={onAxis ? (axis) => axis && onAxis(axis) : undefined}
				label={`The print, lit where ${selected.length ? "the picked feelings" : "nothing"} sit`}
				W={labels === "none" ? 172 : 200}
				H={labels === "none" ? 172 : 176}
			/>
		</div>
	)
}

function useSheet() {
	const [open, setOpen] = useState(false)
	const box = useRef<HTMLDivElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const [phone, setPhone] = useState(false)
	useEffect(() => {
		if (!open) return
		const away = (e: PointerEvent) => {
			const t = e.target as Node
			if (!box.current?.contains(t) && !panel.current?.contains(t))
				setOpen(false)
		}
		// Escape closes the Tuner, not the expanded view under it.
		const esc = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			e.stopImmediatePropagation()
			e.preventDefault()
			setOpen(false)
		}
		window.addEventListener("pointerdown", away, true)
		window.addEventListener("keydown", esc, true)
		return () => {
			window.removeEventListener("pointerdown", away, true)
			window.removeEventListener("keydown", esc, true)
		}
	}, [open])
	const toggle = () => {
		setPhone(window.matchMedia("(max-width: 639px)").matches)
		setOpen((o) => !o)
	}
	return { open, setOpen, toggle, box, panel, phone }
}

type Sheet = ReturnType<typeof useSheet>

/**
 * The Tuner: on phones a bottom sheet, wider screens a panel under its anchor (right-aligned). The mini print (tap a
 * section for its strongest feeling), the rare mixes, and every effect it has to make one's own.
 */
function Tuner({
	src,
	sheet,
	align = "right",
}: { src: Sources; sheet: Sheet; align?: "left" | "right" }) {
	if (!sheet.open) return null
	const body = <TunerBody src={src} onClose={() => sheet.setOpen(false)} />
	if (sheet.phone)
		return createPortal(
			<div className="fixed inset-0 z-[1300]">
				<style>{CSS}</style>
				<div className="feels-fade absolute inset-0 bg-black/55" />
				<div
					ref={sheet.panel}
					// biome-ignore lint/a11y/useSemanticElements: a sheet with its own motion, not a <dialog>
					role="dialog"
					aria-label="Tune what it feels like"
					className="feels-sheet absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-stone-900 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgba(0,0,0,.6)] ring-1 ring-white/10"
				>
					<span
						aria-hidden="true"
						className="mx-auto mb-2 block h-1 w-10 rounded-full bg-white/15"
					/>
					{body}
				</div>
			</div>,
			document.body,
		)
	return (
		<div
			ref={sheet.panel}
			// biome-ignore lint/a11y/useSemanticElements: a panel with its own motion, not a <dialog>
			role="dialog"
			aria-label="Tune what it feels like"
			className={`feels-pop absolute top-full z-50 mt-2 w-[34rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-stone-900 p-4 text-left text-sm font-normal tracking-normal normal-case shadow-[0_16px_40px_rgba(0,0,0,.6)] ring-1 ring-white/10 ${align === "right" ? "right-0" : "left-0"}`}
		>
			<style>{CSS}</style>
			{body}
		</div>
	)
}

const LABEL =
	"text-[11px] font-semibold tracking-[.12em] text-gray-500 uppercase"

function TunerBody({ src, onClose }: { src: Sources; onClose: () => void }) {
	const m = src.mix
	const reading = m.reading as Reading
	const [all, setAll] = useState(false)
	const counted = reading.all
		.filter((r) => r.counts)
		.sort((a, b) => b.strength - a.strength)
	const lines = all ? counted : counted.slice(0, 6)
	const extra = m.effects.filter((r) => !lines.includes(r))
	const pickAxis = (axis: string) =>
		m.set(nextSelection(m.selected, { kind: "axis", id: axis }, reading))
	return (
		<div className="grid gap-x-5 gap-y-4 sm:grid-cols-[176px_minmax(0,1fr)]">
			<div className="flex items-center justify-between sm:hidden">
				<span className={LABEL}>Feels the same as</span>
				<button
					type="button"
					aria-label="Close"
					onClick={onClose}
					className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-gray-400 hover:bg-white/[0.06] hover:text-white"
				>
					<XMarkIcon aria-hidden="true" className="h-5 w-5" />
				</button>
			</div>
			<div className="flex flex-col items-center gap-2 sm:items-stretch">
				<MiniPrint
					src={src}
					selected={m.selected}
					onAxis={pickAxis}
					className="w-[140px] sm:w-full"
				/>
				<p className="text-center text-[12px] leading-snug text-gray-500">
					{m.total !== null && m.selected.length ? (
						<>
							<span className="font-semibold text-gray-200 tabular-nums">
								{fmt(m.total)}
							</span>{" "}
							of the {fmt(m.of)} most popular {noun(src)}
						</>
					) : (
						"Tap a section to add its strongest feeling"
					)}
				</p>
			</div>
			<div className="min-w-0">
				{m.recipes.length > 0 && (
					<>
						<p className={LABEL}>Its rare mixes</p>
						<ul className="mt-1.5 -mx-1.5">
							{m.recipes.map((r, i) => {
								const on = i === m.recipeAt
								return (
									<li key={r.ids.join("+")}>
										<button
											type="button"
											aria-pressed={on}
											onClick={() => m.set(r.ids)}
											className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-[13.5px] font-semibold transition-colors ${on ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"}`}
										>
											<Dots rs={r.effects} />
											<RecipeName
												r={r}
												className="min-w-0 flex-1 leading-snug"
											/>
											<span className="shrink-0 text-[12px] font-medium text-gray-500 tabular-nums">
												1 in {fmt(r.oneIn)}
											</span>
											<CheckIcon
												aria-hidden="true"
												className={`h-4 w-4 shrink-0 text-amber-300 ${on ? "" : "opacity-0"}`}
											/>
										</button>
									</li>
								)
							})}
						</ul>
					</>
				)}
				<p className={`${LABEL} mt-3`}>Or your own, up to three</p>
				<ul
					className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5"
					style={{ fontFamily: DISPLAY }}
				>
					{[...lines, ...extra].map((r) => (
						<li key={r.effect.id}>
							<LineToggle
								r={r}
								on={m.selected.includes(r.effect.id)}
								onToggle={() => m.toggle(r.effect.id)}
								small
							/>
						</li>
					))}
					{counted.length > 6 && (
						<li>
							<button
								type="button"
								onClick={() => setAll(!all)}
								className="cursor-pointer py-0.5 font-sans text-[13px] font-semibold text-gray-500 hover:text-gray-200"
							>
								{all ? "Fewer" : `+${counted.length - 6} more`}
							</button>
						</li>
					)}
				</ul>
				{!m.isStart && (
					<button
						type="button"
						onClick={m.reset}
						className="mt-3 cursor-pointer text-[13px] font-semibold text-amber-300/90 hover:text-amber-300"
					>
						Back to its rarest mix
					</button>
				)}
			</div>
		</div>
	)
}

/** One effect line as a toggle: its color when picked, quiet otherwise; size by strength. */
function LineToggle({
	r,
	on,
	onToggle,
	small = false,
}: { r: EffectReading; on: boolean; onToggle: () => void; small?: boolean }) {
	const p = phraseOf(r)
	const lo = small ? 14 : 16
	const hi = small ? 17 : 22
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onToggle}
			className="feels-lit group/l cursor-pointer rounded py-0.5 text-left leading-tight focus-visible:outline-2 focus-visible:outline-amber-300"
			style={{
				color: on ? p.color : "#78716c",
				fontSize: lo + (hi - lo) * p.k,
				fontWeight: Math.round(560 + 300 * p.k),
				letterSpacing: `${(-0.004 - 0.018 * p.k).toFixed(3)}em`,
			}}
		>
			<span className={on ? "" : "group-hover/l:text-gray-300"}>
				{r.effect.name}.
			</span>
		</button>
	)
}

// --- The mini print and the rare mix stepper ------------------------------------------------------------------------

function PrintStepper({ src }: { src: Sources }) {
	const m = src.mix
	const sheet = useSheet()
	const n = m.recipes.length
	const at = m.recipeAt
	const [dir, setDir] = useState<1 | -1>(1)
	const go = (d: 1 | -1) => {
		if (!n) return
		setDir(d)
		const next = at < 0 ? (d === 1 ? 0 : n - 1) : (at + d + n) % n
		m.set(m.recipes[next].ids)
	}
	const down = useRef<{ x: number; y: number } | null>(null)
	const r = at >= 0 ? m.recipes[at] : null
	return (
		<div ref={sheet.box} className="relative">
			<style>{CSS}</style>
			<div
				className="flex items-center gap-3 sm:gap-4"
				style={{ touchAction: "pan-y" }}
				onPointerDown={(e) => {
					if (e.pointerType !== "mouse")
						down.current = { x: e.clientX, y: e.clientY }
				}}
				onPointerUp={(e) => {
					const d = down.current
					down.current = null
					if (!d) return
					const dx = e.clientX - d.x
					if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - d.y))
						go(dx < 0 ? 1 : -1)
				}}
			>
				<button
					type="button"
					aria-label="Tune what it feels like"
					aria-expanded={sheet.open}
					onClick={sheet.toggle}
					className={`group/p relative w-[88px] shrink-0 cursor-pointer rounded-xl transition-colors sm:w-[116px] ${sheet.open ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"}`}
				>
					<MiniPrint src={src} selected={m.selected} />
					<span className="absolute -right-1 -bottom-1 grid h-6 w-6 place-items-center rounded-full bg-stone-900 text-gray-400 ring-1 ring-white/15 transition-colors group-hover/p:text-white">
						<AdjustmentsHorizontalIcon aria-hidden="true" className="h-3 w-3" />
					</span>
				</button>
				<div className="min-w-0 flex-1 sm:w-72 sm:flex-none">
					<div
						key={`${m.key}`}
						className={dir === 1 ? "feels-next" : "feels-prev"}
					>
						<p className={LABEL}>
							{r
								? `Rare mix ${at + 1} of ${n}`
								: m.selected.length
									? "Your own mix"
									: "Nothing picked"}
						</p>
						<p className="mt-0.5 text-[14px] leading-snug text-gray-300">
							{r ? (
								<>
									Only{" "}
									<span className="font-semibold text-gray-100 tabular-nums">
										1 in {fmt(r.oneIn)}
									</span>{" "}
									{src.noun} do {r.ids.length === 2 ? "both" : "all three"}
								</>
							) : m.total !== null && m.selected.length ? (
								<>
									<span className="font-semibold text-gray-100 tabular-nums">
										{fmt(m.total)}
									</span>{" "}
									of the {fmt(m.of)} most popular {src.noun}
								</>
							) : (
								"Tap the print to pick"
							)}
						</p>
					</div>
					{n > 1 && (
						<div className="mt-1.5 flex items-center gap-1" aria-hidden="true">
							{m.recipes.map((x, i) => (
								<span
									key={x.ids.join("+")}
									className={`h-1 rounded-full transition-[background-color] ${i === at ? "w-4 bg-amber-300/80" : "w-1 bg-white/20"}`}
								/>
							))}
						</div>
					)}
				</div>
				{n > 1 && (
					<div className="flex shrink-0 items-center gap-1">
						<Step label="Previous rare mix" onClick={() => go(-1)}>
							<ChevronLeftIcon className="h-5 w-5" />
						</Step>
						<Step label="Next rare mix" onClick={() => go(1)}>
							<ChevronRightIcon className="h-5 w-5" />
						</Step>
					</div>
				)}
			</div>
			<Tuner src={src} sheet={sheet} align="left" />
		</div>
	)
}

function Step({
	label,
	onClick,
	children,
}: { label: string; onClick: () => void; children: ReactNode }) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-gray-300 ring-1 ring-white/15 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
		>
			{children}
		</button>
	)
}
