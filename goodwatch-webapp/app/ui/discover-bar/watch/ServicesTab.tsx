// Watch > Services: where to watch. Desktop: a rail with the mode pill standing upright (On my services with the
// viewer's logos, Everywhere, Streaming in…), each with its count, and the streaming country at the bottom; on the
// right a head row (country, Find a service, Any service while picking) over a wall of the country's services, 18
// tiles and "+N more" up to 120. Phones: the pill lies flat, two columns of 9 tiles.
//
// The first tap from My services, Everywhere or Any service means just this one; later taps add or remove; taking
// the last one off goes back to Any service (watch-choices.ts).
import {
	CheckIcon,
	GlobeAltIcon,
	PlusIcon,
	TvIcon,
} from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { motion } from "framer-motion"
import { type ReactNode, useId, useState } from "react"
import { productionCountryName } from "~/domain/production-country"
import { useCountries } from "~/routes/api.countries"
import { More, SearchField } from "~/ui/filter-bar/SheetControls"
import { ServiceStack, radioKeys } from "~/ui/filter-bar/controls"
import { compactCount } from "~/ui/filter-bar/labels"
import { SHELL, SPRING, TAP } from "~/ui/filter-bar/motion"
import {
	PROVIDER_LOGO,
	type StreamingProvider,
} from "~/ui/filter-bar/useFilterData"
import { SERVICES_PATH } from "~/ui/settings/paths"
import type { SubTabView } from "../DiscoverControls"
import { tabPad } from "./parts"
import {
	type ServicesMode,
	pickServicePatch,
	serviceName,
	servicesMode,
	servicesModePatch,
	servicesOn,
	servicesOrder,
	wallTiles,
} from "./watch-choices"

const DESKTOP_TILES = 18
const PHONE_TILES = 9

function useServices(view: SubTabView) {
	const navigate = useNavigate()
	const { state, set } = view.filters
	const mine = view.data.myProviders
	const mineIds = mine.map((p) => p.id)
	const hasMine = mine.length > 0 || state.onMyServices
	const mode = servicesMode(state)
	const on = servicesOn(state, mineIds)
	const counts = view.counts?.optionCounts.services
	const countOf = (key: number | string): number | null =>
		counts?.[String(key)] ?? null
	return {
		mode,
		on,
		mine,
		hasMine,
		anyService: Boolean(state.anyService),
		providers: servicesOrder(view.data.countryProviders, on, mineIds),
		country: state.streamingCountry ?? view.data.context.viewerCountry ?? "US",
		countOf,
		setMode: (next: ServicesMode) =>
			next === "mine" && !hasMine
				? navigate(SERVICES_PATH)
				: set(servicesModePatch(next)),
		pick: (id: number) => set(pickServicePatch(state, id)),
		setCountry: (code: string) => set({ streamingCountry: code }),
	}
}
type Services = ReturnType<typeof useServices>

/** The three modes; vertical on the desktop rail with counts, flat on phones. */
function ModePill({ sv, phone }: { sv: Services; phone: boolean }) {
	const layoutId = useId()
	const items: {
		id: ServicesMode
		label: string
		short: string
		icon: ReactNode
		count: number | null
	}[] = [
		{
			id: "mine",
			label: sv.hasMine ? "On my services" : "Add my services",
			short: sv.hasMine ? "My services" : "Add mine",
			icon: sv.hasMine ? (
				<ServiceStack providers={sv.mine} on={sv.mode === "mine"} size={20} />
			) : (
				<PlusIcon className="h-4 w-4 shrink-0" />
			),
			count: sv.hasMine ? sv.countOf("mine") : null,
		},
		{
			id: "any",
			label: "Everywhere",
			short: "Everywhere",
			icon: <GlobeAltIcon className="h-4 w-4 shrink-0" />,
			count: sv.countOf("all"),
		},
		{
			id: "pick",
			label: "Streaming in…",
			short: "Streaming in",
			icon: <TvIcon className="h-4 w-4 shrink-0" />,
			count: sv.countOf("any"),
		},
	]
	return (
		<div
			role="radiogroup"
			aria-label="Where to watch"
			onKeyDown={(event) =>
				radioKeys(event, (index) => sv.setMode(items[index].id))
			}
			className={`relative flex ${phone ? "h-12 w-full p-1" : "flex-col gap-1 p-1"} ${SHELL}`}
		>
			{items.map((item) => {
				const on = sv.mode === item.id
				return (
					<motion.button
						key={item.id}
						// biome-ignore lint/a11y/useSemanticElements: a segmented control; the buttons carry the radio role
						type="button"
						role="radio"
						aria-checked={on}
						tabIndex={on ? 0 : -1}
						whileTap={TAP}
						onClick={() => sv.setMode(item.id)}
						data-services-mode={item.id}
						className={`relative z-10 flex items-center gap-2 rounded-xl font-bold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
							phone
								? "h-full min-w-0 flex-1 justify-center px-2 text-[13px]"
								: "h-14 w-full justify-start px-4 text-sm"
						} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
					>
						{on && (
							<motion.span
								layoutId={layoutId}
								transition={SPRING}
								className={`absolute inset-0 -z-10 rounded-xl ${
									item.id === "mine"
										? "bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_24px_-8px_rgba(16,185,129,.6)]"
										: "bg-white/10 ring-1 ring-white/15"
								}`}
							/>
						)}
						{(!phone || item.id === "mine") && item.icon}
						<span className="truncate">{phone ? item.short : item.label}</span>
						{!phone && (
							<span
								aria-hidden={item.count === null || undefined}
								className={`ml-auto min-w-[1ch] text-[12px] font-medium tabular-nums ${on ? "text-white/80" : "text-gray-500"}`}
							>
								{item.count === null ? "" : compactCount(item.count)}
							</span>
						)}
					</motion.button>
				)
			})}
		</div>
	)
}

/** The streaming country: every country with services, by name. */
function CountrySelect({
	sv,
	className = "",
}: { sv: Services; className?: string }) {
	const countries = useCountries()
	const codes = [
		...new Set([sv.country, ...(countries.data ?? []).map((c) => c.code)]),
	]
		.filter((code) => /^[A-Z]{2}$/.test(code))
		.map((code) => ({ code, name: productionCountryName(code) }))
		.sort((a, b) => a.name.localeCompare(b.name))
	return (
		<select
			aria-label="Streaming country"
			value={sv.country}
			onChange={(event) => sv.setCountry(event.target.value)}
			className={`h-10 rounded-xl border-0 bg-white/[0.05] py-0 pr-8 pl-3 text-[13px] font-semibold text-white ring-1 ring-white/[0.06] [color-scheme:dark] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${className}`}
		>
			{codes.map((country) => (
				<option key={country.code} value={country.code}>
					{country.name}
				</option>
			))}
		</select>
	)
}

function Tile({
	sv,
	provider,
}: {
	sv: Services
	provider: StreamingProvider
}) {
	const on = sv.on.includes(provider.id)
	const dim = sv.mode !== "any" && !sv.anyService && !on
	const n = sv.countOf(provider.id)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={on}
			onClick={() => sv.pick(provider.id)}
			data-service={provider.id}
			className={`relative flex min-w-0 items-center gap-2.5 rounded-xl p-2 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on
					? "bg-emerald-500/15 ring-1 ring-emerald-400/60"
					: "bg-white/[0.035] ring-1 ring-white/[0.06] hover:bg-white/[0.07]"
			}`}
		>
			<img
				src={`${PROVIDER_LOGO}${provider.logo_path}`}
				alt=""
				loading="lazy"
				className={`h-10 w-10 shrink-0 rounded-[28%] object-cover transition-opacity duration-200 ${dim ? "opacity-45 grayscale" : ""}`}
			/>
			<span className="min-w-0">
				<span
					className={`block truncate text-[13px] ${on ? "font-semibold text-white" : "text-gray-200"}`}
				>
					{serviceName(provider.name)}
				</span>
				<span className="block h-4 text-[11px] tabular-nums text-gray-500">
					{n === null ? "" : compactCount(n)}
				</span>
			</span>
			{on && (
				<span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-gray-950">
					<CheckIcon className="h-3.5 w-3.5" />
				</span>
			)}
		</motion.button>
	)
}

export function ServicesTab({ view }: { view: SubTabView }) {
	const { phone } = view
	const sv = useServices(view)
	const [search, setSearch] = useState("")
	const [open, setOpen] = useState(false)
	const term = search.trim().toLowerCase()
	const matches = term
		? sv.providers.filter((p) => p.name.toLowerCase().includes(term))
		: sv.providers
	const { shown, rest } = wallTiles(matches, {
		limit: phone ? PHONE_TILES : DESKTOP_TILES,
		on: sv.on.length,
		open,
		searching: Boolean(term),
	})
	const countryName = productionCountryName(sv.country)

	const wall = (
		<>
			<div className={`grid gap-2 ${phone ? "grid-cols-2" : "grid-cols-6"}`}>
				{shown.map((provider) => (
					<Tile key={provider.id} sv={sv} provider={provider} />
				))}
			</div>
			{!sv.providers.length && (
				<p className="py-2 text-[13px] text-gray-500">Loading services…</p>
			)}
			{term && !matches.length && (
				<p className="py-2 text-[13px] text-gray-500">
					No service called “{search.trim()}” in {countryName}
				</p>
			)}
			{!term && (rest > 0 || open) && (
				<div className="mt-2">
					<More hidden={rest} open={open} onClick={() => setOpen(!open)} />
				</div>
			)}
		</>
	)
	const anyService = sv.mode === "pick" && (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={() => sv.setMode("pick")}
			aria-pressed={sv.anyService}
			className={`h-10 shrink-0 rounded-xl px-3 text-[13px] whitespace-nowrap cursor-pointer ring-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${sv.anyService ? "bg-white font-semibold text-gray-950 ring-white" : "bg-white/[0.05] text-gray-300 ring-white/[0.06] hover:text-white"}`}
		>
			Any service
		</motion.button>
	)
	const find = (
		<SearchField
			value={search}
			onChange={setSearch}
			placeholder={`Find a service in ${countryName}`}
		/>
	)
	// Phones: the country and Any service over the field, so each keeps a readable width.
	const head = phone ? (
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<CountrySelect sv={sv} className="min-w-0 flex-1" />
				{anyService}
			</div>
			{find}
		</div>
	) : (
		<div className="flex items-center gap-2">
			<CountrySelect sv={sv} className="w-56" />
			<div className="min-w-0 flex-1">{find}</div>
			{anyService}
		</div>
	)

	if (phone)
		return (
			<div className={`space-y-4 ${tabPad(true)}`}>
				<ModePill sv={sv} phone />
				{head}
				{wall}
			</div>
		)
	return (
		<div className={`flex gap-6 ${tabPad(false)}`}>
			<div className="flex w-[280px] shrink-0 flex-col gap-3">
				<ModePill sv={sv} phone={false} />
				<p className="mt-auto text-[12px] text-gray-500">
					Streaming in{" "}
					<span className="font-semibold text-gray-300">{countryName}</span>
				</p>
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-3">
				{head}
				<div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pt-1.5 pb-1">
					{wall}
				</div>
			</div>
		</div>
	)
}
