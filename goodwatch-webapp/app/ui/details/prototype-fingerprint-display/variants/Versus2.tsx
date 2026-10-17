// PROTOTYPE - throwaway.
// Versus, full width: three big contrast lines, then what it also is and what it isn't as two compact lines; evidence floats.
import { HEX } from "~/ui/details/DetailsFingerprint"
import type { VariantProps } from "../types"
import { SectionTitle } from "./strip-parts"
import { GoodForLine, areaOf } from "./versus-parts"
import { IsIsntRow, LineEvidence, Popover, VersusLines, WordEvidence, usePick, versusData } from "./versus2-parts"

export default function Versus2({ t, media }: VariantProps) {
	const s = t.fingerprint.scores
	const { lines, is, isnt } = versusData(t, media)
	const { pick, anchor, refs, toggle, close } = usePick()

	let card: { label: string; color: string; body: React.ReactNode } | null = null
	if (pick?.kind === "line" && lines[pick.i]) {
		const l = lines[pick.i]
		card = { label: `${l.a}, ${l.conj} ${l.b}`, color: HEX[areaOf(l.hi)], body: <LineEvidence line={l} s={s} /> }
	} else if (pick?.kind === "is" && is[pick.i]) {
		card = { label: is[pick.i].word, color: HEX[areaOf(is[pick.i].key)], body: <WordEvidence w={is[pick.i]} s={s} isnt={false} t={t} /> }
	} else if (pick?.kind === "isnt" && isnt[pick.i]) {
		card = { label: `Not ${isnt[pick.i].word}`, color: "#78716c", body: <WordEvidence w={isnt[pick.i]} s={s} isnt t={t} /> }
	}

	return (
		<div>
			<SectionTitle t={t} />
			<div className="mt-5">
				<VersusLines lines={lines} pick={pick} onPick={toggle} refs={refs} />
			</div>
			<div className="mt-6 border-t border-white/8 pt-5">
				<IsIsntRow is={is} isnt={isnt} pick={pick} onPick={toggle} refs={refs} />
			</div>
			<GoodForLine t={t} className="mt-5" />
			{card && (
				<Popover anchor={anchor} onClose={close} label={card.label} color={card.color} side={pick?.kind === "line"}>
					{card.body}
				</Popover>
			)}
		</div>
	)
}
