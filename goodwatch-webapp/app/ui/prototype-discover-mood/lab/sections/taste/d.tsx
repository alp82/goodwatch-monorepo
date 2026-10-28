// PROTOTYPE - throwaway. Your taste d, "Taste board": four labeled blocks side by side. Close to your taste (the
// member's taste groups as picture tiles) with their strongest words under it, Taste match with the order next to it,
// and which of your lists to look in. A guest sees the same blocks faint, with one Sign up.
import { BarsArrowDownIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import type { SectionProps } from "../../types"
import {
	ArtTile,
	BlockHead,
	ClearLink,
	LockedChip,
	LockedTile,
	MAX_PICKS,
	MatchSteps,
	ScopeRows,
	SignUpChip,
	TasteSwitch,
	WordChip,
	groupHues,
	groupLine,
	titlesFoot,
	useTaste,
} from "./def-parts"

export function TasteD({ d, phone, viewer }: SectionProps) {
	const taste = useTaste(d, viewer)
	const { member } = taste
	const locked = !member

	const groups = (
		<section className="min-w-0">
			<BlockHead
				locked={locked}
				note={member ? `${taste.picks} of ${MAX_PICKS}` : undefined}
				right={locked ? <SignUpChip label="Sign up for your taste" /> : taste.groups.all.some(taste.groups.isOn) && <ClearLink onClick={taste.groups.clear} />}
			>
				Close to your taste
			</BlockHead>
			<div className="grid grid-cols-2 gap-2">
				{member
					? taste.groups.all.map((g) => (
							<ArtTile
								key={g.id}
								name={g.name}
								line={phone ? null : groupLine(g)}
								hues={groupHues(g)}
								path={g.loved[0].backdrop}
								on={taste.groups.isOn(g)}
								dim={taste.full && !taste.groups.isOn(g)}
								foot={titlesFoot(taste.groups.count(g))}
								onClick={() => taste.groups.toggle(g)}
								className={phone ? "h-[80px]" : "h-[84px]"}
							/>
						))
					: [0, 1, 2, 3].map((i) => <LockedTile key={i} i={i} className={phone ? "h-[80px]" : "h-[84px]"} />)}
			</div>
		</section>
	)
	const words = (
		<section className="min-w-0">
			<BlockHead locked={locked} right={member && taste.words.all.some((w) => taste.words.isOn(w.tag)) && <ClearLink onClick={taste.words.clear} />}>
				Your strongest
			</BlockHead>
			<div className={`flex gap-1.5 ${phone ? "-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" : "flex-wrap"}`}>
				{member
					? taste.words.all.map((w) => <WordChip key={w.tag.key} taste={taste} t={w.tag} dim={taste.full} />)
					: [92, 76, 104, 70, 84, 96].map((w, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed stand-ins
							<LockedChip key={i} w={w} />
						))}
			</div>
		</section>
	)
	const match = (
		<section className="min-w-0">
			<BlockHead locked={locked}>
				<span className="flex items-center gap-2">
					<FingerPrintIcon className="h-5 w-5 text-amber-500" aria-hidden />
					Taste match
				</span>
			</BlockHead>
			<MatchSteps taste={taste} compact={phone} phone={phone} />
		</section>
	)
	const order = (
		<section className="min-w-0">
			<BlockHead locked={locked}>Order</BlockHead>
			<div className="grid grid-cols-2 gap-2">
				<TasteSwitch
					label="Best match"
					on={taste.order.best}
					onChange={taste.order.setBest}
					locked={locked}
					icon={<BarsArrowDownIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />}
				/>
				<TasteSwitch
					label="For you"
					on={taste.order.forYou}
					onChange={taste.order.setForYou}
					locked={locked}
					icon={<FingerPrintIcon className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />}
				/>
			</div>
		</section>
	)
	const lists = (
		<section className="min-w-0">
			<BlockHead>Your lists</BlockHead>
			<ScopeRows taste={taste} rowClass={phone ? "h-11" : "h-[46px]"} />
		</section>
	)

	if (phone)
		return (
			<div className="space-y-6">
				{groups}
				{words}
				{match}
				{order}
				{lists}
			</div>
		)
	return (
		<div className="grid h-full grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.75fr)] gap-8 px-7 py-5">
			<div className="flex min-w-0 flex-col gap-5">
				{groups}
				{words}
			</div>
			<div className="flex min-w-0 flex-col gap-6 border-l border-white/[0.06] pl-8">
				{match}
				{order}
			</div>
			<div className="min-w-0 border-l border-white/[0.06] pl-8">{lists}</div>
		</div>
	)
}
