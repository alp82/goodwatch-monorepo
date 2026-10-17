// PROTOTYPE - throwaway.
// Vivino-dense: every reading, areas included, as a two-ended slider in Feel / Story / Look groups; tap one for its traits.
import { useState } from "react"
import { Bars, HEX } from "~/ui/details/DetailsFingerprint"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { AREA_SCALES, INTENSITY_SCALE, SCALES, type Scale, Track, reading, scaleTraits } from "./slidestrip-parts"
import { SectionTitle } from "./strip-parts"

const [PACE, TONE, SETTING, ATTENTION] = SCALES
const A = AREA_SCALES
const GROUPS: { name: string; scales: Scale[] }[] = [
	{ name: "Feel", scales: [PACE, A.Energy, INTENSITY_SCALE, TONE, A.Heart, A.Humor] },
	{ name: "Story", scales: [ATTENTION, SETTING, A.World] },
	{ name: "Look", scales: [A.Style, A.Craft] },
]

function Row({ sc, t, open, onToggle }: { sc: Scale; t: F.TitleInput; open: boolean; onToggle: () => void }) {
	const r = reading(sc, t)
	const id = `allsliders-${sc.name.toLowerCase()}`
	const traits = scaleTraits(sc, t, 6)
	return (
		<li>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={id}
				onClick={onToggle}
				className={`-mx-2 grid w-[calc(100%+1rem)] cursor-pointer grid-cols-[7.25rem_1fr] items-center gap-x-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-amber-300 sm:grid-cols-[7.5rem_1fr] ${open ? "bg-white/5" : ""}`}
			>
				<span className="min-w-0">
					<span className="block text-xs text-gray-400">{sc.name}</span>
					<span className="block text-sm font-semibold leading-tight text-white">{r.word}</span>
				</span>
				<span className="grid grid-cols-2 items-center gap-x-3 gap-y-1 sm:grid-cols-[5.5rem_1fr_7rem]">
					<span
						className={`order-2 text-xs sm:order-1 sm:text-right ${r.near === "left" ? "text-gray-200" : "text-gray-500"}`}
					>
						{sc.left}
					</span>
					<Track
						v={r.v}
						area={sc.area}
						size="pill"
						className="order-1 col-span-2 sm:order-2 sm:col-span-1"
						label={`${sc.name}: ${r.word}, between ${sc.left.toLowerCase()} and ${sc.right.toLowerCase()}`}
					/>
					<span className={`order-3 text-right text-xs sm:text-left ${r.near === "right" ? "text-gray-200" : "text-gray-500"}`}>
						{sc.right}
					</span>
				</span>
			</button>
			{open && (
				<div
					id={id}
					className="mb-2 mt-1 rounded-xl border border-white/10 px-4 py-3 motion-safe:animate-[asFade_150ms_ease-out]"
					style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${HEX[sc.area]} 10%, transparent), transparent 70%)` }}
				>
					<p className="mb-2.5 text-xs text-gray-400">Traits behind this reading, out of 10</p>
					<div className="grid gap-x-8 sm:grid-cols-2 [&_ul]:space-y-2">
						<Bars attributes={traits.slice(0, Math.ceil(traits.length / 2))} color={HEX[sc.area]} />
						<Bars attributes={traits.slice(Math.ceil(traits.length / 2))} color={HEX[sc.area]} />
					</div>
				</div>
			)}
		</li>
	)
}

function Group({ g, t, open, setOpen }: { g: (typeof GROUPS)[number]; t: F.TitleInput; open: string | null; setOpen: (s: string | null) => void }) {
	return (
		<section>
			<h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.name}</h3>
			<ul>
				{g.scales.map((sc) => (
					<Row key={sc.name} sc={sc} t={t} open={open === sc.name} onToggle={() => setOpen(open === sc.name ? null : sc.name)} />
				))}
			</ul>
		</section>
	)
}

export default function AllSliders({ t }: VariantProps) {
	const [open, setOpen] = useState<string | null>(null)
	return (
		<div onKeyDown={(e) => e.key === "Escape" && setOpen(null)}>
			<style>{"@keyframes asFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}"}</style>
			<SectionTitle t={t} />
			<p className="mt-2 max-w-3xl text-gray-300">{F.summary(t)}</p>

			<div className="mt-5 grid gap-x-14 gap-y-5 lg:grid-cols-2 [&>*]:min-w-0">
				<Group g={GROUPS[0]} t={t} open={open} setOpen={setOpen} />
				<div className="space-y-5">
					<Group g={GROUPS[1]} t={t} open={open} setOpen={setOpen} />
					<Group g={GROUPS[2]} t={t} open={open} setOpen={setOpen} />
				</div>
			</div>
			<p className="mt-3 text-xs text-gray-500">Select a scale to see the traits behind it.</p>
		</div>
	)
}
