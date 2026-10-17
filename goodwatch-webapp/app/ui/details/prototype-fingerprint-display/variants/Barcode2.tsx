// PROTOTYPE - throwaway.
// Barcode, improved: honest segment widths, richer band with sheen and a one-time reveal, words in a legend, evidence floats.
import { HEX } from "~/ui/details/DetailsFingerprint"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"
import { SectionTitle, tagline } from "./strip-parts"
import { GoodForLine, SCALES } from "./versus-parts"
import { AreaEvidence, Band, BandLegend, MiniSlider, Popover, usePick } from "./versus2-parts"

export default function Barcode2({ t, media }: VariantProps) {
	const s = t.fingerprint.scores
	const { pick, anchor, refs, toggle, close } = usePick()
	const focus = pick?.kind === "area" ? pick.p : null
	const onArea = (p: Parameters<typeof AreaEvidence>[0]["p"], el: HTMLElement) => toggle({ kind: "area", p }, refs.current[p] ?? el)

	return (
		<div>
			<SectionTitle t={t} />
			<p className="mt-3 text-2xl font-semibold tracking-tight text-amber-200 sm:text-[1.7rem]">{tagline(t, media)}.</p>
			<p className="mt-1 max-w-3xl text-gray-300">{F.summary(t)}</p>

			<div className="mt-6">
				<Band t={t} focus={focus} onPick={onArea} refs={refs} className="h-20 sm:h-28" />
				<BandLegend t={t} focus={focus} onPick={onArea} />
			</div>

			<ul className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/8 pt-6 lg:grid-cols-4 lg:gap-x-10">
				{SCALES.map((sc) => (
					<MiniSlider key={sc.name} sc={sc} s={s} />
				))}
			</ul>
			<GoodForLine t={t} className="mt-6" />

			{focus && (
				<Popover anchor={anchor} onClose={close} label={`${focus} in detail`} color={HEX[focus]} width={360}>
					<AreaEvidence t={t} p={focus} links />
				</Popover>
			)}
		</div>
	)
}
