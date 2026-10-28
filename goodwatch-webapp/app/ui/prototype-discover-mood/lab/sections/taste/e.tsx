// PROTOTYPE - throwaway. Your taste e, "Taste shelf": Watch next's taste picker brought to Discover. One shelf of
// picture tiles mixes the member's taste groups and the words their taste carries most (pick up to three, by
// Discover's rule), and one row under it holds Taste match, your lists and Best match. A guest sees the shelf's shape
// with one Sign up.
import { BarsArrowDownIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { Segmented } from "~/ui/filter-bar/SheetControls"
import type { SectionProps } from "../../types"
import {
	ArtTile,
	BlockHead,
	ClearLink,
	LIST_SCOPES,
	type ListScope,
	LockedTile,
	MAX_PICKS,
	MatchSteps,
	ScopeRows,
	SignUpChip,
	TasteSwitch,
	groupHues,
	groupLine,
	titlesFoot,
	useTaste,
} from "./def-parts"

export function TasteE({ d, phone, viewer }: SectionProps) {
	const taste = useTaste(d, viewer)
	const { member } = taste
	const locked = !member
	const tileH = phone ? "h-[78px]" : "h-[88px]"

	const shelf = (
		<section className="min-w-0">
			<BlockHead
				locked={locked}
				note={member ? `${taste.picks} of ${MAX_PICKS}` : undefined}
				right={
					locked ? (
						<SignUpChip label="Sign up for your taste" />
					) : (
						taste.picks > 0 && (
							<ClearLink
								onClick={() => {
									taste.groups.clear()
									taste.words.clear()
								}}
							/>
						)
					)
				}
			>
				For you
			</BlockHead>
			<div className={`grid gap-2 ${phone ? "grid-cols-2" : "grid-cols-5"}`}>
				{member ? (
					<>
						{taste.groups.all.map((g) => (
							<ArtTile
								key={g.id}
								name={g.name}
								line={phone ? null : `Your taste · ${groupLine(g)}`}
								hues={groupHues(g)}
								path={g.loved[0].backdrop}
								on={taste.groups.isOn(g)}
								dim={taste.full && !taste.groups.isOn(g)}
								foot={titlesFoot(taste.groups.count(g))}
								onClick={() => taste.groups.toggle(g)}
								className={tileH}
							/>
						))}
						{taste.words.all.map((w) => {
							const on = taste.words.isOn(w.tag)
							const c = taste.words.count(w.tag)
							return (
								<ArtTile
									key={w.tag.key}
									name={w.tag.name}
									line={
										phone
											? null
											: (w.tag.description ??
												(w.tag.group === "themes" ? "About" : "Style"))
									}
									hues={[w.tag.color]}
									path={w.shot.backdrop}
									on={on}
									dim={(taste.full && !on) || (!on && c === 0)}
									foot={titlesFoot(c)}
									onClick={() => taste.words.toggle(w.tag)}
									className={tileH}
								/>
							)
						})}
					</>
				) : (
					Array.from({ length: 10 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed stand-ins
						<LockedTile key={i} i={i % 4} className={tileH} />
					))
				)}
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
			<MatchSteps taste={taste} compact phone={phone} />
		</section>
	)
	const lists = (
		<section className="min-w-0">
			<BlockHead>Your lists</BlockHead>
			{phone ? (
				<ScopeRows taste={taste} />
			) : (
				<div className="flex h-12 items-center">
					<Segmented<ListScope>
						label="Your lists"
						value={taste.list.value}
						options={LIST_SCOPES.map((o) => ({
							id: o.id,
							label: o.id === "wishlist" ? "Wishlist" : o.label,
						}))}
						onChange={taste.list.set}
					/>
				</div>
			)}
		</section>
	)
	const best = (
		<section className="min-w-0">
			<BlockHead locked={locked}>Order</BlockHead>
			<TasteSwitch
				label="Best match"
				on={taste.order.best}
				onChange={taste.order.setBest}
				locked={locked}
				icon={
					<BarsArrowDownIcon
						className="h-4 w-4 shrink-0 text-amber-400"
						aria-hidden
					/>
				}
				className="h-12 w-full"
			/>
		</section>
	)

	if (phone)
		return (
			<div className="space-y-6">
				{shelf}
				{match}
				{lists}
				{best}
			</div>
		)
	return (
		<div className="flex h-full flex-col gap-4 px-7 py-5">
			{shelf}
			<div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_200px] gap-8 border-t border-white/[0.06] pt-3">
				{match}
				{lists}
				{best}
			</div>
		</div>
	)
}
