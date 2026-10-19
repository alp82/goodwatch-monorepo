// The country and the titles language on Settings: the header pair's rules (machine.ts, MediaPreference.tsx) without
// the preview. Settings shows them on two pages, Watching from (the country) and Show titles in (the language), under one
// provider, so a save on one shows on the other and on the tiles. A settings page has no title
// to show a pick on, so a pick saves at once, the whole pair in one call, and the toast offers Undo of the whole pair
// through the same call. While it saves, both lists are off; a failure keeps the pick shown as not saved, with Retry and
// Cancel. A country pick saves only the country: no language is offered alongside.
import { type ReactNode, useEffect } from "react"
import { regionName } from "~/utils/display-names"
import { describePair, useMediaPreference } from "./MediaPreference"
import { CountryGrid, Flag, LanguageGrid } from "./PickerGrids"
import { englishName, languageFlag, ownName } from "./languages"
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

/** Saving, a failed save with Retry and Cancel, or a failed read. Each page shows it above its picker. */
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

/** The heading font of My library (my-pages/bits DISPLAY), copied: that module brings the router along. */
const DISPLAY = "font-['Gabarito'] font-black tracking-[-0.03em]"

/** The current choice, large: its flag and name, with a line under it. */
function Current({
	flag,
	name,
	line,
	data,
}: {
	flag: string
	name: string
	line: string
	data: Record<string, string>
}) {
	return (
		<div className="flex items-center gap-4">
			<Flag code={flag} className="h-10 shadow-lg md:h-12" />
			<div className="min-w-0">
				<p {...data} className={`${DISPLAY} truncate text-3xl text-white md:text-4xl`}>
					{name}
				</p>
				<p className="text-sm text-gray-400">{line}</p>
			</div>
		</div>
	)
}

/** Watching from: the current country, then the country grid. A pick saves the country at once. */
export function WatchingFromList() {
	const { p, next, failed, off } = useSettingsPair()
	return (
		<fieldset
			data-watching-from
			disabled={off}
			aria-busy={p.saving || undefined}
			className={`flex flex-col gap-6 ${off ? "opacity-60" : ""}`}
		>
			<legend className="sr-only">Watching from</legend>
			<Current
				flag={next.country}
				name={`${regionName(next.country)}${failed && p.changed.country ? " · not saved" : ""}`}
				line={`Streaming offers and age ratings for ${regionName(next.country)}`}
				data={{ "data-country-current": "" }}
			/>
			<CountryGrid
				current={next.country}
				onPick={(code) => {
					p.pickCountry(code)
					p.keep()
				}}
			/>
		</fieldset>
	)
}

/** Show titles in: the current language, then "Browser default" and the offered languages. A pick saves at once. */
export function ShowTitlesInList({ preview }: { preview?: ReactNode }) {
	const { p, next, failed, off } = useSettingsPair()
	const shown = next.language === BROWSER ? p.browserLanguage : next.language
	const own = ownName(shown)
	return (
		<fieldset
			data-show-titles-in
			disabled={off}
			aria-busy={p.saving || undefined}
			className={`flex flex-col gap-6 ${off ? "opacity-60" : ""}`}
		>
			<legend className="sr-only">Show titles in</legend>
			<div className="flex flex-col gap-4">
				<Current
					flag={languageFlag(shown)}
					name={`${englishName(shown)}${failed && p.changed.language ? " · not saved" : ""}`}
					line={next.language === BROWSER ? ["Follows your browser", own].filter(Boolean).join(" · ") : own || "Chosen by you"}
					data={{ "data-titles-current": "" }}
				/>
				{preview}
			</div>
			<LanguageGrid
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

