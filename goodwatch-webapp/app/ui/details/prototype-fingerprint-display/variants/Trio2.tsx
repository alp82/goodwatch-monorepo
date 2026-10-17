// PROTOTYPE - throwaway.
// Trio refined: taller band on top, bold headline left, sliders right; selecting an area swaps the sliders for its details in place and the headline follows.
import { PILLARS } from "~/ui/details/DetailsFingerprint"
import type { VariantProps } from "../types"
import { GROUPS } from "./bandsliders-parts"
import { SectionTitle } from "./strip-parts"
import {
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

const BOLD = "text-[1.45rem] leading-[1.2] sm:text-[1.9rem] lg:text-[2.1rem]"

export default function Trio2({ t }: VariantProps) {
	const x = useAreaSelection()
	const [feel, story, look] = GROUPS
	const active = x.sel ?? "all"
	const mini = (sc: (typeof feel.scales)[number]) => (
		<li key={sc.name} className="min-w-0">
			<TrioSlider sc={sc} t={t} x={x} />
		</li>
	)

	const sliders = (
		<div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:gap-x-8">
			<section className="col-span-2 sm:col-span-1">
				<h3 className={GROUP_HEAD}>{feel.name}</h3>
				<ul className="mt-0.5 grid grid-cols-2 gap-x-5 sm:grid-cols-1">{feel.scales.map(mini)}</ul>
			</section>
			<div className="col-span-2 grid grid-cols-2 gap-x-5 gap-y-3 sm:col-span-1 sm:grid-cols-1">
				<section className="col-span-2 sm:col-span-1">
					<h3 className={GROUP_HEAD}>{story.name}</h3>
					<ul className="mt-0.5 grid grid-cols-2 items-end gap-x-5 sm:grid-cols-1">{story.scales.map(mini)}</ul>
				</section>
				<section className="col-span-2 sm:col-span-1">
					<h3 className={GROUP_HEAD}>{look.name}</h3>
					<ul className="mt-0.5 grid grid-cols-2 gap-x-5 sm:grid-cols-1">{look.scales.map(mini)}</ul>
				</section>
			</div>
		</div>
	)

	return (
		<div>
			<SectionTitle t={t} />

			<div className="mt-4">
				<TrioBand t={t} x={x} />
			</div>

			<div className="mt-6 grid gap-x-14 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<Swap
					active={active}
					panes={[
						{
							id: "all",
							node: (
								<div className="flex h-full flex-col">
									<Headline segs={composeHeadline(t)} x={x} className={BOLD} />
									<GoodForLine t={t} className="mt-auto pt-5" />
								</div>
							),
						},
						...PILLARS.map((p) => ({
							id: p,
							node: (
								<div className="flex h-full flex-col">
									<Lines lines={areaLines(t, p)} x={x} className={`${BOLD} space-y-1`} />
									<ul className="mt-auto max-w-md pt-5">
										{scalesOf(p).map((sc) => (
											<li key={sc.name}>
												<TrioSlider sc={sc} t={t} x={x} layout="row" />
											</li>
										))}
									</ul>
								</div>
							),
						})),
					]}
				/>

				<Swap
					active={active}
					panes={[
						{ id: "all", node: sliders },
						...PILLARS.map((p) => ({
							id: p,
							label: `${p} details`,
							node: (
								<div className="flex h-full flex-col">
									<AreaHeader t={t} p={p} x={x} />
									<AreaVerdict t={t} p={p} className="mt-3" />
									<TraitBars t={t} p={p} className="mt-5 sm:grid-cols-2" />
									<div className="mt-auto pt-5">
										<AreaLinks t={t} p={p} />
									</div>
								</div>
							),
						})),
					]}
				/>
			</div>
		</div>
	)
}
