// PROTOTYPE (Discover lab, round 15): layout d's You hub. Taste is taste f without its lists (groups, match, order);
// Lists holds Not seen yet, Seen before, On your wishlist and On my services (Watch > Services keeps the full picker).
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { ServiceStack } from "~/ui/filter-bar/controls"
import { compactCount } from "~/ui/filter-bar/labels"
import { BlockHead, useTaste } from "./sections/taste/def-parts"
import { ListPill, TasteFPart, YourLists } from "./sections/taste/f"
import { cleanName, logo, useServices } from "./sections/services/parts"
import type { SectionProps } from "./types"

export function YouTaste(props: SectionProps) {
	return <TasteFPart {...props} part="taste" />
}

export function YouLists({ d, pieces, phone, viewer, open }: SectionProps) {
	const taste = useTaste(d, viewer)
	const sv = useServices(d, pieces, viewer)
	const locked = viewer === "guest"
	const on = sv.mode === "mine"
	const all = sv.totals.all
	const mine = sv.totals.mine
	const services = (
		<section className="min-w-0">
			<BlockHead>Your services</BlockHead>
			<div className="flex flex-col gap-2">
				<ListPill
					id="mine"
					icon={
						sv.mine.length ? (
							<ServiceStack providers={sv.mine} on={on} size={18} />
						) : undefined
					}
					label="On my services"
					on={on}
					hides={
						locked || all == null || mine == null
							? null
							: Math.max(0, all - mine)
					}
					onChange={(next) => sv.setMode(next ? "mine" : "any")}
					locked={locked}
				/>
				{!locked && (
					<div className="flex flex-col">
						{sv.mine.map((p) => (
							<span
								key={p.id}
								className="flex h-10 items-center gap-2.5 px-3 text-[13px] text-gray-300"
							>
								<img
									src={logo(p.logo_path)}
									alt=""
									loading="lazy"
									className="h-6 w-6 shrink-0 rounded-[28%] object-cover"
								/>
								<span className="min-w-0 flex-1 truncate">
									{cleanName(p.name)}
								</span>
								<span className="text-[12px] tabular-nums text-gray-500">
									{sv.countOf(p.id) != null
										? compactCount(sv.countOf(p.id) ?? 0)
										: ""}
								</span>
							</span>
						))}
					</div>
				)}
				<button
					type="button"
					onClick={() => open("watch", "services")}
					className="flex h-9 items-center gap-1 self-start rounded-lg px-3 text-[13px] font-semibold text-gray-400 cursor-pointer outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					All services
					<ChevronRightIcon className="h-4 w-4" aria-hidden />
				</button>
			</div>
		</section>
	)
	const lists = <YourLists taste={taste} locked={locked} />
	if (phone)
		return (
			<div className="space-y-6">
				{lists}
				{services}
			</div>
		)
	return (
		<div className="grid h-full grid-cols-[minmax(0,22rem)_minmax(0,22rem)_1fr] gap-8 px-7 py-5">
			{lists}
			<div className="min-w-0 border-l border-white/[0.06] pl-8">
				{services}
			</div>
		</div>
	)
}
