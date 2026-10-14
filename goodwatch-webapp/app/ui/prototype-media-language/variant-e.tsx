// PROTOTYPE - throwaway. Variant E of /prototype/media-language (round two): two independent controls in the title
// bar, country and language, each a small list. A pick applies at once and is not saved: a bar fixed to the bottom of
// the window offers Save and Undo, and lies over the page instead of pushing it. The two never move together: a
// country suggests no language here.
import { ChevronDownIcon, LanguageIcon } from "@heroicons/react/24/solid"
import { useEffect, useState } from "react"
import { type Country, countryName } from "./fixtures"
import { TitlePage } from "./host"
import { type LangChoice, langLabel, sourceWords, useStore } from "./model"
import { Btn, Flag, PickList, countryItems, langItems } from "./parts"
import { LANG_CODE, HeaderOverlay, useDraftLang, useOverlay } from "./round2"

type Bar = "unsaved" | "saved" | "failed" | null

export function VariantE() {
	const s = useStore()
	const { savedChoice, langOf } = useDraftLang()
	const [openList, setOpenList] = useState<"country" | "lang" | null>(null)
	const [choice, setChoice] = useState<LangChoice | null>(null)
	const [bar, setBar] = useState<Bar>(null)
	const base = s.base
	const country = s.look.country ?? base.country
	const lang = langOf(choice)
	const countryChanged = country !== base.country
	const langChanged = choice !== null && choice !== savedChoice
	const dirty = countryChanged || langChanged
	const countryList = useOverlay(openList === "country", () =>
		setOpenList(null),
	)
	const langList = useOverlay(openList === "lang", () => setOpenList(null))

	// Back to what is saved: every temporary value goes at once.
	const revert = () => {
		setChoice(null)
		s.clearLook("undo: back to what is saved")
		setBar(null)
	}
	const show = (c: Country, l: LangChoice | null) => {
		const shownLang = langOf(l)
		const look = {
			country: c !== base.country ? c : undefined,
			lang: shownLang !== base.lang ? shownLang : undefined,
		}
		s.setLook(look)
		setBar(look.country || (l !== null && l !== savedChoice) ? "unsaved" : null)
	}
	const save = async () => {
		const result = await s.save({
			country: countryChanged ? country : undefined,
			lang: langChanged ? (choice ?? undefined) : undefined,
		})
		if (result === "failed") return setBar("failed")
		setChoice(null)
		setBar("saved")
	}
	// "Saved" stays a moment, then the bar goes.
	useEffect(() => {
		if (bar !== "saved") return
		const timer = setTimeout(() => setBar(null), 6000)
		return () => clearTimeout(timer)
	}, [bar])

	const words = sourceWords(base, s.place)
	const trigger =
		"relative inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-gray-100 ring-1 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
	const dot = (
		<span
			aria-hidden="true"
			className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-300 ring-2 ring-black"
		/>
	)

	return (
		<>
			<TitlePage
				slots={{
					headerControl: (
						<span className="contents">
							<button
								ref={countryList.button}
								type="button"
								data-e="country"
								aria-expanded={openList === "country"}
								aria-label={`Country ${countryName(country)}, ${countryChanged ? "not saved" : words.country}. Change`}
								onClick={() =>
									setOpenList(openList === "country" ? null : "country")
								}
								className={`${trigger} w-[3.25rem] sm:w-[4.75rem] ${countryChanged ? "bg-amber-300/10 ring-amber-300/60" : "bg-white/[0.06] ring-white/15"}`}
							>
								<Flag code={country} className="h-3" />
								<span className="hidden sm:inline">{country}</span>
								<ChevronDownIcon className="h-3 w-3 text-gray-400" />
								{countryChanged && dot}
							</button>
							<button
								ref={langList.button}
								type="button"
								data-e="lang"
								aria-expanded={openList === "lang"}
								aria-label={`Titles in ${langLabel(lang)}, ${langChanged ? "not saved" : words.lang}. Change`}
								onClick={() => setOpenList(openList === "lang" ? null : "lang")}
								className={`${trigger} w-[4rem] sm:w-[7.5rem] ${langChanged ? "bg-amber-300/10 ring-amber-300/60" : "bg-white/[0.06] ring-white/15"}`}
							>
								<LanguageIcon className="hidden h-3.5 w-3.5 shrink-0 text-gray-400 sm:block" />
								<span className="sm:hidden">{LANG_CODE[lang]}</span>
								<span className="hidden min-w-0 truncate sm:inline">
									{langLabel(lang)}
								</span>
								<ChevronDownIcon className="h-3 w-3 shrink-0 text-gray-400" />
								{langChanged && dot}
							</button>
							{openList === "country" && (
								<HeaderOverlay
									panelRef={countryList.ref}
									label="Country"
									className="w-[17rem] p-2"
								>
									<PickList
										label="Search countries"
										items={countryItems(s.title)}
										value={country}
										search
										autoFocus
										className="h-[15rem]"
										onEscape={() => setOpenList(null)}
										onChoose={(c) => {
											setOpenList(null)
											show(c, choice)
										}}
									/>
								</HeaderOverlay>
							)}
							{openList === "lang" && (
								<HeaderOverlay
									panelRef={langList.ref}
									label="Titles in"
									className="w-[17rem] p-2"
								>
									<PickList
										label="Titles in"
										items={langItems(s.browserLang)}
										value={choice ?? savedChoice}
										autoFocus
										className="h-[17.5rem]"
										onEscape={() => setOpenList(null)}
										onChoose={(l) => {
											setOpenList(null)
											setChoice(l)
											show(country, l)
										}}
									/>
								</HeaderOverlay>
							)}
						</span>
					),
					onOtherCountry: (c) => show(c, choice),
				}}
			/>
			{/* Fixed to the window, over the page, in the lower right corner (clear of the prototype's key on the left): it
			    never moves anything when it comes or goes. */}
			{bar && (
				<div
					data-save-bar
					role={bar === "failed" ? "alert" : "status"}
					className={`fixed bottom-20 right-2 z-[44] flex h-11 w-[17.5rem] max-w-[calc(100vw-5rem)] items-center gap-2 rounded-full pl-4 pr-1.5 text-sm shadow-2xl ring-1 md:bottom-6 md:right-6 md:h-12 md:w-[20rem] ${
						bar === "failed"
							? "bg-red-950 text-red-100 ring-red-400/40"
							: "bg-stone-800 text-white ring-white/15"
					}`}
				>
					<span className="min-w-0 flex-1 truncate">
						{bar === "unsaved"
							? s.saving
								? "Saving…"
								: "Not saved"
							: bar === "saved"
								? `Saved to ${s.place}`
								: "Didn't save"}
					</span>
					{bar !== "saved" && (
						<Btn
							kind="primary"
							data-save
							busy={s.saving}
							onClick={save}
							className="!min-h-9 rounded-full"
						>
							{bar === "failed" ? "Retry" : "Save"}
						</Btn>
					)}
					<Btn
						kind="ghost"
						data-undo
						disabled={s.saving}
						onClick={() => {
							if (bar === "saved") {
								s.undo()
								setBar(null)
							} else revert()
						}}
						className="!min-h-9 rounded-full"
					>
						Undo
					</Btn>
				</div>
			)}
		</>
	)
}
