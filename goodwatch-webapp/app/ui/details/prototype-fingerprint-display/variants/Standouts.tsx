// PROTOTYPE - throwaway.
// Only the strong areas (plus a meaningful "none") as verdict lines, the rest in one "Also" line, full detail behind a toggle.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type React from "react"
import { useRef, useState } from "react"
import { Head, Meter, type Pillar, PILLARS, PillarDetail } from "~/ui/details/DetailsFingerprint"
import { PILLAR_CONFIG } from "~/ui/fingerprint/Pillars"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { areaWord, cleanMood, goodFor, kindOf, strongest } from "./strip-parts"

const ORDER: Pillar[] = ["Humor", "Heart", "Energy", "World", "Style", "Craft"]

export default function Standouts({ t }: VariantProps) {
	const tiers = t.fingerprint.pillars
	const [detail, setDetail] = useState<Pillar | null>(null)
	const toggleRef = useRef<HTMLButtonElement>(null)
	const backRef = useRef<HTMLButtonElement>(null)

	// At most four, the areas that vary most between titles first (craft is high almost everywhere).
	const strong = PILLARS.filter((p) => tiers[p] >= 3)
		.sort((a, b) => tiers[b] - tiers[a] || ORDER.indexOf(a) - ORDER.indexOf(b))
		.slice(0, 4)
	// A "none" is worth a line when it is the point: serious throughout.
	const humorNone = !strong.includes("Humor") && F.pillarBrief(t, "Humor").verdict === "Serious throughout"
	const shown: Pillar[] = humorNone ? [...strong, "Humor"] : strong
	const rest = PILLARS.filter((p) => !shown.includes(p))

	const good = goodFor(t, 5)
	const skip = F.skipIf(t).slice(0, 2)
	const moods = F.matchingMoods(t).slice(0, 4)
	const kind = kindOf(t)

	return (
		<div>
			<Head t={t} />

			<ul className="mt-6 grid gap-x-10 gap-y-1 border-y border-white/8 py-2 lg:grid-cols-2">
				{shown.map((p) => {
					const b = F.pillarBrief(t, p)
					return (
						<li key={p}>
							<button
								type="button"
								onClick={() => setDetail(p)}
								className="group flex w-full flex-col gap-1 rounded-lg px-2 py-2.5 text-left cursor-pointer hover:bg-white/3 focus-visible:outline-2 focus-visible:outline-amber-300 sm:grid sm:grid-cols-[7rem_5.5rem_1fr] sm:items-baseline sm:gap-x-4 lg:-mx-2"
							>
								<span className="flex items-center gap-2 text-sm font-semibold text-gray-300 sm:contents">
									<span className="flex items-center gap-2">
										<span aria-hidden="true">{PILLAR_CONFIG[p].emoji}</span>
										{p}
									</span>
									<span className="ml-auto inline-flex sm:ml-0">
										<Meter tier={tiers[p]} p={p} />
									</span>
								</span>
								<span className="min-w-0">
									<span className="font-semibold text-white">{b.verdict}</span>
									{b.note && <span className="hidden text-sm text-gray-400 sm:inline"> · {b.note}</span>}
								</span>
							</button>
						</li>
					)
				})}
			</ul>

			<div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
				{rest.length > 0 && (
					<p className="text-sm text-gray-400">
						<span className="font-semibold text-gray-300">Also: </span>
						{F.list(rest.map((p) => areaWord(p, tiers[p])))}
					</p>
				)}
				<button
					ref={toggleRef}
					type="button"
					aria-expanded={detail !== null}
					aria-controls="standouts-detail"
					onClick={() => setDetail(detail ? null : strongest(t))}
					className="inline-flex h-9 items-center gap-1 rounded-full bg-white/10 pl-3.5 pr-2.5 text-sm font-semibold hover:bg-white/20 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
				>
					{detail ? "Hide traits" : "Show all traits"}
					<ChevronDownIcon className={`h-5 w-5 transition-transform ${detail ? "rotate-180" : ""}`} aria-hidden="true" />
				</button>
			</div>

			{detail && (
				<div id="standouts-detail" className="mt-4">
					<PillarDetail
						t={t}
						p={detail}
						onBack={() => {
							setDetail(null)
							toggleRef.current?.focus()
						}}
						onSelect={setDetail}
						backRef={backRef}
					/>
				</div>
			)}

			<div className="mt-6 flex flex-col gap-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
				<Group label="For">
					{good.shown.map((w) => (
						<span key={w} className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-100">
							{w}
						</span>
					))}
				</Group>
				{skip.length > 0 && (
					<Group label="Skip it if">
						{skip.map((s) => (
							<span key={s} className="rounded-full bg-rose-400/15 px-2 py-0.5 text-rose-100">
								{s.charAt(0).toUpperCase() + s.slice(1)}
							</span>
						))}
					</Group>
				)}
				{moods.length > 0 && (
					<Group label="More like it">
						{moods.map((m) => (
							<Link key={m.url} to={m.url} className="rounded-full border border-white/20 px-2 py-0.5 hover:border-white/60 hover:bg-white/5">
								{cleanMood(m.label)} {kind}
							</Link>
						))}
					</Group>
				)}
			</div>
		</div>
	)
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="mr-1 font-semibold text-gray-300">{label}</span>
			{children}
		</div>
	)
}
