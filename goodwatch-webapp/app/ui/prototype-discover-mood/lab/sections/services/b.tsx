// PROTOTYPE (Discover lab, services b): a rail and a logo wall. The pill stands upright on the left with each mode's
// count, Not seen yet under it. The right side is the country's services as big logo tiles sorted by what they
// carry, with the country and the search always open above them.
import { CheckIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useState } from "react"
import { productionCountryName } from "~/domain/production-country"
import { NotSeenSwitch } from "~/ui/filter-bar/controls"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { More, SearchField } from "~/ui/filter-bar/SheetControls"
import type { SectionProps } from "../../types"
import { CountrySelect, ModePill, type Services, cleanName, logo, useServiceSearch, useServices } from "./parts"

function Tile({ sv, p }: { sv: Services; p: Services["providers"][number] }) {
	const on = sv.isOn(p.id)
	const dim = sv.mode !== "any" && !sv.anyService && !on
	const n = sv.countOf(p.id)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={on}
			onClick={() => sv.pick(p.id)}
			className={`relative flex min-w-0 items-center gap-2.5 rounded-xl p-2 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on ? "bg-emerald-500/15 ring-1 ring-emerald-400/60" : "bg-white/[0.035] ring-1 ring-white/[0.06] hover:bg-white/[0.07]"
			}`}
		>
			<img src={logo(p.logo_path)} alt="" loading="lazy" className={`h-10 w-10 shrink-0 rounded-[28%] object-cover transition-opacity ${dim ? "opacity-45 grayscale" : ""}`} />
			<span className="min-w-0">
				<span className={`block truncate text-[13px] ${on ? "font-semibold text-white" : "text-gray-200"}`}>{cleanName(p.name)}</span>
				<span className="block text-[11px] tabular-nums text-gray-500">{n != null ? compactCount(n) : " "}</span>
			</span>
			{on && (
				<span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-gray-950">
					<CheckIcon className="h-3.5 w-3.5" />
				</span>
			)}
		</motion.button>
	)
}

export function ServicesB({ d, pieces, phone }: SectionProps) {
	const sv = useServices(d, pieces)
	const find = useServiceSearch(sv)
	const [all, setAll] = useState(false)
	const limit = phone ? 9 : 18
	const keep = Math.max(limit, sv.chosen.length)
	const shown = find.term || all ? find.matches.slice(0, 120) : find.matches.slice(0, keep)
	const rest = find.matches.length - shown.length

	const tiles = (
		<>
			<div className={`grid gap-2 ${phone ? "grid-cols-2" : "grid-cols-6"}`}>
				{shown.map((p) => (
					<Tile key={p.id} sv={sv} p={p} />
				))}
			</div>
			{!sv.providers.length && <p className="py-2 text-[13px] text-gray-500">Loading services…</p>}
			{find.term && !find.matches.length && <p className="py-2 text-[13px] text-gray-500">No service called “{find.search}” here.</p>}
			{!find.term && (rest > 0 || all) && (
				<div className="mt-2">
					<More hidden={rest} open={all} onClick={() => setAll(!all)} />
				</div>
			)}
		</>
	)

	const head = (
		<div className="flex items-center gap-2">
			<CountrySelect sv={sv} className={phone ? "w-36 shrink-0" : "w-56"} />
			<div className="min-w-0 flex-1">
				<SearchField value={find.search} onChange={find.setSearch} placeholder={`Find a service in ${productionCountryName(sv.country)}`} />
			</div>
			{!phone && sv.mode === "pick" && (
				<button
					type="button"
					onClick={() => sv.setMode("pick")}
					aria-pressed={sv.anyService}
					className={`h-9 shrink-0 rounded-xl px-3 text-[13px] cursor-pointer ring-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${sv.anyService ? "bg-white font-semibold text-gray-950 ring-white" : "bg-white/[0.05] text-gray-300 ring-white/[0.06] hover:text-white"}`}
				>
					Any service
				</button>
			)}
		</div>
	)

	if (phone)
		return (
			<div className="space-y-4">
				<ModePill sv={sv} phone />
				<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
				{head}
				{tiles}
			</div>
		)

	return (
		<div className="flex h-full gap-6 px-7 py-5">
			<div className="flex w-[280px] shrink-0 flex-col gap-3">
				<ModePill sv={sv} vertical />
				<NotSeenSwitch {...pieces.notSeenProps} className="w-full" />
				<p className="mt-auto text-[12px] text-gray-500">
					Streaming in <span className="font-semibold text-gray-300">{productionCountryName(sv.country)}</span>
				</p>
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-3">
				{head}
				<div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pt-1.5 pb-1">{tiles}</div>
			</div>
		</div>
	)
}
