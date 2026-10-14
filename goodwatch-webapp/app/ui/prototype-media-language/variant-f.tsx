// PROTOTYPE - throwaway. Variant F of /prototype/media-language (round two): pick in a small dialog, decide on the
// page. The pair in the title bar opens a compact dialog with one list at a time (country or titles). A pick closes
// it and the page shows the result at once. The decision then waits under the pair, on the page: Keep or Undo, and
// for a new country an unticked offer of its language. Nothing is saved until Keep.
import {
	Dialog,
	DialogBackdrop,
	DialogPanel,
	DialogTitle,
} from "@headlessui/react"
import { XMarkIcon } from "@heroicons/react/24/solid"
import { useState } from "react"
import { type Country, LANG_NAME, countryName } from "./fixtures"
import { TitlePage } from "./host"
import {
	type LangChoice,
	companionsOf,
	langLabel,
	sourceWords,
	useStore,
} from "./model"
import { Btn, PickList, countryItems, langItems } from "./parts"
import {
	HeaderOverlay,
	PairChip,
	pairLabel,
	useDraftLang,
	useOverlay,
} from "./round2"

type Tab = "country" | "lang"

export function VariantF() {
	const s = useStore()
	const { savedChoice, langOf } = useDraftLang()
	const [dialog, setDialog] = useState(false)
	const [tab, setTab] = useState<Tab>("country")
	const [choice, setChoice] = useState<LangChoice | null>(null)
	const [companion, setCompanion] = useState<LangChoice | null>(null)
	const [failed, setFailed] = useState(false)
	const base = s.base
	const country = s.look.country ?? base.country
	const finalChoice = companion ?? choice
	const lang = langOf(finalChoice)
	const countryChanged = country !== base.country
	const langChanged = finalChoice !== null && finalChoice !== savedChoice
	const pending = countryChanged || langChanged
	const companions =
		countryChanged && choice === null ? companionsOf(country, base.lang) : []

	const show = (c: Country, l: LangChoice | null) => {
		const shownLang = langOf(l)
		s.setLook({
			country: c !== base.country ? c : undefined,
			lang: shownLang !== base.lang ? shownLang : undefined,
		})
	}
	const undo = () => {
		setChoice(null)
		setCompanion(null)
		setFailed(false)
		s.clearLook("undo: back to what is saved")
	}
	// The decision under the pair: open while something is shown but not saved. Escape and Undo are the same.
	// A press elsewhere leaves it: the visitor is meant to look around the page before deciding.
	const confirm = useOverlay(pending, undo, s.saving, false)
	const keep = async () => {
		setFailed(false)
		const result = await s.save(
			{
				country: countryChanged ? country : undefined,
				lang: langChanged ? (finalChoice ?? undefined) : undefined,
			},
			{
				toast: `Saved: ${[countryChanged && countryName(country), langChanged && langLabel(lang)].filter(Boolean).join(", ")}`,
			},
		)
		if (result === "failed") return setFailed(true)
		setChoice(null)
		setCompanion(null)
	}
	const words = sourceWords(base, s.place)

	return (
		<>
			<TitlePage
				slots={{
					headerControl: (
						<span className="contents">
							<PairChip
								buttonRef={confirm.button}
								country={s.effective.country}
								lang={s.effective.lang}
								state={pending ? "temporary" : "saved"}
								expanded={dialog}
								// The dialog opens on the list used last.
								onClick={() => setDialog(true)}
								label={pairLabel(
									s.effective.country,
									pending && countryChanged ? "not saved" : words.country,
									s.effective.lang,
									pending && langChanged ? "not saved" : words.lang,
									"Change",
								)}
							/>
							{pending && (
								<HeaderOverlay
									panelRef={confirm.ref}
									label="Keep this?"
									className="w-[17rem]"
								>
									<div className="p-3">
										<p className="text-sm font-semibold text-white">
											Keep this?
										</p>
										<p className="mt-0.5 truncate text-xs text-gray-400">
											{[
												countryChanged && countryName(country),
												langChanged && `Titles in ${langLabel(lang)}`,
											]
												.filter(Boolean)
												.join(" · ")}
										</p>
										{/* Reserved, so the panel keeps its height with or without the offer. */}
										<div className="mt-2 h-7">
											{companions.map((l) => (
												<label
													key={l}
													className="flex cursor-pointer items-center gap-2 text-xs text-gray-200"
												>
													<input
														type="checkbox"
														data-companion
														checked={companion === l}
														disabled={s.saving}
														onChange={(e) => {
															const next = e.target.checked ? l : null
															setCompanion(next)
															show(country, next ?? choice)
														}}
														className="h-4 w-4 cursor-pointer accent-amber-300"
													/>
													{langLabel(l)} titles too{" "}
													<span className="text-gray-500">
														{LANG_NAME[l].own}
													</span>
												</label>
											))}
										</div>
										<p
											role={failed ? "alert" : "status"}
											className={`h-5 text-xs ${failed ? "text-red-300" : "text-gray-500"}`}
										>
											{s.saving
												? "Saving…"
												: failed
													? "Didn't save. Nothing changed."
													: "Not saved yet"}
										</p>
										<div className="mt-1 flex justify-end gap-2">
											<Btn
												kind="ghost"
												data-undo
												disabled={s.saving}
												onClick={undo}
											>
												Undo
											</Btn>
											<Btn
												kind="primary"
												data-keep
												busy={s.saving}
												onClick={keep}
											>
												{failed ? "Retry" : "Keep"}
											</Btn>
										</div>
									</div>
								</HeaderOverlay>
							)}
						</span>
					),
					// A country keeps the visitor's own language; an offer taken for the last country goes.
					onOtherCountry: (c) => {
						setCompanion(null)
						show(c, choice)
					},
				}}
			/>
			<Dialog
				open={dialog}
				onClose={() => setDialog(false)}
				className="relative z-[60]"
			>
				<DialogBackdrop className="fixed inset-0 bg-black/60" />
				<div className="fixed inset-0 flex items-start justify-center px-4 pt-28">
					<DialogPanel
						data-f-dialog
						className="w-full max-w-sm rounded-2xl border border-white/10 bg-stone-900 p-3 shadow-2xl"
					>
						<div className="flex items-center gap-2">
							<DialogTitle className="sr-only">
								Country and language
							</DialogTitle>
							<div
								role="tablist"
								aria-label="Change"
								className="flex flex-1 rounded-full bg-white/8 p-0.5 text-xs"
							>
								{(["country", "lang"] as const).map((t) => (
									<button
										key={t}
										type="button"
										role="tab"
										aria-selected={tab === t}
										onClick={() => setTab(t)}
										className={`flex-1 cursor-pointer rounded-full py-1.5 ${tab === t ? "bg-white font-semibold text-black" : "text-gray-300"}`}
									>
										{t === "country"
											? `Country · ${countryName(country)}`
											: `Titles · ${langLabel(lang)}`}
									</button>
								))}
							</div>
							<button
								type="button"
								onClick={() => setDialog(false)}
								aria-label="Close"
								className="cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10"
							>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						{/* One list at a time, in a box of fixed height. */}
						<div className="mt-3 h-[19rem]">
							{tab === "country" ? (
								<PickList
									label="Search countries"
									items={countryItems(s.title)}
									value={country}
									search
									autoFocus
									className="h-[16.25rem]"
									onChoose={(c) => {
										setDialog(false)
										setCompanion(null)
										show(c, choice)
									}}
								/>
							) : (
								<PickList
									label="Titles in"
									items={langItems(s.browserLang)}
									value={finalChoice ?? savedChoice}
									autoFocus
									className="h-[18.5rem]"
									onChoose={(l) => {
										setDialog(false)
										setChoice(l)
										setCompanion(null)
										show(country, l)
									}}
								/>
							)}
						</div>
					</DialogPanel>
				</div>
			</Dialog>
		</>
	)
}
