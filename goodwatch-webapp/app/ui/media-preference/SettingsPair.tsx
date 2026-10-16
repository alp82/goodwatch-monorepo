// The country and the titles language on Settings: the header pair's rules (machine.ts, MediaPreference.tsx) without
// the preview. Settings shows them on two sheets, Where you watch (the country, as "Watching from") and Show titles in
// (the language), under one provider, so a save on one shows on the other and on the tiles. A settings page has no title
// to show a pick on, so a pick saves at once, the whole pair in one call, and the toast offers Undo of the whole pair
// through the same call. While it saves, both lists are off; a failure keeps the pick shown as not saved, with Retry and
// Cancel. A country pick saves only the country: no language is offered alongside.
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import { useCountries } from "~/routes/api.countries"
import { countryFlagUrl } from "~/utils/country-flag"
import { regionName } from "~/utils/display-names"
import { describePair, useMediaPreference } from "./MediaPreference"
import { englishName } from "./languages"
import { TitlesList } from "./TitlesList"
import { BROWSER, intended } from "./machine"

/** The pair as Settings shows it: what a save is about to keep, and whether the lists are off while it saves or reads. */
export function useSettingsPair() {
	const p = useMediaPreference()
	const { warm } = p
	// The saved pair, its revision and where it saves come from the private read.
	useEffect(() => warm(), [warm])
	const failed = p.state.status === "failed"
	// Without the private read the lists wait for it; if it fails, the page's own pair stands in, and a save still
	// checks against what is on record (a conflict adopts it).
	const off = p.saving || (!p.known && !p.readFailed)
	return { p, next: intended(p.state), failed, off }
}

/** "Japanese", "Follow browser (currently German)". */
export function titlesLanguageName(language: string, browserLanguage: string) {
	return language === BROWSER
		? `Follow browser (currently ${englishName(browserLanguage)})`
		: englishName(language)
}

/** Saving, a failed save with Retry and Cancel, or a failed read. Each sheet shows it above its list. */
export function PairStatus() {
	const { p, next, failed } = useSettingsPair()
	const { state, saving, changed, browserLanguage } = p
	return (
		<output
			data-pair-status
			aria-live="polite"
			className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 text-sm empty:min-h-0"
		>
			{failed ? (
				<>
					<span role="alert" className="text-red-300">
						{state.status === "failed" && state.conflict
							? `Saved elsewhere meanwhile. Retry keeps ${describePair(next, browserLanguage, changed)}.`
							: "Couldn't confirm the save. It may have gone through; Retry to make sure."}
					</span>
					<button
						type="button"
						data-retry
						onClick={p.keep}
						className="h-8 cursor-pointer rounded-full bg-white px-3 font-semibold text-black hover:bg-gray-200"
					>
						Retry
					</button>
					<button
						type="button"
						data-cancel
						onClick={p.discard}
						className="h-8 cursor-pointer rounded-full px-3 font-semibold text-gray-200 hover:bg-white/10"
					>
						Cancel
					</button>
				</>
			) : saving ? (
				<span className="text-gray-400">Saving {p.destination}…</span>
			) : p.readFailed ? (
				<>
					<span className="text-gray-400">
						Couldn't read what is saved. These are this page's.
					</span>
					<button
						type="button"
						data-retry-read
						onClick={p.retryRead}
						className="h-8 cursor-pointer rounded-full px-3 font-semibold text-gray-200 hover:bg-white/10"
					>
						Try again
					</button>
				</>
			) : !p.known ? (
				<span className="text-gray-500">Reading what is saved…</span>
			) : null}
		</output>
	)
}

/** Watching from: every country, searchable. A pick saves the country at once. */
export function WatchingFromList({ className = "h-72" }: { className?: string }) {
	const { p, next, failed, off } = useSettingsPair()
	return (
		<fieldset
			data-watching-from
			disabled={off}
			aria-busy={p.saving || undefined}
			className={off ? "opacity-60" : ""}
		>
			<legend className="sr-only">Watching from</legend>
			<p data-country-current className="text-sm text-gray-400">
				{regionName(next.country)}
				{failed && p.changed.country && " · not saved"}
			</p>
			<CountryPicker
				className={className}
				current={next.country}
				onPick={(code) => {
					p.pickCountry(code)
					p.keep()
				}}
			/>
		</fieldset>
	)
}

/** Show titles in: "Browser default" and the offered languages. A pick saves the language at once. */
export function ShowTitlesInList({ className = "h-[22rem]" }: { className?: string }) {
	const { p, next, failed, off } = useSettingsPair()
	return (
		<fieldset
			data-show-titles-in
			disabled={off}
			aria-busy={p.saving || undefined}
			className={off ? "opacity-60" : ""}
		>
			<legend className="sr-only">Show titles in</legend>
			<p data-titles-current className="text-sm text-gray-400">
				{titlesLanguageName(next.language, p.browserLanguage)}
				{failed && p.changed.language && " · not saved"}
			</p>
			<TitlesList
				className={`mt-2 ${className}`}
				value={next.language}
				browserLanguage={p.browserLanguage}
				onPick={(l) => {
					p.pickLanguage(l)
					p.keep()
				}}
			/>
		</fieldset>
	)
}

/** Every country, searchable, the current one in view. A settings page has no title, so no offers order or mark it. */
function CountryPicker({
	current,
	onPick,
	className,
}: {
	current: string
	onPick: (code: string) => void
	className: string
}) {
	const countries = useCountries()
	const [query, setQuery] = useState("")
	const q = query.trim().toLowerCase()
	const rows = (countries.data ?? []).filter(
		(c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
	)
	// The current country starts in view, scrolled inside the list only.
	const list = useRef<HTMLUListElement>(null)
	const loaded = Boolean(countries.data)
	useEffect(() => {
		const ul = list.current
		const at = ul?.querySelector<HTMLElement>("[aria-current]")
		if (ul && at) ul.scrollTop = at.offsetTop - ul.offsetTop - 8
	}, [loaded])
	return (
		<div className="mt-3">
			<label className="flex h-9 items-center gap-2 rounded-lg bg-white/[0.07] px-2 ring-1 ring-white/10 focus-within:ring-white/30">
				<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-400" />
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search countries"
					aria-label="Search countries"
					className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
				/>
			</label>
			<ul
				ref={list}
				aria-label="Countries"
				className={`mt-2 overflow-y-auto overscroll-contain pr-1 ${className}`}
			>
				{rows.map((c) => (
					<li key={c.code}>
						<button
							type="button"
							data-country-code={c.code}
							aria-current={c.code === current || undefined}
							onClick={() => onPick(c.code)}
							className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left text-sm text-white hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-white disabled:cursor-wait ${c.code === current ? "bg-white/[0.1] ring-1 ring-white/20" : ""}`}
						>
							<img
								src={countryFlagUrl(c.code)}
								alt=""
								className="h-3 rounded-[1px]"
							/>
							<span className="min-w-0 flex-1 truncate">{c.name}</span>
						</button>
					</li>
				))}
				{countries.isPending && (
					<li className="px-2 py-2 text-xs text-gray-500" aria-busy="true">
						Loading countries…
					</li>
				)}
				{countries.isError && (
					<li className="px-2 py-2 text-xs text-gray-400">
						Countries could not be loaded.{" "}
						<button
							type="button"
							className="cursor-pointer underline"
							onClick={() => countries.refetch()}
						>
							Try again
						</button>
					</li>
				)}
				{q && countries.data && rows.length === 0 && (
					<li className="px-2 py-2 text-sm text-gray-500">
						No country matches.
					</li>
				)}
			</ul>
		</div>
	)
}
