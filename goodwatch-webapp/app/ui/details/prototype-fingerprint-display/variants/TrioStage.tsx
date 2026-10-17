// PROTOTYPE - throwaway.
// Band and bold headline full width on top, then one fixed-height stage: sliders by default, the selected area's details laid out wide.
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

const BOLD = "text-[1.45rem] leading-[1.2] sm:text-[1.9rem] lg:text-[2.05rem] lg:leading-[1.15]"

function Sliders({ t, x }: { t: F.TitleInput; x: AreaSelection }) {
	const [feel, story, look] = GROUPS
	const col = (scales: Scale[], cls = "") => (
		<ul className={`mt-0.5 grid gap-x-6 ${cls}`}>
			{scales.map((sc) => (
				<li key={sc.name} className="min-w-0">
					<TrioSlider sc={sc} t={t} x={x} />
				</li>
			))}
		</ul>
	)
	return (
		<div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4 lg:gap-x-10">
			<section className="col-span-2">
				<h3 className={GROUP_HEAD}>{feel.name}</h3>
				{col(feel.scales, "grid-cols-2 lg:grid-flow-col lg:grid-rows-3")}
			</section>
			<section className="max-lg:col-span-2">
				<h3 className={GROUP_HEAD}>{story.name}</h3>
				{col(story.scales, "max-lg:grid-cols-2")}
			</section>
			<section className="max-lg:col-span-2">
				<h3 className={GROUP_HEAD}>{look.name}</h3>
				{col(look.scales, "max-lg:grid-cols-2")}
			</section>
		</div>
	)
}

function Wide({ t, p, x }: { t: F.TitleInput; p: Pillar; x: AreaSelection }) {
	return (
		<div className="grid h-full gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1.35fr)]">
			<div className="flex flex-col">
				<AreaHeader t={t} p={p} x={x} />
				<AreaVerdict t={t} p={p} className="mt-3" />
				<div className="mt-auto pt-5 max-lg:hidden">
					<AreaLinks t={t} p={p} size="xs" />
				</div>
			</div>
			<div>
				<p className={GROUP_HEAD}>On the sliders</p>
				<ul className="mt-1.5">
					{scalesOf(p).map((sc) => (
						<li key={sc.name}>
							<TrioSlider sc={sc} t={t} x={x} layout="row" className="lg:grid-cols-[4.25rem_minmax(0,1fr)_6.25rem]" />
						</li>
					))}
				</ul>
			</div>
			<div>
				<p className={GROUP_HEAD}>Traits behind it</p>
				<TraitBars t={t} p={p} className="mt-3 grid-cols-2" />
			</div>
			<div className="lg:hidden">
				<AreaLinks t={t} p={p} size="xs" />
			</div>
		</div>
	)
}

export default function TrioStage({ t }: VariantProps) {
	const x = useAreaSelection()
	const active = x.sel ?? "all"
	return (
		<div>
			<SectionTitle t={t} />

			<div className="mt-4">
				<TrioBand t={t} x={x} />
			</div>

			<Swap
				className="mt-6"
				active={active}
				panes={[
					{ id: "all", node: <Headline segs={composeHeadline(t)} x={x} className={`${BOLD} max-w-[60rem]`} /> },
					...PILLARS.map((p) => ({ id: p, node: <Lines lines={areaLines(t, p)} x={x} className={BOLD} /> })),
				]}
			/>

			<div className="mt-5 rounded-2xl border border-white/[.06] bg-white/[.02] p-4 sm:p-5">
				<Swap
					active={active}
					panes={[
						{ id: "all", node: <Sliders t={t} x={x} /> },
						...PILLARS.map((p) => ({ id: p, label: `${p} details`, node: <Wide t={t} p={p} x={x} /> })),
					]}
				/>
			</div>
			<GoodForLine t={t} className="mt-4" />
		</div>
	)
}
