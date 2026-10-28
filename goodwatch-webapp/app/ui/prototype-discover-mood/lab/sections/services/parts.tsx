// PROTOTYPE (Discover lab, services): shared pieces for the services variants. The mode choice uses the filter bar's
// "On my services" pill (green with stacked logos, next to Everywhere), widened to today's three Streaming card modes:
// My services, Everywhere, Streaming in… (any service in a country, a tap narrows to the ones picked).
import { GlobeAltIcon, MagnifyingGlassIcon, PlusIcon, TvIcon } from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { motion } from "framer-motion"
import { useId, useState } from "react"
import { type FilterState } from "~/domain/filter-state"
import { productionCountryName } from "~/domain/production-country"
import { useCountries } from "~/routes/api.countries"
import { ServiceStack } from "~/ui/filter-bar/controls"
import { compactCount } from "~/ui/filter-bar/labels"
import { SHELL, SPRING, TAP } from "~/ui/filter-bar/motion"
import { PROVIDER_LOGO } from "~/ui/filter-bar/useFilterData"
import { SERVICES_PATH } from "~/ui/settings/paths"
import type { ProtoDiscover } from "../../../kit"
import type { Pieces } from "../../types"

export type Mode = "mine" | "any" | "pick"

export const modeOf = (s: FilterState): Mode => (s.onMyServices ? "mine" : s.anyService || s.services?.length ? "pick" : "any")
export const cleanName = (n: string) => n.replace(/ (Amazon Channel|Apple TV Channel)$/, "")

/** Everything the services variants read and write. */
export function useServices(d: ProtoDiscover, pieces: Pieces) {
	const navigate = useNavigate()
	const s = d.filters.state
	const mode = modeOf(s)
	const mine = pieces.services.ids
	const hasMine = pieces.hasServices
	const chosen = s.onMyServices ? mine : (s.services ?? [])
	const rank = (id: number) => (chosen.includes(id) ? 0 : mine.includes(id) ? 1 : 2)
	const providers = pieces.services.countryProviders
		.map((p, i) => ({ p, i }))
		.sort((a, b) => rank(a.p.id) - rank(b.p.id) || a.i - b.i)
		.map(({ p }) => p)
	const counts = d.counts?.optionCounts.services ?? {}
	const countOf = (id: number | string): number | null => counts[String(id)] ?? null
	const setMode = (m: Mode) => {
		if (m === "mine" && !hasMine) return navigate(SERVICES_PATH)
		d.filters.set(
			m === "mine"
				? { onMyServices: true, anyService: undefined, services: undefined }
				: m === "pick"
					? { onMyServices: false, anyService: true, services: undefined }
					: { onMyServices: false, anyService: undefined, services: undefined },
		)
	}
	// From Everywhere, Any service or My services a tap means "just this one"; then taps add and remove. Taking the
	// last one off goes back to any service (today's Streaming card rule).
	const pick = (id: number) => {
		const fresh = mode !== "pick" || s.anyService
		const base = fresh ? [] : (s.services ?? [])
		const next = fresh ? [id] : base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
		d.filters.set(
			next.length
				? { onMyServices: false, anyService: undefined, services: next }
				: { onMyServices: false, anyService: true, services: undefined },
		)
	}
	const country = s.streamingCountry ?? pieces.services.country ?? "US"
	const setCountry = (code: string) => d.filters.set({ streamingCountry: code })
	const isOn = (id: number) => mode !== "any" && !s.anyService && chosen.includes(id)
	return {
		mode,
		setMode,
		pick,
		isOn,
		chosen,
		providers,
		mine: pieces.services.providers,
		hasMine,
		country,
		setCountry,
		countOf,
		anyService: Boolean(s.anyService),
		totals: { all: countOf("all"), any: countOf("any"), mine: countOf("mine") },
		addServices: () => navigate(SERVICES_PATH),
	}
}

export type Services = ReturnType<typeof useServices>

/** Today's pill (On my services | Everywhere), plus the Streaming card's third mode. Guests see Add my services. */
export function ModePill({ sv, phone = false, vertical = false }: { sv: Services; phone?: boolean; vertical?: boolean }) {
	const layoutId = useId()
	const seg = `relative z-10 flex items-center gap-2 rounded-xl text-sm font-bold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
		vertical ? "h-14 w-full justify-start px-4" : phone ? "h-full min-w-0 flex-1 justify-center px-2 text-[13px]" : "h-full justify-center px-4"
	}`
	const items: { id: Mode; label: string; icon: React.ReactNode; count: number | null; w: string }[] = [
		{
			id: "mine",
			label: sv.hasMine ? "On my services" : "Add my services",
			icon: sv.hasMine ? <ServiceStack providers={sv.mine} on={sv.mode === "mine"} size={20} /> : <PlusIcon className="h-4 w-4 shrink-0" />,
			count: sv.hasMine ? sv.totals.mine : null,
			w: "w-52",
		},
		{ id: "any", label: "Everywhere", icon: <GlobeAltIcon className="h-4 w-4 shrink-0" />, count: sv.totals.all, w: "w-40" },
		{ id: "pick", label: phone ? "Streaming in" : "Streaming in…", icon: <TvIcon className="h-4 w-4 shrink-0" />, count: sv.totals.any, w: "w-44" },
	]
	return (
		<div
			role="radiogroup"
			aria-label="Where to watch"
			className={`relative flex ${vertical ? "flex-col gap-1 p-1" : phone ? "h-12 w-full p-1" : "h-12 shrink-0 p-1"} ${SHELL}`}
		>
			{items.map((it) => {
				const on = sv.mode === it.id
				return (
					<motion.button
						key={it.id}
						// biome-ignore lint/a11y/useSemanticElements: a segmented control
						type="button"
						role="radio"
						aria-checked={on}
						whileTap={TAP}
						onClick={() => sv.setMode(it.id)}
						className={`${seg} ${vertical || phone ? "" : it.w} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
					>
						{on && (
							<motion.span
								layoutId={layoutId}
								transition={SPRING}
								className={`absolute inset-0 -z-10 rounded-xl ${
									it.id === "mine"
										? "bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_24px_-8px_rgba(16,185,129,.6)]"
										: "bg-white/10 ring-1 ring-white/15"
								}`}
							/>
						)}
						{it.icon}
						<span className="truncate">{phone && it.id === "mine" ? (sv.hasMine ? "My services" : "Add mine") : it.label}</span>
						{vertical && it.count != null && (
							<span className={`ml-auto text-[12px] font-medium tabular-nums ${on ? "text-white/80" : "text-gray-500"}`}>
								{compactCount(it.count)}
							</span>
						)}
					</motion.button>
				)
			})}
		</div>
	)
}

/** The streaming country, as today's card has it: a select of every country with services. */
export function CountrySelect({ sv, className = "" }: { sv: Services; className?: string }) {
	const countries = useCountries()
	const codes = [...new Set([sv.country, ...(countries.data ?? []).map((c) => c.code)])]
		.filter((c) => /^[A-Z]{2}$/.test(c))
		.map((code) => ({ code, name: productionCountryName(code) }))
		.sort((a, b) => a.name.localeCompare(b.name))
	return (
		<select
			aria-label="Streaming country"
			value={sv.country}
			onChange={(e) => sv.setCountry(e.target.value)}
			className={`h-9 rounded-xl border-0 bg-white/[0.05] py-0 pr-8 pl-3 text-[13px] font-semibold text-white ring-1 ring-white/[0.06] cursor-pointer ${className}`}
		>
			{codes.map((c) => (
				<option key={c.code} value={c.code}>
					{c.name}
				</option>
			))}
		</select>
	)
}

/** A search field for the country's services, or a magnifier that opens it (today's card hides it behind one tap). */
export function useServiceSearch(sv: Services) {
	const [search, setSearch] = useState("")
	const term = search.trim().toLowerCase()
	const matches = term ? sv.providers.filter((p) => p.name.toLowerCase().includes(term)) : sv.providers
	return { search, setSearch, term, matches }
}

export function SearchToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Find a service"
			aria-pressed={open}
			className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl cursor-pointer ring-1 ring-white/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${open ? "bg-white/[0.12] text-white" : "bg-white/[0.05] text-gray-400 hover:text-white"}`}
		>
			<MagnifyingGlassIcon className="h-4 w-4" />
		</button>
	)
}

export const logo = (path: string) => `${PROVIDER_LOGO}${path}`
