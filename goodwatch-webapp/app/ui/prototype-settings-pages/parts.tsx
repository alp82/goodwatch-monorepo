// PROTOTYPE - throwaway (settings subpages; copied from prototype/settings-redesign). The settings controls every variant arranges: the real list components
// (TitlesList, StreamingProviderToggle, ConnectAppBadge, ConnectorAddressCard, SourceMark, PasswordInput) on local
// state. Countries and services are the real public lists; everything about the member is fake (data.ts). Nothing saves:
// a change only says so in a small note.
import { CheckIcon, EnvelopeIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { type ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useCountries } from "~/routes/api.countries"
import { type StreamingProvider, useStreamingProviders } from "~/routes/api.streaming-providers"
import { ConnectAppBadge } from "~/ui/auth/connect"
import { ConnectorAddressCard } from "~/ui/connector/ConnectorAddressCard"
import { PasswordInput } from "~/ui/form/PasswordInput"
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import { englishName } from "~/ui/media-preference/languages"
import { BROWSER } from "~/ui/media-preference/machine"
import { TitlesList } from "~/ui/media-preference/TitlesList"
import StreamingProviderToggle from "~/ui/onboarding/StreamingProviderToggle"
import { TmdbImage } from "~/ui/TmdbImage"
import { countryFlagUrl } from "~/utils/country-flag"
import { regionName } from "~/utils/display-names"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { APPS, HIDDEN, IMPORTS, MEMBER, SAMPLE_POSTER, START, sampleFor } from "./data"

// ---------------------------------------------------------------------------------------------------------------------
// Names: one place, so every variant says the same thing about what a control does.

export const NAMES = {
	where: "Where you watch",
	country: "Your country",
	countryShort: "Streaming offers and age ratings",
	countryHelp: "Sets where to watch on every title, which services you can pick, what Discover counts as streaming, and the age ratings you see. It doesn't change the language.",
	services: "Your services",
	servicesHelp: "The “On my services” filter keeps titles on these, and you hear when a title you want lands on one.",
	language: "Title language",
	languageShort: "Titles, posters and descriptions",
	languageHelp: "The language of title names, posters, descriptions and taglines. Menus, buttons, genres and the title analysis stay in English.",
	profile: "Public profile",
	library: "Your data",
	imports: "Imports",
	hidden: "Hidden titles",
	apps: "Connected apps",
	account: "Account and sign-in",
} as const

// ---------------------------------------------------------------------------------------------------------------------
// Local state shared by the controls of one variant.

type State = {
	country: string
	language: string
	services: string[]
	note: string | null
}
type Prefs = State & {
	browserLanguage: string
	setCountry: (c: string) => void
	setLanguage: (l: string) => void
	toggleService: (id: string, on: boolean) => void
}

const Ctx = createContext<Prefs | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<State>({ country: START.country, language: START.language, services: START.services, note: null })
	const value: Prefs = {
		...state,
		browserLanguage: START.browserLanguage,
		setCountry: (country) => setState((s) => ({ ...s, country, note: `Prototype: ${regionName(country)} not saved` })),
		setLanguage: (language) => setState((s) => ({ ...s, language, note: `Prototype: ${languageLabel(language, START.browserLanguage)} not saved` })),
		toggleService: (id, on) =>
			setState((s) => ({
				...s,
				services: on ? [...s.services.filter((x) => x !== id), id] : s.services.filter((x) => x !== id),
				note: "Prototype: services not saved",
			})),
	}
	return (
		<Ctx.Provider value={value}>
			{children}
			{state.note && (
				<output className="fixed right-4 bottom-36 z-40 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-200 shadow-xl ring-1 ring-white/10 md:bottom-6">
					{state.note}
				</output>
			)}
		</Ctx.Provider>
	)
}

export function usePrefs() {
	const value = useContext(Ctx)
	if (!value) throw new Error("usePrefs outside PrefsProvider")
	return value
}

export const languageLabel = (language: string, browserLanguage: string) =>
	language === BROWSER ? `${englishName(browserLanguage)} (follows your browser)` : englishName(language)

/** The language titles actually show in. */
export const shownLanguage = (language: string, browserLanguage: string) => (language === BROWSER ? browserLanguage : language)

// ---------------------------------------------------------------------------------------------------------------------
// Small pieces.

export function Flag({ code, className = "h-3" }: { code: string; className?: string }) {
	return <img src={countryFlagUrl(code)} alt="" className={`rounded-[1px] ${className}`} />
}

export function SectionTitle({ children, help, id }: { children: ReactNode; help?: ReactNode; id?: string }) {
	return (
		<div id={id} className="scroll-mt-24">
			<h2 className="text-lg font-bold tracking-tight text-gray-100 md:text-xl">{children}</h2>
			{help && <p className="mt-1 max-w-prose text-sm text-gray-400">{help}</p>}
		</div>
	)
}

/** A panel in the look of the settings pair and Connected apps. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <section className={`min-w-0 rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10 ${className}`}>{children}</section>
}

export function TextButton({ children, onClick, tone = "default" }: { children: ReactNode; onClick?: () => void; tone?: "default" | "danger" }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold ${tone === "danger" ? "border-red-900 text-red-300 hover:border-red-500 hover:bg-red-950/40" : "border-gray-600 text-gray-200 hover:border-gray-400 hover:text-white"}`}
		>
			{children}
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------------------
// Where you watch: country and services.

/** Every country, searchable: the settings pair's picker. */
export function CountryList({ className = "h-[19.5rem]" }: { className?: string }) {
	const p = usePrefs()
	const countries = useCountries()
	const [query, setQuery] = useState("")
	const q = query.trim().toLowerCase()
	const rows = (countries.data ?? []).filter((c) => c.name.length > 2 && (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q))
	// The current country starts in view, inside the list only.
	const list = useRef<HTMLUListElement>(null)
	const loaded = !!countries.data
	useEffect(() => {
		const ul = list.current
		const at = ul?.querySelector<HTMLElement>("[aria-current]")
		if (ul && at) ul.scrollTop = at.offsetTop - ul.offsetTop - 8
	}, [loaded])
	return (
		<div>
			<label className="flex h-8 items-center gap-2 rounded-lg bg-white/[0.07] px-2 ring-1 ring-white/10 focus-within:ring-white/30">
				<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search countries"
					aria-label="Search countries"
					className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
				/>
			</label>
			<ul ref={list} aria-label="Countries" className={`mt-2 overflow-y-auto overscroll-contain pr-1 ${className}`}>
				{rows.map((c) => (
					<li key={c.code}>
						<button
							type="button"
							aria-current={c.code === p.country || undefined}
							onClick={() => p.setCountry(c.code)}
							className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left text-sm text-white hover:bg-white/[0.08] ${c.code === p.country ? "bg-white/[0.1] ring-1 ring-white/20" : ""}`}
						>
							<Flag code={c.code} />
							<span className="min-w-0 flex-1 truncate">{c.name}</span>
							{c.code === p.country && <CheckIcon className="h-4 w-4 shrink-0 text-gray-300" aria-label="Current" />}
						</button>
					</li>
				))}
				{countries.isPending && <li className="px-2 py-2 text-xs text-gray-500">Loading countries…</li>}
			</ul>
		</div>
	)
}

/** The real language list of the settings pair. */
export function LanguageList({ className = "h-[22rem]" }: { className?: string }) {
	const p = usePrefs()
	return <TitlesList className={className} value={p.language} browserLanguage={p.browserLanguage} onPick={p.setLanguage} />
}

function useProviders() {
	const p = usePrefs()
	return useStreamingProviders({ country: p.country, include: p.services })
}

/** The member's services as small logos, for a summary row. */
export function ServiceLogos({ max = 6, size = "h-8 w-8" }: { max?: number; size?: string }) {
	const p = usePrefs()
	const { data } = useProviders()
	const chosen = p.services.map((id) => data?.find((x) => String(x.id) === id)).filter(Boolean) as StreamingProvider[]
	if (!chosen.length) return <span className="text-sm text-gray-500">No services yet</span>
	return (
		<span className="flex items-center gap-1.5">
			{chosen.slice(0, max).map((s) => (
				<span key={s.id} title={s.name} className={`${size} overflow-hidden rounded-md bg-white/5 ring-1 ring-white/10`}>
					<TmdbImage kind="logo" path={s.logo_path} width={40} ratio={1} className="h-full w-full object-cover" alt={s.name} />
				</span>
			))}
			{chosen.length > max && <span className="text-xs text-gray-400">+{chosen.length - max}</span>}
		</span>
	)
}

/** Services of the chosen country, the member's first: the onboarding toggles. */
export function ServicesGrid({ limit = 18, compact = false }: { limit?: number; compact?: boolean }) {
	const p = usePrefs()
	const { data, isPending } = useProviders()
	const [query, setQuery] = useState("")
	const [all, setAll] = useState(false)
	const sorted = useMemo(() => {
		const list = (data ?? []).filter((s) => !query || s.name.toLowerCase().includes(query.toLowerCase()))
		return [...list.filter((s) => p.services.includes(String(s.id))), ...list.filter((s) => !p.services.includes(String(s.id)))]
	}, [data, p.services, query])
	const shown = all || query ? sorted : sorted.slice(0, limit)
	return (
		<div className="flex flex-col gap-3">
			<label className="flex h-9 max-w-sm items-center gap-2 rounded-lg bg-white/[0.07] px-2 ring-1 ring-white/10 focus-within:ring-white/30">
				<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-400" />
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={`Search services in ${regionName(p.country)}`}
					aria-label="Search services"
					className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
				/>
			</label>
			<p className="flex items-center gap-1.5 text-xs text-gray-500">
				<Flag code={p.country} /> Services in {regionName(p.country)}. Another country has other services.
			</p>
			{isPending && <p className="text-sm text-gray-500">Loading services…</p>}
			<div className={`grid gap-2 ${compact ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8"}`}>
				{shown.map((s) => (
					<StreamingProviderToggle
						key={s.id}
						provider={s}
						selected={p.services.includes(String(s.id))}
						onToggle={(provider, on) => p.toggleService(String(provider.id), on)}
					/>
				))}
			</div>
			{!query && sorted.length > limit && (
				<button type="button" onClick={() => setAll(!all)} className="self-start cursor-pointer text-sm font-semibold text-amber-500 hover:text-amber-400">
					{all ? "Show fewer" : `Show all ${sorted.length} services`}
				</button>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------------
// Title language: what a title looks like in the chosen language.

export function TitlePreview({ size = "md" }: { size?: "sm" | "md" }) {
	const p = usePrefs()
	const lang = shownLanguage(p.language, p.browserLanguage)
	const sample = sampleFor(lang)
	return (
		<div className="flex gap-3 self-start rounded-xl bg-black/30 p-3 ring-1 ring-white/10">
			<img
				src={tmdbImageUrl(SAMPLE_POSTER, "w154")}
				alt=""
				className={`${size === "sm" ? "h-20 w-[3.35rem]" : "h-28 w-[4.7rem]"} shrink-0 rounded-md object-cover`}
			/>
			<div className="min-w-0">
				<p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Preview</p>
				<p lang={sample.title.lang} dir="auto" className="truncate text-base font-bold text-white">
					{sample.title.text}
				</p>
				<p lang={sample.overview.lang} dir="auto" className={`mt-1 text-sm text-gray-400 ${size === "sm" ? "line-clamp-2" : "line-clamp-3"}`}>
					{sample.overview.text}
				</p>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------------
// Profile, data, apps, account.

export function ProfileBlock() {
	return (
		<div className="flex flex-col gap-1">
			<p className="text-sm font-medium text-gray-300">Handle</p>
			<p className="text-2xl font-black text-white">@{MEMBER.handle}</p>
			<p className="text-sm text-gray-500">goodwatch.app/u/{MEMBER.handle} · Handles are permanent, so nobody can sign a list as someone else.</p>
			<a href={`/u/${MEMBER.handle}`} className="mt-2 self-start font-semibold text-indigo-300 underline underline-offset-4 hover:text-indigo-200">
				View your profile
			</a>
		</div>
	)
}

export function ImportsBlock({ compact = false }: { compact?: boolean }) {
	const popular = IMPORT_SOURCE_LIST.slice(0, compact ? 4 : 6)
	return (
		<div className="flex flex-col gap-3">
			<ul className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-700 bg-gray-800/40">
				{IMPORTS.map((i) => {
					const source = IMPORT_SOURCE_LIST.find((s) => s.id === i.source)
					if (!source) return null
					return (
						<li key={i.source} className="flex items-center gap-3 px-3 py-2.5">
							<SourceMark source={source} />
							<span className="min-w-0 flex-1">
								<span className="block font-semibold text-gray-100">{source.name}</span>
								<span className="block text-sm text-gray-400">
									{i.what} · {i.when}
								</span>
							</span>
						</li>
					)
				})}
			</ul>
			<div className="flex flex-wrap items-center gap-2">
				{popular.map((s) => (
					<span key={s.id} className="flex items-center gap-2 rounded-lg bg-white/[0.04] py-1 pr-3 pl-1 text-sm text-gray-200 ring-1 ring-white/10">
						<span className="scale-75">
							<SourceMark source={s} />
						</span>
						{s.name}
					</span>
				))}
				<a href="/settings/imports" className="text-sm font-semibold text-amber-500 hover:text-amber-400">
					All sources
				</a>
			</div>
		</div>
	)
}

export function HiddenBlock({ max = 4 }: { max?: number }) {
	return (
		<ul className="divide-y divide-gray-700 rounded-md border border-gray-700">
			{HIDDEN.slice(0, max).map((t) => (
				<li key={t.key} className="flex items-center gap-3 px-3 py-2">
					<img src={tmdbImageUrl(t.poster, "w92")} alt="" loading="lazy" className="h-14 w-[2.35rem] shrink-0 rounded object-cover" />
					<span className="min-w-0 grow">
						<span className="block truncate text-base font-medium text-gray-100">{t.title}</span>
						<span className="block text-xs text-gray-400">
							{t.year} · Film · hidden {t.hiddenAt}
						</span>
					</span>
					<button type="button" className="shrink-0 cursor-pointer rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-800 hover:text-white">
						Unhide
					</button>
				</li>
			))}
		</ul>
	)
}

export function AppsBlock({ withAddress = true }: { withAddress?: boolean }) {
	return (
		<div className="flex flex-col gap-4">
			<ul className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-700 bg-gray-800/40">
				{APPS.map((a) => (
					<li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
						<ConnectAppBadge app={a.app} size="sm" />
						<div className="min-w-0 flex-1 basis-40">
							<p className="font-semibold text-gray-100">
								{a.app.name}
								{a.app.returnsTo === "this computer" && <span className="ml-2 text-sm font-normal text-gray-500">On a computer</span>}
							</p>
							<p className={`text-sm ${a.canChange ? "text-amber-300" : "text-sky-300"}`}>{a.canChange ? "Can see and change" : "Can see only"}</p>
							<p className="text-sm text-gray-500">
								Connected {a.connected} · {a.lastUsed === "Not used yet" ? a.lastUsed : `Last used ${a.lastUsed}`}
							</p>
						</div>
						<TextButton>Disconnect</TextButton>
					</li>
				))}
			</ul>
			{withAddress && <ConnectorAddressCard />}
		</div>
	)
}

export function SignInMethods() {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-3">
				<EnvelopeIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
				<span className="min-w-0 flex-1">
					<span className="block text-sm text-gray-400">Email</span>
					<span className="block font-medium text-gray-100">{MEMBER.email}</span>
				</span>
			</div>
			<div className="flex items-center gap-3">
				<span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#4285F4]" aria-hidden="true">
					G
				</span>
				<span className="min-w-0 flex-1">
					<span className="block text-sm text-gray-400">Google</span>
					<span className="block font-medium text-gray-100">Connected</span>
				</span>
			</div>
		</div>
	)
}

export function PasswordBlock() {
	const [current, setCurrent] = useState("")
	const [next, setNext] = useState("")
	return (
		<div className="flex max-w-80 flex-col gap-2">
			<PasswordInput id="proto-password-current" label="Current password" placeholder="" value={current} onChange={setCurrent} />
			<PasswordInput id="proto-password-new" label="New password" placeholder="at least 8 characters" value={next} onChange={setNext} />
			<p className="text-sm text-gray-400">Other devices are signed out. Connected apps keep working.</p>
			<button
				type="button"
				className="mt-2 self-start rounded-md border border-indigo-700 bg-indigo-700 px-4 py-2 text-base font-medium text-gray-200 hover:bg-indigo-800 hover:text-white"
			>
				Change password
			</button>
		</div>
	)
}

export function RestartSetup() {
	return (
		<div className="flex flex-wrap items-center gap-3">
			<p className="min-w-0 flex-1 basis-56 text-sm text-gray-400">Go through the first steps again: country, services and scores. Nothing you saved is lost.</p>
			<TextButton>Restart setup</TextButton>
		</div>
	)
}

/** Not built yet: the data removal exists (account-deletion.server.ts), no flow calls it. Shown to ask about it. */
export function DeleteAccount() {
	return (
		<div className="flex flex-wrap items-center gap-3 rounded-lg bg-red-950/30 p-3 ring-1 ring-red-900/70">
			<p className="min-w-0 flex-1 basis-56 text-sm text-red-100">
				Delete your account, your scores, lists and watch history. <span className="text-red-300/80">(Not built yet: placeholder.)</span>
			</p>
			<TextButton tone="danger">Delete account</TextButton>
		</div>
	)
}

export const counts = { hidden: HIDDEN.length + 23, imports: IMPORTS.length, apps: APPS.length }
