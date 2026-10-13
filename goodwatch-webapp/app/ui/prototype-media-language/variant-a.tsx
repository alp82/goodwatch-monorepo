// PROTOTYPE - throwaway. Variant A of /prototype/media-language: one staged panel.
//
// Country and language are two fields of one draft. Nothing outside the panel changes until Save, the panel's own
// before and after preview is the only "look", and Cancel, Escape or a click outside drops the whole draft. When the
// country changes, the panel offers that country's language as an unchecked companion. The button names what it
// saves. While a save is under way the panel cannot be dismissed, so its answer is never lost. The same panel is the
// dialog on the title page and the open section of the settings page.
import {
	Dialog,
	DialogBackdrop,
	DialogPanel,
	DialogTitle,
} from "@headlessui/react"
import {
	AdjustmentsHorizontalIcon,
	ChevronDownIcon,
	ExclamationTriangleIcon,
	XMarkIcon,
} from "@heroicons/react/24/solid"
import { useEffect, useState } from "react"
import { type Country, LANG_NAME, TITLES, countryName } from "./fixtures"
import { SettingsPage, TitlePage } from "./host"
import {
	type Change,
	type LangChoice,
	companionsOf,
	langLabel,
	sourceWords,
	useStore,
} from "./model"
import {
	Btn,
	Flag,
	MiniTitle,
	MissingLine,
	OfferLine,
	PickList,
	countryItems,
	langItems,
	useReturnFocus,
} from "./parts"

type OpenField = "country" | "lang" | null

function Panel({
	startCountry,
	inline = false,
	onClose,
}: { startCountry?: Country; inline?: boolean; onClose: () => void }) {
	const s = useStore()
	// A has no look, so what the page shows is what is saved (or the guess and the browser).
	const now = s.base
	const guessed = now.countrySource === "guess"
	const savedChoice: LangChoice = s.saved.lang ?? "browser"
	const [country, setCountry] = useState<Country>(startCountry ?? now.country)
	// A guessed country is saved only when the visitor says so.
	const [confirmGuess, setConfirmGuess] = useState(false)
	const [lang, setLang] = useState<LangChoice>(savedChoice)
	const [companion, setCompanion] = useState<LangChoice | null>(null)
	const [openField, setOpenField] = useState<OpenField>(null)
	const [failed, setFailed] = useState(false)
	const [side, setSide] = useState<"before" | "after">("after")
	const [previewId, setPreviewId] = useState(s.titleId)
	const preview = TITLES.find((t) => t.id === previewId) ?? s.title
	const countryButton = useReturnFocus(openField === "country")
	const langButton = useReturnFocus(openField === "lang")

	const choice = companion ?? lang
	const draftLang = choice === "browser" ? s.browserLang : choice
	const countryChanges = country !== now.country || (guessed && confirmGuess)
	const change: Change = {
		country: countryChanges ? country : undefined,
		lang: choice !== savedChoice ? choice : undefined,
	}
	const words = [change.country && "country", change.lang && "language"]
		.filter(Boolean)
		.join(" and ")
	// The country's language is offered only while the language field is untouched: a language the visitor picked
	// themselves is never second-guessed.
	const companions =
		country !== now.country && lang === savedChoice
			? companionsOf(country, now.lang)
			: []
	const after = s.resolve(preview, draftLang)

	useEffect(() => {
		s.setDraft(
			words
				? `A panel: country ${country}${confirmGuess ? " (confirming the guess)" : ""}, language ${choice}${companion ? " (companion)" : ""}`
				: null,
		)
		return () => s.setDraft(null)
	}, [words, country, confirmGuess, choice, companion, s.setDraft])

	const pickCountry = (c: Country) => {
		setCountry(c)
		setConfirmGuess(false)
		setCompanion(null)
		setOpenField(null)
		setFailed(false)
	}
	const pickLang = (l: LangChoice) => {
		setLang(l)
		setCompanion(null)
		setOpenField(null)
		setFailed(false)
	}
	const cancel = () => {
		if (s.saving) return
		if (words) s.note("draft discarded: nothing saved")
		onClose()
	}
	const save = async () => {
		if (!words) return
		setFailed(false)
		setOpenField(null)
		const said = [
			change.country && countryName(change.country),
			change.lang &&
				(change.lang === "browser"
					? "titles follow your browser"
					: `titles in ${langLabel(change.lang)}`),
		]
			.filter(Boolean)
			.join(", ")
		const result = await s.save(change, {
			toast: `Saved to ${s.place}: ${said}`,
		})
		if (result === "failed") setFailed(true)
		else onClose()
	}

	const fieldButton =
		"flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg bg-white/[0.07] px-3 text-left text-sm text-white ring-1 ring-white/10 hover:bg-white/[0.11] focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-default disabled:opacity-60"
	return (
		<div data-panel-a aria-busy={s.saving} className="flex min-h-0 flex-col">
			{/* The scroll area is a div: a fieldset does not scroll on a phone. The fieldset inside only switches the
			    fields off while a save is under way. */}
			<div
				className={`min-h-0 ${inline ? "" : "overflow-y-auto overscroll-contain p-4 sm:p-6"}`}
			>
				<fieldset
					disabled={s.saving}
					className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]"
				>
					<div className="space-y-5">
						<div>
							<p id="a-country" className="text-sm font-semibold text-white">
								Country
							</p>
							<p className="mb-2 text-xs text-gray-400">
								Decides which services and offers you see.
							</p>
							<button
								ref={countryButton}
								type="button"
								data-field="country"
								aria-labelledby="a-country a-country-value"
								aria-expanded={openField === "country"}
								onClick={() =>
									setOpenField(openField === "country" ? null : "country")
								}
								className={fieldButton}
							>
								<Flag code={country} />
								<span id="a-country-value" className="flex-1">
									{countryName(country)}{" "}
									{guessed && country === now.country && (
										<span className="ml-2 text-xs text-gray-400">
											{confirmGuess ? "your choice" : "our guess"}
										</span>
									)}
								</span>
								{countryChanges && (
									<span className="rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-black">
										Draft
									</span>
								)}
								<ChevronDownIcon className="h-4 w-4 text-gray-400" />
							</button>
							{openField === "country" && (
								<div className="mt-2 rounded-lg bg-black/30 p-2 ring-1 ring-white/10">
									<PickList
										label="Search countries"
										items={countryItems(preview)}
										value={country}
										onChoose={pickCountry}
										search
										autoFocus
										className="max-h-56"
									/>
								</div>
							)}
							{guessed && country === now.country && (
								<label
									data-confirm-guess
									className="mt-2 flex cursor-pointer items-start gap-2.5 text-xs text-gray-300"
								>
									<input
										type="checkbox"
										checked={confirmGuess}
										onChange={(e) => setConfirmGuess(e.target.checked)}
										className="mt-0.5 h-4 w-4 cursor-pointer accent-amber-300"
									/>
									<span>
										{countryName(country)} is our guess from where you connect,
										and nothing is saved yet. Tick to save it as your country.
									</span>
								</label>
							)}
							{companions.length > 0 && (
								<fieldset
									data-companion
									className="mt-3 rounded-lg border border-dashed border-white/20 p-3"
								>
									<legend className="px-1 text-xs text-gray-400">
										Optional
									</legend>
									{companions.map((c) => (
										<label
											key={c}
											className="flex cursor-pointer items-start gap-2.5 py-1 text-sm text-white"
										>
											<input
												type="checkbox"
												checked={companion === c}
												onChange={(e) =>
													setCompanion(e.target.checked ? c : null)
												}
												className="mt-0.5 h-4 w-4 cursor-pointer accent-amber-300"
											/>
											<span>
												Also show titles in {langLabel(c)}{" "}
												<span className="text-gray-400">
													({LANG_NAME[c].own})
												</span>
											</span>
										</label>
									))}
									<p className="mt-1 text-xs text-gray-400">
										Off unless you tick it. Titles stay in {langLabel(now.lang)}
										: the country does not decide the language.
									</p>
								</fieldset>
							)}
						</div>

						<div>
							<p id="a-lang" className="text-sm font-semibold text-white">
								Titles in
							</p>
							<p className="mb-2 text-xs text-gray-400">
								Titles, posters, descriptions and episode text. Menus and
								buttons stay in English.
							</p>
							<button
								ref={langButton}
								type="button"
								data-field="lang"
								aria-labelledby="a-lang a-lang-value"
								aria-expanded={openField === "lang"}
								onClick={() =>
									setOpenField(openField === "lang" ? null : "lang")
								}
								className={fieldButton}
							>
								<span id="a-lang-value" className="flex-1">
									{langLabel(draftLang)}{" "}
									<span className="ml-2 text-xs text-gray-400">
										{choice === "browser"
											? "browser default"
											: companion
												? `with ${countryName(country)}`
												: "your choice"}
									</span>
								</span>
								{choice !== savedChoice && (
									<span className="rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-black">
										Draft
									</span>
								)}
								<ChevronDownIcon className="h-4 w-4 text-gray-400" />
							</button>
							{openField === "lang" && (
								<div className="mt-2 rounded-lg bg-black/30 p-2 ring-1 ring-white/10">
									<PickList
										label="Titles in"
										items={langItems(s.browserLang)}
										value={lang}
										onChoose={pickLang}
										autoFocus
										className="max-h-56"
									/>
								</div>
							)}
							{choice !== "browser" && openField !== "lang" && (
								<button
									type="button"
									onClick={() => pickLang("browser")}
									className="mt-2 cursor-pointer text-xs text-gray-300 underline decoration-white/30 underline-offset-2 hover:text-white"
								>
									Follow my browser again ({langLabel(s.browserLang)})
								</button>
							)}
						</div>
					</div>

					<div className="min-w-0 rounded-xl bg-black/30 p-3 ring-1 ring-white/10 sm:p-4">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-sm font-semibold text-white">Preview</p>
							<div className="flex flex-wrap gap-1 text-xs">
								{TITLES.map((t) => (
									<button
										key={t.id}
										type="button"
										aria-pressed={t.id === previewId}
										onClick={() => setPreviewId(t.id)}
										className={`cursor-pointer rounded-full px-2 py-1 ${t.id === previewId ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"}`}
									>
										{t.text.en.title}
									</button>
								))}
							</div>
						</div>
						<div
							role="tablist"
							aria-label="Preview"
							className="mt-3 flex rounded-full bg-white/8 p-0.5 text-xs sm:hidden"
						>
							{(["before", "after"] as const).map((k) => (
								<button
									key={k}
									type="button"
									role="tab"
									aria-selected={side === k}
									onClick={() => setSide(k)}
									className={`flex-1 cursor-pointer rounded-full py-1.5 ${side === k ? "bg-white font-semibold text-black" : "text-gray-300"}`}
								>
									{k === "before" ? "Now" : "After saving"}
								</button>
							))}
						</div>
						<div className="mt-3 grid gap-4 sm:grid-cols-2">
							<div
								className={`min-w-0 ${side === "before" ? "" : "max-sm:hidden"}`}
							>
								<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 max-sm:hidden">
									Now
								</p>
								<MiniTitle
									title={preview}
									country={now.country}
									lang={now.lang}
								/>
							</div>
							<div
								data-after
								className={`min-w-0 ${side === "after" ? "" : "max-sm:hidden"}`}
							>
								<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300 max-sm:hidden">
									After saving
								</p>
								<MiniTitle
									title={preview}
									country={country}
									lang={draftLang}
									than={now}
								/>
							</div>
						</div>
						<dl
							data-changes
							className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-[13px] text-gray-300"
						>
							<div className="flex flex-wrap gap-x-2">
								<dt className="w-20 shrink-0 text-gray-500">Country</dt>
								<dd className="min-w-0 flex-1">
									{country !== now.country ? (
										<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
											<span>
												{countryName(now.country)} (
												{sourceWords(now, s.place).country}) →{" "}
												<b className="text-white">{countryName(country)}</b>
											</span>
											<span className="flex items-center gap-1.5 text-gray-400">
												<OfferLine title={preview} country={country} />
											</span>
										</span>
									) : change.country ? (
										<>
											{countryName(country)}: our guess →{" "}
											<b className="text-white">your saved choice</b>
										</>
									) : (
										`Stays ${countryName(now.country)} (${sourceWords(now, s.place).country})`
									)}
								</dd>
							</div>
							<div className="flex flex-wrap gap-x-2">
								<dt className="w-20 shrink-0 text-gray-500">Titles in</dt>
								<dd className="min-w-0 flex-1">
									{change.lang ? (
										<>
											{langLabel(now.lang)} ({sourceWords(now, s.place).lang}) →{" "}
											<b className="text-white">{langLabel(draftLang)}</b> (
											{choice === "browser" ? "browser default" : "your choice"}
											)
										</>
									) : (
										`Stay ${langLabel(now.lang)} (${sourceWords(now, s.place).lang})`
									)}
								</dd>
							</div>
						</dl>
						<div className="mt-2">
							<MissingLine shown={after} lang={draftLang} />
						</div>
					</div>
				</fieldset>
			</div>

			<div
				className={`${inline ? "mt-5" : "border-t border-white/10 p-4 sm:px-6"}`}
			>
				{failed && (
					<p
						role="alert"
						data-save-error
						className="mb-3 flex items-start gap-2 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-100 ring-1 ring-red-400/40"
					>
						<ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
						<span>
							That didn't save. Nothing changed: you still have{" "}
							{countryName(now.country)} and {langLabel(now.lang)}. Your draft
							is still here.
						</span>
					</p>
				)}
				<div className="flex flex-wrap items-center justify-end gap-2">
					<output
						data-save-status
						className="block mr-auto text-xs text-gray-400"
					>
						{s.saving
							? "Saving. This stays open until it has an answer."
							: s.persona.viewer === "member"
								? "Saves to your account, for every device."
								: "Saves on this device. Sign in to keep it on every device."}
					</output>
					{(!inline || words) && (
						<Btn kind="ghost" data-cancel disabled={s.saving} onClick={cancel}>
							{inline ? "Discard changes" : "Cancel"}
						</Btn>
					)}
					<Btn
						kind="primary"
						data-save
						disabled={!words}
						busy={s.saving}
						onClick={save}
					>
						{s.saving
							? "Saving"
							: failed
								? `Try again: save ${words}`
								: words
									? `Save ${words}`
									: "Nothing to save"}
					</Btn>
				</div>
			</div>
		</div>
	)
}

export function VariantA() {
	const s = useStore()
	const [open, setOpen] = useState<{ country?: Country } | null>(null)
	// A discarded or saved inline draft starts over from what is saved.
	const [round, setRound] = useState(0)
	// Escape, a press outside and the close button do nothing while a save is under way: the panel stays to show
	// whether it landed.
	const close = () => {
		if (!s.saving) return setOpen(null)
		// The dialog library drops the focus on Escape before it asks to close. The dialog stays, so the focus goes
		// back to the button that is saving.
		requestAnimationFrame(() =>
			document.querySelector<HTMLElement>("[role=dialog] [data-save]")?.focus(),
		)
	}
	if (s.surface === "settings")
		return (
			<SettingsPage>
				<Panel
					key={`${round}-${s.saved.country}-${s.saved.lang}`}
					inline
					onClose={() => setRound(round + 1)}
				/>
			</SettingsPage>
		)
	return (
		<>
			<TitlePage
				slots={{
					countryControl: (
						<button
							type="button"
							data-country
							onClick={() => setOpen({})}
							aria-haspopup="dialog"
							aria-label={`Country: ${countryName(s.effective.country)}${s.effective.countrySource === "guess" ? ", our guess" : ""}. Change country and language`}
							className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-1.5 text-xs text-gray-300 hover:bg-white/10"
						>
							<Flag code={s.effective.country} className="h-2.5" />
							<span className="max-sm:hidden">{s.effective.country}</span>
							<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
						</button>
					),
					regionControl: (
						<Btn data-region-change onClick={() => setOpen({})}>
							Change
						</Btn>
					),
					onOtherCountry: (country) => setOpen({ country }),
				}}
			/>
			<Dialog open={open !== null} onClose={close} className="relative z-[60]">
				<DialogBackdrop className="fixed inset-0 bg-black/70" />
				<div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
					<DialogPanel className="flex max-h-[92dvh] w-full max-w-5xl flex-col rounded-t-2xl border border-white/10 bg-stone-900 shadow-2xl sm:rounded-2xl">
						<div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
							<DialogTitle className="text-lg font-semibold text-white">
								Country and language
							</DialogTitle>
							<button
								type="button"
								onClick={close}
								disabled={s.saving}
								aria-label="Close without saving"
								className="cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10 disabled:cursor-default disabled:opacity-40"
							>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						{open && (
							<Panel
								startCountry={open.country}
								onClose={() => setOpen(null)}
							/>
						)}
					</DialogPanel>
				</div>
			</Dialog>
		</>
	)
}
