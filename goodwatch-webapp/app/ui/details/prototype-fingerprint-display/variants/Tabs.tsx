// PROTOTYPE - throwaway.
// A tab bar of the six areas with tiny meters; one area at a time in a compact panel, strongest first.
import type React from "react"
import { useRef, useState } from "react"
import { DriverBars, HEX, Meter, MoreLinks, type Pillar, PILLARS, Verdict, tint } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SectionTitle, areaWord, goodFor, strongest } from "./strip-parts"

export default function Tabs({ t }: VariantProps) {
	const tiers = t.fingerprint.pillars
	const [sel, setSel] = useState<Pillar>(() => strongest(t))
	const tabs = useRef<Record<string, HTMLButtonElement | null>>({})
	const good = goodFor(t, 5)
	const skip = F.skipIf(t).slice(0, 2)

	const onKey = (e: React.KeyboardEvent) => {
		const i = PILLARS.indexOf(sel)
		const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: PILLARS.length - 1 }[e.key]
		if (next === undefined) return
		e.preventDefault()
		const p = PILLARS[(next + PILLARS.length) % PILLARS.length]
		setSel(p)
		tabs.current[p]?.focus()
	}

	return (
		<div>
			<SectionTitle t={t} />
			<p className="mt-2 text-2xl font-semibold tracking-tight text-amber-200">{F.pillarLine(t)}.</p>

			<div
				role="tablist"
				aria-label="Fingerprint areas"
				onKeyDown={onKey}
				className="mt-5 grid grid-cols-3 border-b border-white/10 sm:grid-cols-6"
			>
				{PILLARS.map((p) => {
					const on = sel === p
					return (
						<button
							key={p}
							ref={(el) => {
								tabs.current[p] = el
							}}
							type="button"
							role="tab"
							id={`tabs-tab-${p}`}
							aria-selected={on}
							aria-controls="tabs-panel"
							tabIndex={on ? 0 : -1}
							onClick={() => setSel(p)}
							className={`relative flex flex-col items-center gap-1.5 px-2 pb-3 pt-2 text-sm cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-300 ${
								on ? "rounded-t-lg bg-white/5 font-semibold text-white" : "text-gray-400 hover:text-gray-200"
							}`}
						>
							<span className="flex items-center gap-1.5">
								<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span>
								{p}
							</span>
							<span className="origin-center scale-75">
								<Meter tier={tiers[p]} p={p} />
							</span>
							<span
								aria-hidden="true"
								className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-opacity ${on ? "opacity-100" : "opacity-0"}`}
								style={{ background: HEX[p] }}
							/>
						</button>
					)
				})}
			</div>

			<div
				id="tabs-panel"
				role="tabpanel"
				aria-labelledby={`tabs-tab-${sel}`}
				className="grid gap-6 rounded-b-2xl px-4 py-5 sm:px-5 md:min-h-48 md:grid-cols-[1fr_18rem] md:gap-12 [&>*]:min-w-0"
				style={tint(sel, 10)}
			>
				<div key={sel} className="space-y-4 animate-[tabsIn_160ms_ease-out]">
					<style>{"@keyframes tabsIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}"}</style>
					<p className="text-xs font-semibold uppercase tracking-wide" style={{ color: HEX[sel] }}>
						{areaWord(sel, tiers[sel])}
					</p>
					<Verdict t={t} p={sel} size="lg" />
					<div className="hidden md:block">
						<MoreLinks t={t} p={sel} />
					</div>
				</div>
				<div key={`${sel}-bars`} className="animate-[tabsIn_160ms_ease-out]">
					<DriverBars t={t} p={sel} compact />
				</div>
				<div className="md:hidden">
					<MoreLinks t={t} p={sel} />
				</div>
			</div>

			<div className="mt-5 flex flex-wrap items-center gap-1.5 text-sm">
				{good.shown.map((w) => (
					<span key={w} className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-emerald-100">
						{w}
					</span>
				))}
				{skip.map((s) => (
					<span key={s} className="rounded-full bg-rose-400/15 px-2.5 py-0.5 text-rose-100">
						Skip if {s}
					</span>
				))}
			</div>
		</div>
	)
}
