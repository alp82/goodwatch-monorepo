// PROTOTYPE - throwaway.
// The band as the signature header, the versus lines painted with the band's stripes, then the compact is/isn't row.
import { HEX, type Pillar } from "~/ui/details/DetailsFingerprint"
import type { VariantProps } from "../types"
import { SectionTitle } from "./strip-parts"
import { GoodForLine, areaOf } from "./versus-parts"
import {
	AreaEvidence,
	Band,
	BandLegend,
	IsIsntRow,
	LineEvidence,
	Popover,
	VersusLines,
	WordEvidence,
	bandGradient,
	usePick,
	versusData,
} from "./versus2-parts"

export default function BandVersus({ t, media }: VariantProps) {
	const s = t.fingerprint.scores
	const { lines, is, isnt } = versusData(t, media)
	const { pick, anchor, refs, toggle, close } = usePick()
	const onArea = (p: Pillar, el: HTMLElement) => toggle({ kind: "area", p }, refs.current[p] ?? el)

	// Lines and band light each other up: a line shows its area in the band, an area keeps its lines bright.
	let focus: Pillar | null = null
	let card: { label: string; color: string; body: React.ReactNode } | null = null
	if (pick?.kind === "area") {
		focus = pick.p
		card = { label: `${pick.p} in detail`, color: HEX[pick.p], body: <AreaEvidence t={t} p={pick.p} links /> }
	} else if (pick?.kind === "line" && lines[pick.i]) {
		const l = lines[pick.i]
		focus = areaOf(l.hi)
		card = { label: `${l.a}, ${l.conj} ${l.b}`, color: HEX[focus], body: <LineEvidence line={l} s={s} /> }
	} else if (pick?.kind === "is" && is[pick.i]) {
		focus = areaOf(is[pick.i].key)
		card = { label: is[pick.i].word, color: HEX[focus], body: <WordEvidence w={is[pick.i]} s={s} isnt={false} t={t} /> }
	} else if (pick?.kind === "isnt" && isnt[pick.i]) {
		card = { label: `Not ${isnt[pick.i].word}`, color: "#78716c", body: <WordEvidence w={isnt[pick.i]} s={s} isnt t={t} /> }
	}
	const paint = (p: Pillar) => ({ backgroundImage: bandGradient(p, s, t.title, 40) })
	const clip = { WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const

	return (
		<div>
			<SectionTitle t={t} />
			<div className="mt-5">
				<Band t={t} focus={focus} onPick={onArea} refs={refs} className="h-14 sm:h-16" />
				<BandLegend t={t} focus={focus} onPick={onArea} size="sm" />
			</div>
			<div className="mt-7">
				<VersusLines
					lines={lines}
					pick={pick}
					onPick={toggle}
					refs={refs}
					paint={(l) => paint(areaOf(l.hi))}
					dimOthers={pick?.kind === "area" ? pick.p : false}
				/>
			</div>
			<div className="mt-6 border-t border-white/8 pt-5">
				<IsIsntRow is={is} isnt={isnt} pick={pick} onPick={toggle} refs={refs} textStyle={(w) => ({ ...paint(areaOf(w.key)), ...clip, textDecorationColor: HEX[areaOf(w.key)] })} />
			</div>
			<GoodForLine t={t} className="mt-5" />
			{card && (
				<Popover anchor={anchor} onClose={close} label={card.label} color={card.color} side={pick?.kind === "line"} width={pick?.kind === "area" ? 360 : 340}>
					{card.body}
				</Popover>
			)}
		</div>
	)
}
