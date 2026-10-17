// PROTOTYPE - throwaway.
// Trio with the band as a tab bar: "All" plus one tab per area, a sliding indicator under the band, a headline that follows the tab and a fixed-height panel below.
import { type ReactNode, useLayoutEffect, useRef, useState } from "react"
import { HEX, type Pillar, PILLARS } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import type { VariantProps } from "../types"
import { SectionTitle } from "./strip-parts"
import { AreaDetails, AreaHeadline, Glow, GoodFor, Headline, SliderGroups, Stack, Stripes, areaLabel, richHeadline, tierFlex } from "./trioscrub-parts"
import { AREA_WORD } from "./versus-parts"

type Tab = Pillar | "all"
// Built on first use: DetailsFingerprint imports the variants, so PILLARS isn't ready at module load.
const tabsList = (): Tab[] => ["all", ...PILLARS]

export default function TrioTabs({ t }: VariantProps) {
	const TABS = tabsList()
	const [tab, setTab] = useState<Tab>("all")
	const [hover, setHover] = useState<Pillar | null>(null)
	const list = useRef<HTMLDivElement>(null)
	const bar = useRef<HTMLSpanElement>(null)
	const tabs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({})
	const [ready, setReady] = useState(false)
	const id = (k: Tab) => `fp-tt-${k}`

	// The indicator is one 100px bar moved and scaled under the selected tab's band block.
	useLayoutEffect(() => {
		const place = () => {
			const l = list.current?.getBoundingClientRect()
			const block = tabs.current[tab]?.querySelector("[data-block]")?.getBoundingClientRect()
			if (!l || !block || !bar.current) return
			bar.current.style.transform = `translateX(${block.left - l.left}px) scaleX(${block.width / 100})`
			setReady(true)
		}
		place()
		const ro = new ResizeObserver(place)
		if (list.current) ro.observe(list.current)
		return () => ro.disconnect()
	}, [tab])

	const pick = (k: Tab, focus = false) => {
		setTab(k)
		if (focus) tabs.current[k]?.focus()
	}
	const panelArea = tab === "all" ? null : tab

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Escape anywhere in the section goes back to All
		<div
			onKeyDown={(e) => {
				if (e.key === "Escape" && tab !== "all") {
					e.stopPropagation()
					pick("all", true)
				}
			}}
		>
			<SectionTitle t={t} />

			<div
				ref={list}
				role="tablist"
				aria-label="Fingerprint areas"
				className="relative mt-4 flex gap-[3px] pb-1"
				onPointerLeave={() => setHover(null)}
				onKeyDown={(e) => {
					const i = TABS.indexOf(tab)
					const next =
						e.key === "ArrowRight"
							? TABS[(i + 1) % TABS.length]
							: e.key === "ArrowLeft"
								? TABS[(i - 1 + TABS.length) % TABS.length]
								: e.key === "Home"
									? TABS[0]
									: e.key === "End"
										? TABS[TABS.length - 1]
										: null
					if (!next) return
					e.preventDefault()
					// Keep the page's prototype switcher (window arrow keys) out of it.
					e.stopPropagation()
					pick(next, true)
				}}
			>
				{TABS.map((k, i) => {
					const on = tab === k
					const p = k === "all" ? null : k
					const lit = p !== null && (hover === p || on)
					return (
						<button
							key={k}
							ref={(el) => {
								if (el) tabs.current[k] = el
							}}
							type="button"
							role="tab"
							id={id(k)}
							data-seg={p ?? "all"}
							aria-selected={on}
							aria-controls={`${id(k)}-panel`}
							aria-label={p ? areaLabel(t, p) : "All areas"}
							tabIndex={on ? 0 : -1}
							onClick={() => pick(k)}
							onPointerEnter={(e) => e.pointerType === "mouse" && setHover(p)}
							onFocus={() => setHover(p)}
							onBlur={() => setHover(null)}
							className={`group relative flex cursor-pointer flex-col pt-1 text-left focus-visible:outline-none ${p ? "min-w-[2.6rem]" : "w-11 shrink-0 sm:w-14"}`}
							style={p ? { flex: `${tierFlex(t, p)} 1 0%` } : undefined}
						>
							<span data-block className="relative block w-full">
								{p ? (
									<Stripes t={t} p={p} className={`h-6 w-full ${i === TABS.length - 1 ? "rounded-r-md" : ""}`} />
								) : (
									<span
										className={`flex h-6 w-full items-center justify-center rounded-l-md text-xs font-semibold transition-colors duration-200 ${
											on ? "bg-white text-stone-950" : "bg-white/[.08] text-gray-200 group-hover:bg-white/[.14]"
										}`}
									>
										All
									</span>
								)}
								{p && <Glow p={p} on={hover === p && !on} className={i === TABS.length - 1 ? "rounded-r-lg" : ""} />}
								<span
									aria-hidden="true"
									className="pointer-events-none absolute -inset-[5px] rounded-lg border-2 border-amber-300 opacity-0 group-focus-visible:opacity-100"
								/>
							</span>
							{/* Room for the sliding indicator */}
							<span aria-hidden="true" className="block h-3.5" />
							<span
								className="block truncate text-xs transition-colors duration-150"
								style={{ color: p ? (lit ? HEX[p] : "#9ca3af") : on ? "#fff" : "#9ca3af" }}
							>
								{p ? (
									<>
										<span aria-hidden="true" className="max-sm:hidden">
											{PILLAR_CONFIG[p].emoji}{" "}
										</span>
										{p}
									</>
								) : (
									<span className="max-sm:hidden">Overview</span>
								)}
							</span>
							<span className={`block truncate text-[13px] font-semibold transition-colors duration-150 max-sm:hidden ${lit ? "text-white" : "text-gray-500"}`}>
								{p ? AREA_WORD[p][t.fingerprint.pillars[p]] : " "}
							</span>
						</button>
					)
				})}
				<span
					ref={bar}
					aria-hidden="true"
					className={`pointer-events-none absolute left-0 top-[34px] h-[3px] w-[100px] origin-left rounded-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(.2,.8,.2,1)] ${
						ready ? "opacity-100" : "opacity-0"
					}`}
					style={{ background: panelArea ? HEX[panelArea] : "#fff" }}
				/>
			</div>

			<Stack
				active={tab}
				slide
				className="mt-5 text-[1.6rem] font-bold leading-tight tracking-tight sm:text-[2.1rem]"
				items={[
					[
						"all",
						<p key="all">
							<Headline bits={richHeadline(t)} hot={hover} />
						</p>,
					],
					...PILLARS.map((p) => [p, <AreaHeadline key={p} t={t} p={p} />] as [string, ReactNode]),
				]}
			/>

			<Stack
				active={tab}
				slide
				className="mt-6"
				itemProps={(k) => ({ role: "tabpanel", id: `${id(k as Tab)}-panel`, "aria-labelledby": id(k as Tab) })}
				items={[
					[
						"all",
						<div key="all">
							<SliderGroups t={t} hot={hover} onHover={setHover} onPick={(p) => pick(p)} layout="wide" />
							<GoodFor t={t} className="mt-4" />
						</div>,
					],
					...PILLARS.map((p) => [p, <AreaDetails key={p} t={t} p={p} three />] as [string, ReactNode]),
				]}
			/>
		</div>
	)
}
