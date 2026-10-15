// The dialog of the header pair: Country or Titles, one list at a time in a box of fixed height. It opens on the list
// used last. A pick closes it and the page shows the result at once, unsaved; closing it without a pick (×, Escape,
// the backdrop) changes nothing. Its code loads when a visitor reaches for the pair.
import {
	Dialog,
	DialogBackdrop,
	DialogPanel,
	DialogTitle,
} from "@headlessui/react"
import { XMarkIcon } from "@heroicons/react/24/solid"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import CountryList from "~/ui/details/hero/CountryList"
import {
	OFFER_VERB,
	countriesWithOffers,
} from "~/ui/details/hero/countryOffers"
import { regionName } from "~/utils/display-names"
import { englishName } from "./languages"
import { TitlesList } from "./TitlesList"
import { type DialogTab, useMediaPreference } from "./MediaPreference"
import { intended } from "./machine"

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
							<TitlesList
								value={intended(p.state).language}
								browserLanguage={p.browserLanguage}
								onPick={(l) => {
									p.closeDialog()
									p.pickLanguage(l)
								}}
							/>
						)}
					</div>
				</DialogPanel>
			</div>
		</Dialog>
	)
}
