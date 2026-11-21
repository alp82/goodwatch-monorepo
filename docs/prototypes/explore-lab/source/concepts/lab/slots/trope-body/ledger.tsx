// PROTOTYPE - throwaway (prototype/explore-r9). Trope examples, variant "Ledger": no big cases, every example as a
// compact row (poster, title, twist, the whole write-up), two columns on wide screens, twelve to a page.
import type { SlotVariant } from "../../contract"
import type { BodyProps } from "../trope/body"
import { PageFade, Paging, Row, usePaged } from "../trope/pieces"

const PER = 12

function Ledger({ d, cases, noun, tools }: BodyProps) {
	const paged = usePaged(cases, PER)
	const tint = d.trope.color
	return (
		<div>
			<div ref={paged.top} className="flex scroll-mt-32 flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="font-display text-2xl font-bold text-white">Every example</h2>
					<p className="mt-1 text-[15px] text-gray-400">
						{cases.length} {noun}, strongest first.
					</p>
				</div>
				<Paging paged={paged} total={cases.length} per={PER} label="examples" extra={tools} />
			</div>
			<PageFade k={paged.page}>
				<ol className="mt-3 grid gap-x-8 border-t border-white/[0.07] xl:grid-cols-2">
					{paged.slice.map((e, i) => (
						<li key={e.title.card.key} className="border-b border-white/[0.07]">
							<Row e={e} n={paged.from + i + 1} tint={tint} />
						</li>
					))}
				</ol>
			</PageFade>
			<div className="mt-4 flex justify-end">
				<Paging paged={paged} total={cases.length} per={PER} label="examples" />
			</div>
		</div>
	)
}

export const variant: SlotVariant<never, BodyProps> = {
	id: "ledger",
	name: "Ledger",
	what: "Every example as a compact row (small poster, title, twist, the whole write-up), two columns on wide screens, twelve to a page. Dense and quick to scan.",
	order: 2,
	View: Ledger,
}
