// PROTOTYPE (Discover lab) Age c: the real Age and content card as Discover has it today, mounted alone (OneCard), to
// compare with a and b.
import { OneCard } from "../../shell-parts"
import type { SectionProps } from "../../types"
import { pad } from "../released/parts"
import { NoLadder } from "./parts"

export function AgeC({ pieces, phone }: SectionProps) {
	if (!pieces.groups.ladder) return <NoLadder />
	return (
		<div className={`${pad(phone)} ${phone ? "" : "overflow-y-auto"}`}>
			<div className={phone ? "" : "max-w-[640px]"}>
				<OneCard pieces={pieces} k="ageLimit" />
			</div>
		</div>
	)
}
