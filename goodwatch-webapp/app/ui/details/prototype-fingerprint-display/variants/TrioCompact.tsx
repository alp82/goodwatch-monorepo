// PROTOTYPE - throwaway.
// The tightest trio: band, a smaller bold headline, sliders as one-line rows; selecting an area swaps the rows for a small details panel in place.
import { PILLARS, type Pillar } from "~/ui/details/DetailsFingerprint"
import type * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { GROUPS } from "./bandsliders-parts"
import type { Scale } from "./slidestrip-parts"
import { SectionTitle } from "./strip-parts"
import {
	type AreaSelection,
	AreaHeader,
	AreaLinks,
	AreaVerdict,
	GROUP_HEAD,
	Headline,
	Lines,
	Swap,
	TraitBars,
	TrioBand,
	TrioSlider,
	areaLines,
	composeHeadline,
	scalesOf,
	useAreaSelection,
} from "./trio2-parts"
import { GoodForLine } from "./versus-parts"

const BOLD = "text-[1.3rem] leading-[1.22] sm:text-[1.45rem]"

function Rows({ t, x }: { t: F.TitleInput; x: AreaSelection }) {
	const [feel, story, look] = GROUPS
	const group = (name: string, scales: Scale[]) => (
		<section>
			<h3 className={GROUP_HEAD}>{name}</h3>
			<ul className="mt-0.5">
				{scales.map((sc) => (
					<li key={sc.name}>
						<TrioSlider sc={sc} t={t} x={x} layout="row" />
					</li>
				))}
			</ul>
		</section>
	)
	return (
		<div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
			{group(feel.name, feel.scales)}
			<div className="space-y-2">
				{group(story.name, story.scales)}
				{group(look.name, look.scales)}
			</div>
		</div>
	)
}

function Details({ t, p, x }: { t: F.TitleInput; p: Pillar; x: AreaSelection }) {
	return (
		<div className="flex h-full flex-col">
			<AreaHeader t={t} p={p} x={x} />
			<AreaVerdict t={t} p={p} className="mt-2 [&>p:first-child]:text-[15px]" />
			{/* Phones have room to spare under the rows' reserved height: show the area's sliders and two related traits too. */}
			<ul className="mt-3 sm:hidden">
				{scalesOf(p).map((sc) => (
					<li key={sc.name}>
						<TrioSlider sc={sc} t={t} x={x} layout="row" />
					</li>
				))}
			</ul>
			<TraitBars t={t} p={p} own={4} related={2} className="mt-3 grid-cols-2 gap-y-2 sm:hidden" />
			<TraitBars t={t} p={p} own={4} related={0} className="mt-3 grid-cols-2 gap-y-2 max-sm:hidden" />
			<div className="mt-auto pt-3">
				<AreaLinks t={t} p={p} moods={1} size="xs" />
			</div>
		</div>
	)
}

export default function TrioCompact({ t }: VariantProps) {
	const x = useAreaSelection()
	const active = x.sel ?? "all"
	return (
		<div>
			<SectionTitle t={t} />

			<div className="mt-3">
				<TrioBand t={t} x={x} height="h-3.5" />
			</div>

			<div className="mt-4 grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,4.6fr)_minmax(0,7.4fr)]">
				<Swap
					active={active}
					panes={[
						{
							id: "all",
							node: (
								<div className="flex h-full flex-col">
									<Headline segs={composeHeadline(t)} x={x} className={BOLD} />
									<GoodForLine t={t} className="mt-auto pt-3 max-lg:hidden" />
								</div>
							),
						},
						...PILLARS.map((p) => ({ id: p, node: <Lines lines={areaLines(t, p)} x={x} className={BOLD} /> })),
					]}
				/>
				<Swap
					active={active}
					panes={[
						{ id: "all", node: <Rows t={t} x={x} /> },
						...PILLARS.map((p) => ({ id: p, label: `${p} details`, node: <Details t={t} p={p} x={x} /> })),
					]}
				/>
			</div>
			<GoodForLine t={t} className="mt-3 lg:hidden" />
		</div>
	)
}
