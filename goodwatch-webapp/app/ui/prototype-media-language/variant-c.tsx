// PROTOTYPE - throwaway. Variant C of /prototype/media-language: compare outcomes, then choose how long.
//
// Not a form. The visitor sets a "what if" country and language, and the board lays the outcomes side by side as
// whole title pages in small: what is saved, only the country, only the language, both. A country brings its
// language as one more outcome, marked as a suggestion and never picked for them. Two decisions stay apart: which
// outcome (one of the columns) and for how long (the two buttons under them, "Try for this visit" and "Save"). A try
// changes the page until it is reset and saves nothing; the page carries a bar that says so.
//
// Every outcome is measured against what is SAVED, never against a try that happens to be on. So "Only the country"
// saves the country and nothing else, also while another language is being tried.
import {
	Dialog,
	DialogBackdrop,
	DialogPanel,
	DialogTitle,
} from "@headlessui/react"
import {
	AdjustmentsHorizontalIcon,
	ArrowsRightLeftIcon,
	ChevronDownIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	XMarkIcon,
} from "@heroicons/react/24/solid"
import { useEffect, useState } from "react"
import { type Country, type Lang, countryName } from "./fixtures"
import { SettingsPage, TitlePage } from "./host"
import {
	type Change,
	type LangChoice,
	type Look,
	companionsOf,
	langLabel,
	pairWords,
	sourceWords,
	useStore,
} from "./model"
import {
	Btn,
	Flag,
	MiniTitle,
	MissingLine,
	PickList,
	countryItems,
	focusSoon,
	langItems,
	useReturnFocus,
} from "./parts"

interface Outcome {
	key: string
	name: string
	country: Country
	lang: Lang
	/** What a save writes for the language. Absent: this outcome leaves the saved language alone. */
	choice?: LangChoice
	suggested?: boolean
}

const tryWords = (look: Look) =>
	[
		look.country && countryName(look.country),
		look.lang && `titles in ${langLabel(look.lang)}`,
	]
		.filter(Boolean)
		.join(" · ")

function Board({
	startCountry,
	inline = false,
	onClose,
}: { startCountry?: Country; inline?: boolean; onClose: () => void }) {
	const s = useStore()
	// The yardstick: what the visitor returns to without a try. A try on top of it is named, but never compared to.
	const base = s.base
	const trying = Boolean(s.look.country || s.look.lang)
	const savedChoice: LangChoice = s.saved.lang ?? "browser"
	// The "what if" starts at what the page shows, so a board opened during a try can turn that try into a save.
	const [country, setCountry] = useState<Country>(
		startCountry ?? s.effective.country,
	)
	const [choice, setChoice] = useState<LangChoice | null>(s.look.lang ?? null)
	const [openPick, setOpenPick] = useState<"country" | "lang" | null>(null)
	const [picked, setPicked] = useState<string | null>(null)
	const [failed, setFailed] = useState(false)
	const countryButton = useReturnFocus(openPick === "country")
	const langButton = useReturnFocus(openPick === "lang")

	const lang =
		choice === null ? base.lang : choice === "browser" ? s.browserLang : choice
	const countryDiffers = country !== base.country
	// A choice that shows the same language still differs when it changes who decides: the browser or the visitor.
	const langDiffers =
		choice !== null && (lang !== base.lang || choice !== savedChoice)
	const outcomes: Outcome[] = []
	if (countryDiffers)
		outcomes.push({
			key: "country",
			name: "Only the country",
			country,
			lang: base.lang,
		})
	if (langDiffers)
		outcomes.push({
			key: "lang",
			name: "Only the language",
			country: base.country,
			lang,
			choice: choice ?? undefined,
		})
	if (countryDiffers && langDiffers)
		outcomes.push({
			key: "both",
			name: "Both",
			country,
			lang,
			choice: choice ?? undefined,
		})
	if (countryDiffers && choice === null)
		for (const l of companionsOf(country, base.lang))
			outcomes.push({
				key: `with-${l}`,
				name: `Country and ${langLabel(l)} titles`,
				country,
				lang: l,
				choice: l,
				suggested: true,
			})
	// One outcome needs no picking. With several, none is picked for the visitor.
	const selected =
		outcomes.find((o) => o.key === picked) ??
		(outcomes.length === 1 ? outcomes[0] : null)

	useEffect(() => {
		s.setDraft(
			outcomes.length
				? `C board: what if ${country} / ${choice ?? "same language"}; picked ${selected?.key ?? "none"}`
				: null,
		)
		return () => s.setDraft(null)
	}, [outcomes.length, country, choice, selected?.key, s.setDraft])

	const words = (o: Outcome) =>
		`${countryName(o.country)} · titles in ${langLabel(o.lang)}`
	const tryIt = () => {
		if (!selected || s.saving) return
		// The try becomes exactly what the outcome shows; an earlier try does not leak into it.
		s.setLook({
			country: selected.country !== base.country ? selected.country : undefined,
			lang: selected.lang !== base.lang ? selected.lang : undefined,
		})
		s.say(`Trying ${words(selected)} for this visit. Nothing is saved.`)
		onClose()
	}
	const save = async () => {
		if (!selected) return
		setFailed(false)
		setOpenPick(null)
		// Only what the outcome names is written: its country when that differs from the saved one, its language when
		// the outcome carries one.
		const change: Change = {
			country: selected.country !== base.country ? selected.country : undefined,
			lang:
				selected.choice !== undefined && selected.choice !== savedChoice
					? selected.choice
					: undefined,
		}
		const result = await s.save(change, {
			toast: `Saved to ${s.place}: ${words(selected)}`,
		})
		if (result === "failed") setFailed(true)
		else onClose()
	}
	const confirmGuess = async () => {
		setFailed(false)
		const result = await s.save(
			{ country: base.country },
			{
				toast: `${countryName(base.country)} is now your country. Saved to ${s.place}.`,
			},
		)
		if (result === "failed")
			s.say(
				`${countryName(base.country)} didn't save. It is still only our guess.`,
				{ tone: "error" },
			)
	}

	const pickButton =
		"inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-white/[0.08] px-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-default disabled:opacity-60"
	const column = "flex min-w-0 flex-col gap-3 rounded-xl p-3 ring-1"
	const facts = (o: { country: Country; lang: Lang }, isBase: boolean) => (
		<p className="flex flex-wrap gap-1.5 text-xs">
			<span
				className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 ${!isBase && o.country !== base.country ? "bg-amber-300 font-semibold text-black" : "bg-white/10 text-gray-300"}`}
			>
				<Flag code={o.country} className="h-2.5" />
				{countryName(o.country)}
			</span>
			<span
				className={`rounded-full px-2 py-1 ${!isBase && o.lang !== base.lang ? "bg-amber-300 font-semibold text-black" : "bg-white/10 text-gray-300"}`}
			>
				Titles in {langLabel(o.lang)}
			</span>
		</p>
	)
	const baseWords = sourceWords(base, s.place)

	return (
		<div data-board-c aria-busy={s.saving} className="flex min-h-0 flex-col">
			{/* The scroll area is a div: a fieldset does not scroll on a phone. */}
			<div
				className={`min-h-0 ${inline ? "" : "overflow-y-auto overscroll-contain p-4 sm:p-6"}`}
			>
				<fieldset disabled={s.saving} className="min-w-0">
					{trying && !inline && (
						<p
							data-board-trying
							className="mb-4 flex items-start gap-2 rounded-lg bg-amber-300/10 px-3 py-2 text-sm text-amber-100 ring-1 ring-amber-300/40"
						>
							<ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
							<span>
								<b className="font-semibold text-white">
									You are trying {tryWords(s.look)} for this visit.
								</b>{" "}
								The outcomes below are compared with what is saved,{" "}
								{pairWords(base)}, not with the try. Save writes only what an
								outcome names.
							</span>
						</p>
					)}
					{trying && inline && (
						<p data-board-trying className="mb-3 text-sm text-gray-400">
							The outcomes below are compared with what is saved, not with the
							try above. Save writes only what an outcome names.
						</p>
					)}
					<div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-300">
						<span id="c-country">What if I watch from</span>
						<button
							ref={countryButton}
							type="button"
							data-what-if="country"
							aria-labelledby="c-country c-country-value"
							aria-expanded={openPick === "country"}
							onClick={() =>
								setOpenPick(openPick === "country" ? null : "country")
							}
							className={pickButton}
						>
							<Flag code={country} />
							<span id="c-country-value">{countryName(country)}</span>
							<ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
						</button>
						<span id="c-lang">with titles in</span>
						<button
							ref={langButton}
							type="button"
							data-what-if="lang"
							aria-labelledby="c-lang c-lang-value"
							aria-expanded={openPick === "lang"}
							onClick={() => setOpenPick(openPick === "lang" ? null : "lang")}
							className={pickButton}
						>
							<span id="c-lang-value">
								{langLabel(lang)}{" "}
								{(choice ?? savedChoice) === "browser" && (
									<span className="ml-2 text-xs font-normal text-gray-400">
										browser default
									</span>
								)}
							</span>
							<ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
						</button>
						<span>?</span>
					</div>
					{openPick && (
						<div className="mt-2 max-w-sm rounded-lg bg-black/30 p-2 ring-1 ring-white/10">
							{openPick === "country" ? (
								<PickList
									label="Search countries"
									items={countryItems(s.title)}
									value={country}
									search
									autoFocus
									className="max-h-56"
									onChoose={(c) => {
										setCountry(c)
										setPicked(null)
										setOpenPick(null)
										setFailed(false)
									}}
								/>
							) : (
								<PickList
									label="Titles in"
									items={langItems(s.browserLang)}
									value={choice ?? savedChoice}
									autoFocus
									className="max-h-56"
									onChoose={(l) => {
										setChoice(l)
										setPicked(null)
										setOpenPick(null)
										setFailed(false)
									}}
								/>
							)}
						</div>
					)}

					<div
						role="radiogroup"
						aria-label="Outcomes"
						className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]"
					>
						<div
							data-outcome="now"
							className={`${column} bg-black/30 ring-white/10`}
						>
							<div>
								<p data-base-name className="text-sm font-semibold text-white">
									{trying ? "Saved (not what you see now)" : "Now"}
								</p>
								<p className="text-xs text-gray-400">
									Country: {baseWords.country}. Language: {baseWords.lang}.
								</p>
							</div>
							{facts(base, true)}
							<MiniTitle
								title={s.title}
								country={base.country}
								lang={base.lang}
							/>
							{base.countrySource === "guess" && (
								<p
									data-confirm-guess
									className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/10 pt-2 text-xs text-gray-400"
								>
									<span className="flex-1 basis-32">
										{countryName(base.country)} is our guess. Nothing is saved
										yet.
									</span>
									<Btn busy={s.saving} onClick={confirmGuess}>
										Save {countryName(base.country)} as my country
									</Btn>
								</p>
							)}
						</div>
						{outcomes.map((o) => {
							const on = selected?.key === o.key
							return (
								<label
									key={o.key}
									data-outcome={o.key}
									className={`${column} cursor-pointer ${on ? "bg-white/[0.08] ring-2 ring-white" : "bg-white/[0.04] ring-white/15 hover:bg-white/[0.07]"} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber-300`}
								>
									<div className="flex items-start gap-2.5">
										<input
											type="radio"
											name="outcome"
											checked={on}
											onChange={() => setPicked(o.key)}
											className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-white"
										/>
										<div className="min-w-0">
											<p className="text-sm font-semibold text-white">
												{o.name}
											</p>
											<p className="text-xs text-gray-400">
												{o.suggested
													? `A pairing ${countryName(o.country)} suggests. Not chosen for you.`
													: o.key === "country"
														? `Titles stay in ${langLabel(base.lang)}${trying && s.look.lang ? `, the saved language: the ${langLabel(s.look.lang)} you are trying is not part of this` : ""}.`
														: o.key === "lang"
															? `You keep watching from ${countryName(base.country)}.`
															: "Country and language change together."}
											</p>
										</div>
									</div>
									{facts(o, false)}
									<MiniTitle
										title={s.title}
										country={o.country}
										lang={o.lang}
										than={base}
									/>
									<MissingLine
										shown={s.resolve(s.title, o.lang)}
										lang={o.lang}
									/>
								</label>
							)
						})}
						{outcomes.length === 0 && (
							<p
								data-empty
								className="flex items-center rounded-xl border border-dashed border-white/15 p-6 text-sm text-gray-400"
							>
								Change the country or the language above. Each thing that would
								be different appears here, next to what{" "}
								{trying ? "is saved" : "you have now"}.
							</p>
						)}
					</div>
				</fieldset>
			</div>

			<div className={inline ? "mt-4" : "border-t border-white/10 p-4 sm:px-6"}>
				{failed && selected && (
					<p
						role="alert"
						data-save-error
						className="mb-3 flex items-start gap-2 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-100 ring-1 ring-red-400/40"
					>
						<ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
						<span>
							That didn't save. Nothing changed. You can try again, or try{" "}
							{words(selected)} for this visit only.
						</span>
					</p>
				)}
				<div className="flex flex-wrap items-start gap-x-3 gap-y-3">
					<output
						data-picked
						className="block min-w-0 flex-1 basis-56 self-center text-sm text-gray-300 max-sm:basis-full"
					>
						{s.saving ? (
							"Saving. This stays open until it has an answer."
						) : selected ? (
							<>
								Picked: <b className="text-white">{words(selected)}</b>
							</>
						) : outcomes.length > 1 ? (
							"Pick one of the outcomes above. None is picked for you."
						) : (
							"Nothing to apply yet."
						)}
					</output>
					{!inline && (
						<Btn
							kind="ghost"
							data-cancel
							disabled={s.saving}
							onClick={onClose}
							className="max-sm:order-last max-sm:w-full"
						>
							Keep what I have
						</Btn>
					)}
					<span className="flex flex-col items-stretch gap-1 max-sm:flex-1">
						<Btn
							kind="look"
							data-try
							disabled={!selected || s.saving}
							onClick={tryIt}
						>
							<ClockIcon className="h-4 w-4" />
							Try for this visit
						</Btn>
						<span className="text-center text-[11px] text-gray-400">
							Saves nothing
						</span>
					</span>
					<span className="flex flex-col items-stretch gap-1 max-sm:flex-1">
						<Btn
							kind="primary"
							data-save
							disabled={!selected}
							busy={s.saving}
							onClick={save}
						>
							{s.saving
								? "Saving"
								: failed
									? "Try again"
									: s.persona.viewer === "member"
										? "Save to my account"
										: "Save on this device"}
						</Btn>
						<span className="text-center text-[11px] text-gray-400">
							Stays from now on
						</span>
					</span>
				</div>
			</div>
		</div>
	)
}

/**
 * The bar a try leaves on the page: what is tried, what is saved, and the two ways out. On the title page it lies
 * under the title bar, on the settings page over the board.
 */
function VisitBar({ inline = false }: { inline?: boolean }) {
	const s = useStore()
	const [failed, setFailed] = useState(false)
	if (!s.look.country && !s.look.lang) return null
	const tried = tryWords(s.look)
	// Wherever the bar was, the focus goes on to the control that opens the board.
	const next = '[data-country], [data-what-if="country"]'
	const save = async () => {
		setFailed(false)
		const result = await s.save(
			{ country: s.look.country, lang: s.look.lang },
			{ toast: `Saved to ${s.place}: ${tried}` },
		)
		if (result === "failed") setFailed(true)
		else focusSoon(next)
	}
	return (
		<div
			className={
				inline ? "mb-4" : "mx-auto mt-3 max-w-7xl px-4 sm:px-6 lg:px-8"
			}
		>
			<div
				data-visit-bar
				className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2 text-sm ring-1 ${failed ? "bg-red-950 text-red-100 ring-red-400/40" : "bg-amber-300/10 text-amber-100 ring-amber-300/40"}`}
			>
				<span
					role={failed ? "alert" : "status"}
					className="flex min-w-0 flex-1 basis-56 items-start gap-2"
				>
					{failed ? (
						<ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
					) : (
						<ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
					)}
					<span>
						{failed ? (
							"That didn't save. You are still only trying: "
						) : (
							<b className="font-semibold text-white">This visit only: </b>
						)}
						{tried}. Saved is {pairWords(s.base)}.
					</span>
				</span>
				<span className="flex shrink-0 gap-2">
					<Btn kind="look" data-keep busy={s.saving} onClick={save}>
						{failed ? "Try again" : "Save this"}
					</Btn>
					<Btn
						data-back
						disabled={s.saving}
						onClick={() => {
							s.clearLook("try ended: back to what is saved")
							focusSoon(next)
						}}
					>
						Reset
					</Btn>
				</span>
			</div>
		</div>
	)
}

export function VariantC() {
	const s = useStore()
	const [open, setOpen] = useState<{ country?: Country } | null>(null)
	const [round, setRound] = useState(0)
	// Escape, a press outside and the close button do nothing while a save is under way.
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
				<p className="mb-4 text-sm text-gray-400">
					Set a "what if", compare it with what is saved, then decide for how
					long.
				</p>
				<VisitBar inline />
				<Board
					key={`${round}-${s.saved.country}-${s.saved.lang}-${s.look.country}-${s.look.lang}`}
					inline
					onClose={() => setRound(round + 1)}
				/>
			</SettingsPage>
		)
	const trying = Boolean(s.look.country || s.look.lang)
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
							aria-label={`Country: ${countryName(s.effective.country)}${s.look.country ? ", this visit only" : s.effective.countrySource === "guess" ? ", our guess" : ""}. Compare countries and languages`}
							className={`inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-1.5 text-xs hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300 ${s.look.country ? "bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/50" : "text-gray-300"}`}
						>
							{s.look.country && <ClockIcon className="h-3.5 w-3.5" />}
							<Flag code={s.effective.country} className="h-2.5" />
							<span className="max-sm:hidden">{s.effective.country}</span>
							<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
						</button>
					),
					pageNotice: <VisitBar />,
					aboutControl: (
						<button
							type="button"
							data-about-compare
							onClick={() => setOpen({})}
							className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs text-gray-200 hover:bg-white/20"
						>
							<ArrowsRightLeftIcon className="h-3.5 w-3.5 text-gray-400" />
							In {langLabel(s.effective.lang)}
							<span className="text-gray-400">
								·{" "}
								{s.look.lang
									? "this visit"
									: s.effective.langSource === "browser"
										? "browser default"
										: "your choice"}
							</span>
						</button>
					),
					regionControl: (
						<Btn data-region-change onClick={() => setOpen({})}>
							<ArrowsRightLeftIcon className="h-4 w-4" />
							Compare
						</Btn>
					),
					onOtherCountry: (country) => setOpen({ country }),
				}}
			/>
			<Dialog open={open !== null} onClose={close} className="relative z-[60]">
				<DialogBackdrop className="fixed inset-0 bg-black/80" />
				<div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
					<DialogPanel className="flex max-h-[94dvh] w-full max-w-6xl flex-col rounded-t-2xl border border-white/10 bg-stone-900 shadow-2xl sm:rounded-2xl">
						<div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
							<DialogTitle className="text-base font-semibold text-white sm:text-lg">
								Compare before you change anything
							</DialogTitle>
							<button
								type="button"
								onClick={close}
								disabled={s.saving}
								aria-label="Close without changing anything"
								className="cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10 disabled:cursor-default disabled:opacity-40"
							>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						{open && (
							<Board
								startCountry={open.country}
								onClose={() => setOpen(null)}
							/>
						)}
					</DialogPanel>
				</div>
			</Dialog>
			{/* `trying` keeps the page's own marks in step; the bar above carries the words. */}
			<span hidden data-trying={trying} />
		</>
	)
}
