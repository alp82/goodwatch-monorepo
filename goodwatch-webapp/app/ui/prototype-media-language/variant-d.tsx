// PROTOTYPE - throwaway. Variant D of /prototype/media-language (round two): the pair in the title bar opens a small
// panel anchored to it. Every pick in the panel shows at once on the page behind, as a draft. Save keeps it; Cancel or
// Escape put the page back. Using the page (scrolling, a swipe, a tab, a press anywhere) keeps the draft and the panel.
// The pair itself folds the panel away to look at the whole page and opens it again, draft kept, marked by a dot.
// A list opens inside the panel in place of its two rows, so the panel keeps its size.
//
// Language: a pick in the titles list is the visitor's own and survives any later country pick. A new country offers
// its language as one small button; taking it is tied to that country and goes when the country changes again.
import { ArrowLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import { type Country, countryName } from "./fixtures"
import { TitlePage } from "./host"
import {
	type LangChoice,
	companionsOf,
	langLabel,
	sourceWords,
	useStore,
} from "./model"
import { Btn, Flag, PickList, countryItems, langItems } from "./parts"
import {
	HeaderOverlay,
	PairChip,
	pairLabel,
	useDraftLang,
	useOverlay,
} from "./round2"

type View = "rows" | "country" | "lang"

export function VariantD() {
	const s = useStore()
	const { savedChoice, langOf } = useDraftLang()
	const [open, setOpen] = useState(false)
	const [view, setView] = useState<View>("rows")
	// The visitor's pick in the titles list, and a country's suggestion they took. Kept apart on purpose.
	const [choice, setChoice] = useState<LangChoice | null>(null)
	const [companion, setCompanion] = useState<LangChoice | null>(null)
	const [failed, setFailed] = useState(false)
	const base = s.base
	const country = s.look.country ?? base.country
	const finalChoice = choice ?? companion
	const lang = langOf(finalChoice)
	const countryChanged = country !== base.country
	const langChanged = finalChoice !== null && finalChoice !== savedChoice
	const dirty = countryChanged || langChanged
	const companions =
		countryChanged && choice === null && companion === null
			? companionsOf(country, base.lang)
			: []

	// The page shows the draft: the look holds what differs from what is saved.
	const show = (c: Country, l: LangChoice | null) => {
		const shownLang = langOf(l)
		s.setLook({
			country: c !== base.country ? c : undefined,
			lang: shownLang !== base.lang ? shownLang : undefined,
		})
	}
	const discard = () => {
		setOpen(false)
		setView("rows")
		setChoice(null)
		setCompanion(null)
		setFailed(false)
		s.clearLook("draft discarded: the page is back to what is saved")
	}
	// Only Escape (or Cancel) discards. A press or a swipe on the page does nothing to the panel or the draft.
	const { ref, button } = useOverlay(
		open,
		() => (view === "rows" ? discard() : setView("rows")),
		s.saving,
		false,
	)
	// The focus follows the panel: to its first row when it opens, back to the row a list came from when it closes.
	const lastView = useRef<View>("rows")
	useEffect(() => {
		if (open && view === "rows")
			ref.current
				?.querySelector<HTMLElement>(
					`[data-row="${lastView.current === "rows" ? "country" : lastView.current}"]`,
				)
				?.focus({ preventScroll: true })
		lastView.current = view
	}, [open, view, ref])
	const begin = (start?: Country) => {
		setOpen(true)
		setView("rows")
		if (start) {
			setCompanion(null)
			show(start, choice)
		}
	}
	const save = async () => {
		setFailed(false)
		const said = [
			countryChanged && countryName(country),
			langChanged && langLabel(lang),
		]
			.filter(Boolean)
			.join(", ")
		const result = await s.save(
			{
				country: countryChanged ? country : undefined,
				lang: langChanged ? (finalChoice ?? undefined) : undefined,
			},
			{ toast: `Saved: ${said}` },
		)
		if (result === "failed") return setFailed(true)
		setOpen(false)
		setView("rows")
		setChoice(null)
		setCompanion(null)
	}
	const words = sourceWords(base, s.place)
	const row =
		"flex h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-amber-300"
	const chipWords = dirty
		? open
			? "Draft shown on the page. Hide the panel"
			: "Draft not saved. Show the panel"
		: open
			? "Close"
			: "Change"

	return (
		<TitlePage
			slots={{
				headerControl: (
					<span className="contents">
						<PairChip
							buttonRef={button}
							country={s.effective.country}
							lang={s.effective.lang}
							state={dirty ? "draft" : "saved"}
							expanded={open}
							// With a draft the pair folds the panel away and back; without one it simply opens and closes.
							onClick={() =>
								open ? (dirty ? setOpen(false) : discard()) : begin()
							}
							label={pairLabel(
								s.effective.country,
								countryChanged ? "draft" : words.country,
								s.effective.lang,
								langChanged ? "draft" : words.lang,
								chipWords,
							)}
						/>
						{open && (
							<HeaderOverlay panelRef={ref} label="Country and language">
								{view === "rows" ? (
									<div className="flex min-h-0 flex-1 flex-col p-2">
										<button
											type="button"
											data-row="country"
											onClick={() => setView("country")}
											className={row}
										>
											<span className="w-16 shrink-0 text-xs text-gray-400">
												Country
											</span>
											<Flag code={country} />
											<span
												className={`min-w-0 flex-1 truncate ${countryChanged ? "font-semibold text-amber-200" : "text-white"}`}
											>
												{countryName(country)}
												{!countryChanged && base.countrySource === "guess" && (
													<span className="ml-1.5 text-xs font-normal text-gray-500">
														guess
													</span>
												)}
											</span>
											<ChevronRightIcon className="h-4 w-4 text-gray-500" />
										</button>
										<button
											type="button"
											data-row="lang"
											onClick={() => setView("lang")}
											className={row}
										>
											<span className="w-16 shrink-0 text-xs text-gray-400">
												Titles
											</span>
											<span
												className={`min-w-0 flex-1 truncate ${langChanged ? "font-semibold text-amber-200" : "text-white"}`}
											>
												{langLabel(lang)}
												{(finalChoice ?? savedChoice) === "browser" && (
													<span className="ml-1.5 text-xs font-normal text-gray-500">
														browser
													</span>
												)}
											</span>
											<ChevronRightIcon className="h-4 w-4 text-gray-500" />
										</button>
										{/* The offer has its own reserved line, so the panel does not grow when it comes. */}
										<div className="flex h-10 items-center px-3">
											{companions.map((l) => (
												<button
													key={l}
													type="button"
													data-companion
													onClick={() => {
														setCompanion(l)
														show(country, l)
													}}
													className="cursor-pointer rounded-full bg-white/10 px-2.5 py-1 text-xs text-gray-200 hover:bg-white/20"
												>
													+ {langLabel(l)} titles
												</button>
											))}
										</div>
										<div className="mt-auto">
											<p
												data-status
												role={failed ? "alert" : "status"}
												className={`h-5 px-3 text-xs ${failed ? "text-red-300" : "text-gray-500"}`}
											>
												{s.saving
													? "Saving…"
													: failed
														? "Didn't save. Nothing changed."
														: dirty
															? "Shown on the page, not saved"
															: ""}
											</p>
											<div className="flex justify-end gap-2 border-t border-white/10 p-2">
												<Btn
													kind="ghost"
													data-cancel
													disabled={s.saving}
													onClick={discard}
												>
													Cancel
												</Btn>
												<Btn
													kind="primary"
													data-save
													disabled={!dirty}
													busy={s.saving}
													onClick={save}
												>
													{failed ? "Retry" : "Save"}
												</Btn>
											</div>
										</div>
									</div>
								) : (
									<div className="flex min-h-0 flex-1 flex-col p-2">
										<button
											type="button"
											data-back
											onClick={() => setView("rows")}
											className="mb-1 inline-flex h-8 cursor-pointer items-center gap-2 self-start rounded-lg px-2 text-xs text-gray-300 hover:bg-white/10"
										>
											<ArrowLeftIcon className="h-3.5 w-3.5" />
											{view === "country" ? "Country" : "Titles"}
										</button>
										{view === "country" ? (
											<PickList
												label="Search countries"
												items={countryItems(s.title)}
												value={country}
												search
												autoFocus
												className="max-h-[9.75rem]"
												onEscape={() => setView("rows")}
												onChoose={(c) => {
													// The visitor's own language stays; a suggestion taken for the last country goes with it.
													setCompanion(null)
													show(c, choice)
													setView("rows")
												}}
											/>
										) : (
											<PickList
												label="Titles in"
												items={langItems(s.browserLang)}
												value={finalChoice ?? savedChoice}
												autoFocus
												className="max-h-[12.5rem]"
												onEscape={() => setView("rows")}
												onChoose={(l) => {
													setChoice(l)
													setCompanion(null)
													show(country, l)
													setView("rows")
												}}
											/>
										)}
									</div>
								)}
							</HeaderOverlay>
						)}
					</span>
				),
				onOtherCountry: (c) => begin(c),
			}}
		/>
	)
}
