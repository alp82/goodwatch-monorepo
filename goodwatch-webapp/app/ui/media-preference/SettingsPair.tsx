// The country and titles language on the settings page: the header pair's rules (machine.ts, MediaPreference.tsx)
// without the preview. A settings page has no title to show a pick on, so a pick saves at once, the whole pair in one
// call, and the toast offers Undo of the whole pair through the same call. While it saves, both lists are off; a
// failure keeps the pick shown as not saved, with Retry and Cancel. A country pick saves only the country: no
// language is offered alongside, because the language list stands right beside it.
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { useEffect, useState } from "react"
import { useCountries } from "~/routes/api.countries"
import { countryFlagUrl } from "~/utils/country-flag"
import { regionName } from "~/utils/display-names"
import { describePair, useMediaPreference } from "./MediaPreference"
import { englishName } from "./languages"
import { TitlesList } from "./TitlesList"
import { BROWSER, intended } from "./machine"

export default function SettingsPair() {
	const p = useMediaPreference()
	const { warm } = p
	// The saved pair, its revision and where it saves come from the private read.
	useEffect(() => warm(), [warm])
	const { state, saving, changed, browserLanguage } = p
	const failed = state.status === "failed"
	const next = intended(state)
	// Without the private read the lists wait for it; if it fails, the page's own pair stands in, and a save still
	// checks against what is on record (a conflict adopts it).
	const off = saving || (!p.known && !p.readFailed)

	return (
		<div data-settings-pair className="flex flex-col gap-4">
			<p className="max-w-prose text-sm text-gray-400">
				Where to watch shows the services of your country. Titles, posters and
				descriptions show in your titles language; menus and buttons stay in
				English. A change saves {p.destination}.
			</p>
			<output
				aria-live="polite"
				className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 text-sm"
			>
				{failed ? (
					<>
						<span role="alert" className="text-red-300">
							{state.conflict
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
			<fieldset
				disabled={off}
				aria-busy={saving || undefined}
				className={`grid gap-4 md:grid-cols-2 ${off ? "opacity-60" : ""}`}
			>
				<section className="min-w-0 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
					<h3 className="flex items-center gap-2 text-base font-semibold text-white">
						Country
						<span className="truncate text-sm font-normal text-gray-400">
							{regionName(next.country)}
							{failed && changed.country && " · not saved"}
						</span>
					</h3>
					<CountryPicker
						current={next.country}
						onPick={(code) => {
							p.pickCountry(code)
							p.keep()
						}}
					/>
				</section>
				<section className="min-w-0 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
					<h3 className="flex items-center gap-2 text-base font-semibold text-white">
						Titles
						<span className="truncate text-sm font-normal text-gray-400">
							{next.language === BROWSER
								? `Follow browser (currently ${englishName(browserLanguage)})`
								: englishName(next.language)}
							{failed && changed.language && " · not saved"}
						</span>
					</h3>
					<TitlesList
						className="mt-3 h-[22rem]"
						value={next.language}
						browserLanguage={browserLanguage}
						onPick={(l) => {
							p.pickLanguage(l)
							p.keep()
						}}
					/>
				</section>
			</fieldset>
		</div>
	)
}

/** Every country, searchable. A settings page has no title, so no offers order or mark it. */
function CountryPicker({
	current,
	onPick,
}: {
	current: string
	onPick: (code: string) => void
}) {
	const countries = useCountries()
	const [query, setQuery] = useState("")
	const q = query.trim().toLowerCase()
	const rows = (countries.data ?? []).filter(
		(c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
	)
	return (
		<div className="mt-3">
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
			<ul
				aria-label="Countries"
				className="mt-2 h-[19.5rem] overflow-y-auto overscroll-contain pr-1"
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
