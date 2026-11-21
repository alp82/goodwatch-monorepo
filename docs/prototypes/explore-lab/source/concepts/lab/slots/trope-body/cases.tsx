// PROTOTYPE - throwaway (prototype/explore-r9). Trope examples, variant "Casebook": round 8's numbered cases, cut to
// the three strongest, then every other example as compact rows paged eight at a time. Every title once, every
// write-up whole.
import type { SlotVariant } from "../../contract"
import type { BodyProps } from "../trope/body"
import { Case, PageFade, Paging, Row, usePaged } from "../trope/pieces"

const LEAD = 3
const PER = 8

function Cases({ d, cases, noun, tools }: BodyProps) {
	const lead = cases.slice(0, LEAD)
	const rest = cases.slice(LEAD)
	const paged = usePaged(rest, PER)
	const tint = d.trope.color
	return (
		<div>
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="font-display text-2xl font-bold text-white">The strongest cases</h2>
					<p className="mt-1 text-[15px] text-gray-400">The {noun} where it's clearest.</p>
				</div>
				{tools}
			</div>
			<ol className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">
				{lead.map((e, i) => (
					<li key={e.title.card.key}>
						<Case e={e} n={i + 1} tint={tint} />
					</li>
				))}
			</ol>
			{rest.length > 0 && (
				<section className="mt-10" aria-labelledby="more-cases">
					<div
						ref={paged.top}
						className="flex scroll-mt-32 flex-wrap items-center justify-between gap-3"
					>
						<h3 id="more-cases" className="font-display text-xl font-bold text-white">
							More cases
						</h3>
						<Paging paged={paged} total={rest.length} per={PER} label="cases" />
					</div>
					<PageFade k={paged.page}>
						<ol className="mt-2 divide-y divide-white/[0.07]">
							{paged.slice.map((e, i) => (
								<li key={e.title.card.key}>
									<Row e={e} n={LEAD + paged.from + i + 1} tint={tint} />
								</li>
							))}
						</ol>
					</PageFade>
					<div className="mt-3 flex justify-end border-t border-white/[0.07] pt-4">
						<Paging paged={paged} total={rest.length} per={PER} label="cases" />
					</div>
				</section>
			)}
		</div>
	)
}

export const variant: SlotVariant<never, BodyProps> = {
	id: "cases",
	name: "Casebook",
	what: "The three strongest cases big (still, title, twist, the write-up as a quote), then every other example as a compact row, eight to a page with Prev and Next.",
	order: 1,
	View: Cases,
}
