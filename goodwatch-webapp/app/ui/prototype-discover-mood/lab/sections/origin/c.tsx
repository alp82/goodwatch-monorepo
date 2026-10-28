// PROTOTYPE (Discover lab, origin c): Hollywood or the world, then flags. Two big cards on the left set the broad
// choice; the right is a wall of flag tiles for the countries that make the most titles, each with its count. The
// search swaps the wall for every matching country.
import { CheckIcon, GlobeAltIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useState } from "react"
import { productionCountryName } from "~/domain/production-country"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { SearchField } from "~/ui/filter-bar/SheetControls"
import type { SectionProps } from "../../types"
import { Flag, HOLLYWOOD, POPULAR, WORLD, searchCountries, useAllCountries, useOrigin, useOriginCounts } from "./parts"

const WALL = POPULAR.filter((c) => c !== "US")

function BigCard({
	on,
	onClick,
	icon,
	title,
	note,
	count,
	phone,
}: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; note: string; count: number | null; phone: boolean }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={on}
			onClick={onClick}
			className={`relative flex min-w-0 flex-1 flex-col justify-between rounded-2xl text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${phone ? "h-24 p-3" : "p-4"} ${
				on ? "bg-white/[0.12] ring-1 ring-white/40" : "bg-white/[0.035] ring-1 ring-white/[0.06] hover:bg-white/[0.07]"
			}`}
		>
			<span className="flex items-center gap-3">
				{icon}
				<span className="min-w-0">
					<span className="block text-[15px] font-semibold text-white">{title}</span>
					<span className="block truncate text-[12px] text-gray-500">{note}</span>
				</span>
			</span>
			<span className="text-[13px] tabular-nums text-gray-400">{count != null ? `${count.toLocaleString("en")} titles` : " "}</span>
			{on && (
				<span className="absolute top-3 right-3 grid h-5 w-5 place-items-center rounded-full bg-white text-gray-950">
					<CheckIcon className="h-3.5 w-3.5" />
				</span>
			)}
		</motion.button>
	)
}

function FlagTile({ code, on, count, onClick }: { code: string; on: boolean; count: number | null; onClick: () => void }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={on}
			onClick={onClick}
			className={`relative flex min-w-0 items-center gap-2.5 rounded-xl p-2 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on ? "bg-white/[0.12] ring-1 ring-white/40" : "bg-white/[0.035] ring-1 ring-white/[0.06] hover:bg-white/[0.07]"
			}`}
		>
			<Flag code={code} className="h-7 w-10 rounded-[5px]" />
			<span className="min-w-0">
				<span className={`block truncate text-[13px] ${on ? "font-semibold text-white" : "text-gray-200"}`}>{productionCountryName(code)}</span>
				<span className="block text-[11px] tabular-nums text-gray-500">{count != null ? compactCount(count) : " "}</span>
			</span>
			{on && (
				<span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-gray-950">
					<CheckIcon className="h-3.5 w-3.5" />
				</span>
			)}
		</motion.button>
	)
}

export function OriginC({ d, phone }: SectionProps) {
	const o = useOrigin(d)
	const [search, setSearch] = useState("")
	const all = useAllCountries(o.chosen)
	const counts = useOriginCounts(d, [HOLLYWOOD, WORLD, ...WALL.map((c) => [c])])
	const countOf = (code: string) => {
		const i = WALL.indexOf(code)
		return i < 0 ? null : counts[2 + i]
	}
	const term = search.trim()
	const extra = o.chosen.filter((c) => !WALL.includes(c) && c !== "US" && !o.isOnly(WORLD))
	const wall = term ? searchCountries(all.list, term).map((c) => c.code).slice(0, 48) : [...extra, ...WALL]
	const hollywood = o.isOnly(HOLLYWOOD)
	const world = o.isOnly(WORLD)

	return (
		<div className={phone ? "space-y-4" : "flex h-full gap-6 px-7 py-5"}>
			<div className={phone ? "flex gap-2" : "flex w-[300px] shrink-0 flex-col gap-3"}>
				<BigCard
					phone={phone}
					on={hollywood}
					onClick={() => o.only(HOLLYWOOD)}
					icon={<Flag code="US" className="h-7 w-10 rounded-[5px]" />}
					title="Hollywood"
					note="Made in the US"
					count={counts[0]}
				/>
				<BigCard
					phone={phone}
					on={world}
					onClick={() => o.only(WORLD)}
					icon={<GlobeAltIcon className="h-7 w-7 shrink-0 text-sky-300" />}
					title="World cinema"
					note={`${WORLD.length} countries outside the US`}
					count={counts[1]}
				/>
			</div>
			<div className={phone ? "space-y-3" : "flex min-w-0 flex-1 flex-col gap-3"}>
				<div className="flex items-center gap-2">
					<div className="min-w-0 flex-1">
						<SearchField value={search} onChange={setSearch} placeholder="Find a country" />
					</div>
					{o.chosen.length > 0 && (
						<button
							type="button"
							onClick={o.clear}
							className="h-9 shrink-0 rounded-xl bg-white/[0.05] px-3 text-[13px] text-gray-300 cursor-pointer ring-1 ring-white/[0.06] hover:text-white"
						>
							Any country
						</button>
					)}
				</div>
				<div className={phone ? "grid grid-cols-2 gap-2" : "-mx-1 grid min-h-0 flex-1 auto-rows-min grid-cols-5 gap-2 overflow-y-auto overscroll-contain px-1 pt-1.5"}>
					{wall.map((code) => (
						<FlagTile key={code} code={code} on={o.has(code) && !world} count={countOf(code)} onClick={() => (world ? o.set([code]) : o.toggle(code))} />
					))}
					{term && !wall.length && <p className="col-span-full text-[13px] text-gray-500">{all.loading ? "Loading countries…" : "No matching country."}</p>}
				</div>
			</div>
		</div>
	)
}
