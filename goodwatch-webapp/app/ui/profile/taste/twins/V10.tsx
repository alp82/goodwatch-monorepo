// Variant 10, score meter: the match as a horizontal meter from 0 to 100 with the five tier zones, the counts beneath
// it as big numbers. Collapsed: a "Compare" handle at the meter's end opens the comparison.
// Expanded: the panels slide in below; the meter row sticks under the tab row as their header, its handle now closes.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { matchTier } from "~/domain/profile-taste"
import { DISPLAY } from "~/ui/my-pages/bits"
import { matchColor } from "../../match"
import { CountUp } from "./parts"
import { EASE, Face, Panels, PullsSentence, matchFacts } from "./V6-kit"
import type { TwinsProps } from "./types"

const SMALL = "[&>*]:size-10! [&>*]:text-lg! [&>*]:ring-2!"
/** The tier zones on the 0 to 100 scale, as matchTier draws them. */
const ZONES = [
	[0, 45],
	[45, 60],
	[60, 75],
	[75, 90],
	[90, 100],
] as const

/** How far down the sticky rows reach (as compare-link's scroll reads it), for the stuck meter. */
function useRowsBottom(on: boolean) {
	const [top, setTop] = useState(64)
	useEffect(() => {
		if (!on) return
		const read = () => {
			const row = document.querySelector<HTMLElement>("[data-tab-row]")
			setTop(row ? (Number.parseFloat(getComputedStyle(row).top) || 0) + row.offsetHeight : 64)
		}
		read()
		window.addEventListener("resize", read)
		return () => window.removeEventListener("resize", read)
	}, [on])
	return top
}

function Meter({ p, still }: { p: number; still: boolean }) {
	const here = ZONES.findIndex(([a, b]) => p >= a && (p < b || b === 100))
	return (
		<div className="relative min-w-0 flex-1 pt-7">
			{/* The marker: the percentage over a tick at the match. */}
			<motion.span
				className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
				style={{ left: `${p}%` }}
				initial={still ? false : { opacity: 0, y: 4 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
			>
				<span className="text-sm leading-none font-black text-white tabular-nums">
					<CountUp to={p} still={still} />%
				</span>
			</motion.span>
			<div className="relative flex h-3 gap-0.5" aria-hidden>
				{ZONES.map(([a, b], i) => {
					const fill = Math.max(0, Math.min(1, (p - a) / (b - a)))
					const color = matchColor((a + b) / 2)
					return (
						<span
							key={a}
							className={`relative h-full overflow-hidden ${i === 0 ? "rounded-l-full" : ""} ${i === ZONES.length - 1 ? "rounded-r-full" : ""}`}
							style={{ width: `${b - a}%`, background: `color-mix(in srgb, ${color} 18%, transparent)` }}
						>
							<motion.span
								className="absolute inset-0 origin-left"
								style={{ background: color }}
								initial={still ? false : { scaleX: 0 }}
								animate={{ scaleX: fill }}
								transition={{ duration: 0.5, delay: still ? 0 : i * 0.12, ease: "easeOut" }}
							/>
						</span>
					)
				})}
				<span
					className="absolute -top-1.5 -bottom-1.5 w-1 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgb(3_7_18)]"
					style={{ left: `${p}%` }}
				/>
			</div>
			<div className="relative mt-2 flex text-[10px] font-bold tracking-wide uppercase" aria-hidden>
				{ZONES.map(([a, b], i) => (
					<span
						key={a}
						className={`flex min-w-0 px-0.5 whitespace-nowrap ${i === ZONES.length - 1 ? "justify-end" : ""} ${i === here ? "" : "text-gray-600 max-md:invisible"}`}
						style={{ width: `${b - a}%`, color: i === here ? matchColor((a + b) / 2) : undefined }}
					>
						<span className={i === here ? "" : "truncate"}>{matchTier(a)}</span>
					</span>
				))}
			</div>
		</div>
	)
}

export default function TwinsV10({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = matchFacts(compare)
	const top = useRowsBottom(open)
	return (
		<motion.div
			ref={topRef}
			layout={still ? false : "position"}
			className="relative flex flex-col rounded-3xl border border-white/10 bg-gray-950"
			style={{
				backgroundImage: `radial-gradient(80% 60% at 100% 0%, color-mix(in srgb, ${f.color} ${8 + f.strength * 10}%, transparent), transparent 70%)`,
			}}
		>
			<section aria-label="Taste match" className="flex flex-col gap-3 px-5 pt-5 sm:px-8 sm:pt-7">
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0">
						<p className="text-xs font-bold tracking-[0.18em] text-gray-500 uppercase">You and @{shell.handle}</p>
						<h2 className={`${DISPLAY} mt-1 text-4xl leading-none sm:text-6xl`} style={{ color: f.color }}>
							{f.tier}
						</h2>
					</div>
					<span className="flex shrink-0">
						<Face who="them" shell={shell} size={SMALL} />
						<span className="-ml-3">
							<Face who="you" shell={shell} size={SMALL} />
						</span>
					</span>
				</div>
				<PullsSentence c={compare} className="max-w-2xl text-sm text-gray-300 sm:text-base" />
			</section>
			{/* The meter and its handle; stuck under the tab row while the comparison is open. */}
			<div
				className={`z-10 flex items-center gap-3 px-5 pt-3 pb-3 sm:gap-5 sm:px-8 ${open ? "sticky border-b border-white/10 bg-gray-950" : ""}`}
				style={open ? { top } : undefined}
			>
				<Meter p={f.p} still={still} />
				<button
					type="button"
					aria-expanded={open}
					aria-controls={sectionId}
					aria-label={label}
					onClick={toggle}
					className={`group mt-1 inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full pr-3 pl-4 text-sm font-black ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${open ? "bg-white/[0.06] text-gray-100 ring-white/15 hover:bg-white/[0.1]" : "bg-linear-to-b from-amber-400 to-amber-600 text-gray-950 ring-amber-300/50 hover:brightness-110"}`}
					data-compare-row
				>
					{open ? "Close" : <>Compare<span className="max-sm:hidden"> side by side</span></>}
					<ChevronDownIcon
						className={`size-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
						aria-hidden
					/>
				</button>
			</div>
			<dl className="grid grid-cols-3 gap-2 px-5 pt-2 pb-5 sm:px-8 sm:pb-7">
				{[
					["Both love", f.both],
					["Rated by both", f.rated],
					["Big splits", f.splits],
				].map(([k, v]) => (
					<div key={k} className="flex flex-col-reverse">
						<dt className="text-xs text-gray-500 sm:text-sm">{k}</dt>
						<dd className={`${DISPLAY} text-3xl text-white tabular-nums sm:text-5xl`}>{v}</dd>
					</div>
				))}
			</dl>
			<AnimatePresence initial={false} mode="popLayout">
				{open && (
					<motion.section
						key="meet"
						id={sectionId}
						aria-label={label}
						className="flex flex-col gap-4 border-t border-white/10 p-3 sm:p-5"
						initial={{ opacity: 0, y: still ? 0 : -12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: still ? 0 : -12 }}
						transition={{ duration: still ? 0 : 0.26, ease: EASE }}
					>
						<Panels handle={shell.handle} c={compare} />
					</motion.section>
				)}
			</AnimatePresence>
		</motion.div>
	)
}
