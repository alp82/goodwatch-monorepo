// The country and titles language in the title page's header (variant F): one fixed-size button beside Share, and
// while a picked value is not saved, the question "Keep this?" anchored under the header. The question is an overlay
// of the header: it moves nothing on the page, and using the page, scrolling or the Rent tab leave it open.
// Escape in the pair or the question drops what is not saved; Escape anywhere else on the page is not theirs.
import { Suspense, lazy, useRef } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { countryFlagUrl } from "~/utils/country-flag"
import { regionName } from "~/utils/display-names"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { englishName, ownName, shortCode } from "./languages"
import { describePair, useMediaPreference } from "./MediaPreference"
import { BROWSER, intended } from "./machine"

const loadDialog = reloadOnStaleChunk(() => import("./PreferenceDialog"))
const PreferenceDialog = lazy(loadDialog)
/** Fetches the dialog's code ahead of a press that opens it. */
export const preloadPreferenceDialog = () => {
	void loadDialog().catch(() => {})
}

export default function PreferencePair({
	media,
}: { media: MovieResult | ShowResult }) {
	const p = useMediaPreference()
	const region = useRef<HTMLDivElement>(null)
	const { state, shown, changed, pending, saving } = p
	const country = regionName(shown.country)
	const language = englishName(shown.language)
	const follows = intended(state).language === BROWSER
	const spoken = [
		`Country ${country}, ${changed.country ? "not saved" : shown.country !== state.saved.country ? "for this page only" : "saved"}.`,
		// The shared page does not say whether the language is chosen or the browser's: only the private read does.
		!p.known && !changed.language
			? `Titles in ${language}.`
			: follows
				? `Titles follow your browser, ${language} now${changed.language ? ", not saved" : ""}.`
				: `Titles in ${language}, ${changed.language ? "not saved" : "saved"}.`,
		saving ? "Saving." : "Change.",
	].join(" ")

	return (
		<div
			ref={region}
			data-preference-pair
			className="flex items-center"
			onKeyDown={(e) => {
				// Only Escape from the pair or the question; one from the dialog (rendered elsewhere) is the dialog's.
				if (e.key !== "Escape" || !pending || saving || p.dialog.open) return
				if (!region.current?.contains(e.target as Node)) return
				e.preventDefault()
				p.discard()
				p.pairButton.current?.focus({ preventScroll: true })
			}}
		>
			<button
				ref={p.pairButton}
				type="button"
				data-pair-chip
				aria-haspopup="dialog"
				aria-expanded={p.dialog.open}
				aria-disabled={saving || undefined}
				aria-label={`${country} · ${language}. ${shortCode(shown.language)}. ${spoken}`}
				onPointerEnter={() => {
					preloadPreferenceDialog()
					p.warm()
				}}
				onFocus={() => {
					preloadPreferenceDialog()
					p.warm()
				}}
				onClick={() => {
					if (!saving) p.openDialog()
				}}
				className={`relative inline-flex h-9 w-[5.25rem] shrink-0 items-center justify-center gap-1.5 rounded-full text-xs font-semibold text-gray-100 ring-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:w-[11.5rem] sm:justify-start sm:px-3 ${
					pending
						? "bg-amber-300/10 ring-amber-300/60"
						: "bg-white/[0.06] ring-white/15"
				} ${saving ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-white/10"}`}
			>
				<img
					src={countryFlagUrl(shown.country)}
					alt=""
					className="h-3 rounded-[1px]"
				/>
				<span className="sm:hidden">{shortCode(shown.language)}</span>
				<span className="hidden min-w-0 truncate sm:inline">
					{country} · {language}
				</span>
				{pending && (
					<span
						aria-hidden="true"
						className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-300 ring-2 ring-black"
					/>
				)}
			</button>
			{pending && <Question />}
			<span className="sr-only" aria-live="polite">
				{p.announcement}
			</span>
			{p.dialog.open && (
				<Suspense fallback={null}>
					<PreferenceDialog media={media} />
				</Suspense>
			)}
		</div>
	)
}

function Question() {
	const p = useMediaPreference()
	const { state, changed, saving, browserLanguage } = p
	const failed = state.status === "failed"
	const next = intended(state)
	const described = describePair(next, browserLanguage, changed)
	const what = described.charAt(0).toUpperCase() + described.slice(1)
	const offers = state.offers
	const status = saving
		? `Saving ${p.destination}…`
		: `Not saved yet. Keep saves it ${p.destination}.`

	const buttons = (
		<div className="flex shrink-0 justify-end gap-1.5">
			<button
				type="button"
				data-undo
				disabled={saving}
				onClick={p.discard}
				className="h-8 cursor-pointer rounded-full px-3 text-sm font-semibold text-gray-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
			>
				Undo
			</button>
			<button
				type="button"
				data-keep
				aria-disabled={saving || undefined}
				onClick={() => {
					if (!saving) p.keep()
				}}
				className={`h-8 min-w-[4.5rem] rounded-full bg-white px-3 text-sm font-semibold text-black ${saving ? "cursor-wait opacity-70" : "cursor-pointer hover:bg-gray-200"}`}
			>
				{saving ? "Saving…" : failed ? "Retry" : "Keep"}
			</button>
		</div>
	)

	return (
		<div className="pointer-events-none absolute inset-x-0 top-full z-40 mt-2">
			<div className="mx-auto flex w-full max-w-7xl justify-end px-2 sm:px-4">
				<section
					aria-label="Keep this?"
					data-preference-question
					className="pointer-events-auto w-full rounded-xl border border-white/10 bg-stone-900 shadow-2xl shadow-black/60 sm:w-[19rem]"
				>
					{/* A phone keeps the question to one row, so the page stays readable under it. */}
					<div className="flex items-center gap-2 py-1.5 pl-3 pr-1.5 sm:hidden">
						<p className="min-w-0 flex-1 truncate text-xs">
							{failed ? (
								<span role="alert" className="text-red-300">
									{state.conflict ? "Saved elsewhere." : "Couldn't confirm."}
								</span>
							) : (
								<>
									<span className="font-semibold text-white">Keep?</span>{" "}
									<span className="text-gray-400">{what}</span>
								</>
							)}
						</p>
						{buttons}
					</div>
					<div className="hidden px-3 pt-3 sm:block">
						<p className="text-sm font-semibold text-white">Keep this?</p>
						<p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{what}</p>
					</div>
					{/* Under the row on a phone; above the status and the buttons from sm up, ticked before deciding. */}
					{offers.length > 0 && <Companion offers={offers} />}
					<div className="hidden px-3 pb-3 sm:block">
						{failed ? (
							<p role="alert" className="mt-2 text-xs text-red-300">
								{state.conflict
									? "Saved elsewhere meanwhile. Retry keeps this."
									: "Couldn't confirm the save. It may have gone through; Retry to make sure."}
							</p>
						) : (
							<p className="mt-2 text-xs text-gray-500">{status}</p>
						)}
						<div className="mt-2">{buttons}</div>
					</div>
				</section>
			</div>
		</div>
	)
}

/** The country's own language, offered and never ticked for the visitor: one is a checkbox, several are radios. */
function Companion({ offers }: { offers: string[] }) {
	const p = useMediaPreference()
	const { companion } = p.state
	const name = (l: string) => (
		<>
			{englishName(l)} <span className="text-gray-500">{ownName(l)}</span>
		</>
	)
	const box =
		"h-4 w-4 cursor-pointer accent-amber-300 disabled:cursor-not-allowed"
	return (
		<div className="px-3 py-2 text-xs text-gray-200 max-sm:border-t max-sm:border-white/10 sm:pb-0">
			{offers.length === 1 ? (
				<label className="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						data-companion
						className={box}
						checked={companion === offers[0]}
						disabled={p.saving}
						onChange={(e) =>
							p.tickCompanion(e.target.checked ? offers[0] : null)
						}
					/>
					<span>{name(offers[0])} titles too</span>
				</label>
			) : (
				<fieldset disabled={p.saving}>
					<legend className="mb-1 text-gray-400">Titles language too?</legend>
					<div className="flex flex-wrap gap-x-3 gap-y-1">
						{[null, ...offers].map((l) => (
							<label
								key={l ?? "none"}
								className="flex cursor-pointer items-center gap-1.5"
							>
								<input
									type="radio"
									name="companion"
									data-companion={l ?? "none"}
									className={box}
									checked={companion === l}
									onChange={() => p.tickCompanion(l)}
								/>
								{l ? name(l) : "No change"}
							</label>
						))}
					</div>
				</fieldset>
			)}
		</div>
	)
}
