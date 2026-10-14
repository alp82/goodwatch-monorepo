// The dialog of the header pair: Country or Titles, one list at a time in a box of fixed height. It opens on the list
// used last. A pick closes it and the page shows the result at once, unsaved; closing it without a pick (×, Escape,
// the backdrop) changes nothing. Its code loads when a visitor reaches for the pair.
import {
	Dialog,
	DialogBackdrop,
	DialogPanel,
	DialogTitle,
} from "@headlessui/react"
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid"
import type { KeyboardEvent } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import CountryList from "~/ui/details/hero/CountryList"
import {
	OFFER_VERB,
	countriesWithOffers,
} from "~/ui/details/hero/countryOffers"
import { regionName } from "~/utils/display-names"
import { MEDIA_LANGUAGES } from "~/utils/media-language"
import { englishName, ownName } from "./languages"
import { type DialogTab, useMediaPreference } from "./MediaPreference"
import { BROWSER, intended } from "./machine"

export default function PreferenceDialog({
	media,
}: { media: MovieResult | ShowResult }) {
	const p = useMediaPreference()
	const { tab } = p.dialog
	const tabs: [DialogTab, string][] = [
		["country", `Country · ${regionName(p.shown.country)}`],
		["titles", `Titles · ${englishName(p.shown.language)}`],
	]
	return (
		<Dialog open onClose={p.closeDialog} className="relative z-[60]">
			<DialogBackdrop className="fixed inset-0 bg-black/60" />
			<div className="fixed inset-0 flex items-start justify-center px-4 pt-24 sm:pt-28">
				<DialogPanel
					data-preference-dialog
					className="w-full max-w-sm rounded-2xl border border-white/10 bg-stone-900 p-3 shadow-2xl"
				>
					<DialogTitle className="sr-only">
						Country and titles language
					</DialogTitle>
					<div className="flex items-center gap-2">
						<div
							role="tablist"
							aria-label="Change"
							className="flex min-w-0 flex-1 rounded-full bg-white/8 p-0.5 text-xs"
						>
							{tabs.map(([t, label]) => (
								<button
									key={t}
									type="button"
									role="tab"
									id={`preference-tab-${t}`}
									aria-selected={tab === t}
									data-autofocus={tab === t || undefined}
									aria-controls="preference-list"
									onClick={() => p.setTab(t)}
									className={`min-w-0 flex-1 cursor-pointer truncate rounded-full px-2 py-1.5 ${tab === t ? "bg-white font-semibold text-black" : "text-gray-300 hover:text-white"}`}
								>
									{label}
								</button>
							))}
						</div>
						<button
							type="button"
							onClick={p.closeDialog}
							aria-label="Close"
							className="cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10"
						>
							<XMarkIcon className="h-5 w-5" />
						</button>
					</div>
					{/* One list at a time, in a box of fixed height. */}
					<div
						id="preference-list"
						role="tabpanel"
						aria-labelledby={`preference-tab-${tab}`}
						className="mt-3 h-[20rem]"
					>
						{tab === "country" ? (
							<CountryList
								mediaType={media.mediaType}
								titleId={media.details.tmdb_id}
								tab="flatrate"
								rows={countriesWithOffers(media, "flatrate")}
								current={p.shown.country}
								verb={OFFER_VERB.flatrate}
								listClassName="h-[17.5rem]"
								onChoose={(code) => {
									p.closeDialog()
									p.pickCountry(code)
								}}
							/>
						) : (
							<TitlesList />
						)}
					</div>
				</DialogPanel>
			</div>
		</Dialog>
	)
}

function TitlesList() {
	const p = useMediaPreference()
	const choice = intended(p.state).language
	const options = [BROWSER, ...MEDIA_LANGUAGES]
	// Up and down move through the list, as in a list box.
	const move = (e: KeyboardEvent<HTMLUListElement>) => {
		if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
		const buttons = [
			...e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
		]
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
		const next =
			buttons[
				Math.min(
					buttons.length - 1,
					Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)),
				)
			]
		if (next) {
			e.preventDefault()
			next.focus()
		}
	}
	return (
		<ul
			aria-label="Titles in"
			onKeyDown={move}
			className="h-full overflow-y-auto overscroll-contain pr-1"
		>
			{options.map((l) => {
				const selected = l === choice
				return (
					<li key={l}>
						<button
							type="button"
							data-language={l}
							aria-current={selected || undefined}
							onClick={() => {
								p.closeDialog()
								p.pickLanguage(l)
							}}
							className={`flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-white hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-white ${selected ? "bg-white/[0.1] ring-1 ring-white/20" : ""}`}
						>
							{l === BROWSER ? (
								<span className="min-w-0 flex-1">
									<span className="block">Browser default</span>
									<span className="block text-xs text-gray-400">
										Follows your browser: {englishName(p.browserLanguage)} right
										now
									</span>
								</span>
							) : (
								<span className="min-w-0 flex-1 truncate">
									{englishName(l)}{" "}
									<span className="text-gray-500">{ownName(l)}</span>
								</span>
							)}
							{selected && (
								<CheckIcon
									className="h-4 w-4 shrink-0 text-gray-300"
									aria-label="Current"
								/>
							)}
						</button>
					</li>
				)
			})}
		</ul>
	)
}
