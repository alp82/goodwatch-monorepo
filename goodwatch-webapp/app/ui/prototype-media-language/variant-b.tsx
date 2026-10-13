// PROTOTYPE - throwaway. Variant B of /prototype/media-language: look around, then keep it.
//
// No dialog and no draft. Picking a country in the where-to-watch box is a look: the offers change at once, nothing
// is saved, and a line in place says so with the two ways out, "Save as my country" and "Back to". After a save the
// same place asks, once and without a default, whether titles should follow. The language is its own small control
// beside the content it changes; a pick there is saved at once and can be undone. On the settings page the two are
// separate rows that save by themselves.
//
// Every save here is one write, and Undo takes back the last write only: after a country and then its language,
// Undo returns the language. Undo of a saved country returns to the country before it, not to the look.
import {
	AdjustmentsHorizontalIcon,
	CheckCircleIcon,
	ChevronDownIcon,
	ExclamationTriangleIcon,
	EyeIcon,
	LanguageIcon,
} from "@heroicons/react/24/solid"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { type Country, type Lang, countryName } from "./fixtures"
import { SettingsPage, TitlePage } from "./host"
import {
	type LangChoice,
	companionsOf,
	langLabel,
	sourceWords,
	useStore,
} from "./model"
import {
	Btn,
	Flag,
	PickList,
	countryItems,
	focusSoon,
	langItems,
	useReturnFocus,
} from "./parts"

/**
 * A panel under its button. Escape, a press outside and the focus leaving close it. Closing gives the focus back to
 * the button when it would otherwise be on nothing.
 */
function Popover({
	button,
	open,
	onClose,
	align = "right",
	children,
}: {
	button: ReactNode
	open: boolean
	onClose: () => void
	align?: "left" | "right"
	children: ReactNode
}) {
	const ref = useRef<HTMLDivElement>(null)
	const was = useRef(open)
	useEffect(() => {
		if (
			was.current &&
			!open &&
			(!document.activeElement || document.activeElement === document.body)
		)
			ref.current
				?.querySelector<HTMLElement>("button")
				?.focus({ preventScroll: true })
		was.current = open
	}, [open])
	useEffect(() => {
		if (!open) return
		const down = (e: PointerEvent) => {
			if (!ref.current?.contains(e.target as Node)) onClose()
		}
		const key = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			onClose()
			ref.current?.querySelector<HTMLElement>("button")?.focus()
		}
		document.addEventListener("pointerdown", down)
		document.addEventListener("keydown", key)
		return () => {
			document.removeEventListener("pointerdown", down)
			document.removeEventListener("keydown", key)
		}
	}, [open, onClose])
	return (
		<div
			ref={ref}
			className="relative shrink-0"
			onBlur={(e) => {
				// Tab moved the focus to something outside: the panel must not stay open behind it.
				if (
					open &&
					e.relatedTarget &&
					!e.currentTarget.contains(e.relatedTarget as Node)
				)
					onClose()
			}}
		>
			{button}
			{open && (
				<div
					className={`absolute top-full z-40 mt-2 w-80 max-w-[calc(100vw-2.5rem)] rounded-xl border border-white/10 bg-stone-900 p-3 text-left shadow-2xl ${align === "right" ? "right-0" : "left-0"}`}
				>
					{children}
				</div>
			)}
		</div>
	)
}

/** The language control: a chip that opens the list. A pick saves at once. */
function LangChip({ align = "right" }: { align?: "left" | "right" }) {
	const s = useStore()
	const [open, setOpen] = useState(false)
	const [pending, setPending] = useState<LangChoice | null>(null)
	const [failed, setFailed] = useState<LangChoice | null>(null)
	const current: LangChoice = s.saved.lang ?? "browser"
	const pick = async (choice: LangChoice) => {
		setOpen(false)
		setFailed(null)
		if (choice === current) return
		setPending(choice)
		const to =
			choice === "browser"
				? `Titles follow your browser again (${langLabel(s.browserLang)})`
				: `Titles are now in ${langLabel(choice)}`
		const result = await s.save(
			{ lang: choice },
			{ toast: `${to}. Saved to ${s.place}.` },
		)
		setPending(null)
		if (result === "failed") setFailed(choice)
	}
	const name = (c: LangChoice) =>
		c === "browser" ? langLabel(s.browserLang) : langLabel(c)
	const source =
		s.effective.langSource === "browser" ? "browser default" : "your choice"
	return (
		<span className="inline-flex flex-wrap items-center justify-end gap-2">
			{failed && (
				<span
					role="alert"
					data-lang-error
					className="inline-flex items-center gap-1.5 text-xs text-red-200"
				>
					<ExclamationTriangleIcon className="h-3.5 w-3.5" />
					{name(failed)} didn't save. Titles stay in{" "}
					{langLabel(s.effective.lang)}.
					<button
						type="button"
						onClick={() => pick(failed)}
						className="cursor-pointer font-semibold underline"
					>
						Try again
					</button>
				</span>
			)}
			<Popover
				open={open}
				onClose={() => setOpen(false)}
				align={align}
				button={
					<button
						type="button"
						data-lang-chip
						aria-haspopup="listbox"
						aria-expanded={open}
						aria-busy={pending !== null}
						onClick={() => setOpen(!open)}
						className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs text-gray-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-amber-300"
					>
						<LanguageIcon className="h-3.5 w-3.5 text-gray-400" />
						{pending ? (
							<span>Saving {name(pending)}…</span>
						) : (
							<span>
								Titles in{" "}
								<b className="font-semibold text-white">
									{langLabel(s.effective.lang)}
								</b>
								<span className="text-gray-400"> · {source}</span>
							</span>
						)}
						<ChevronDownIcon className="h-3 w-3 text-gray-400" />
					</button>
				}
			>
				<p className="text-xs font-semibold text-gray-300">
					Titles, posters and descriptions in
				</p>
				<p className="mb-2 text-xs text-gray-500">
					Menus and buttons stay in English. Your pick is saved to {s.place}{" "}
					right away.
				</p>
				<PickList
					label="Titles in"
					items={langItems(s.browserLang)}
					value={current}
					onChoose={pick}
					autoFocus
					className="max-h-72"
				/>
			</Popover>
		</span>
	)
}

type Ask = { country: Country; langs: Lang[] }

/** What the where-to-watch box says while a country is only looked at, and right after it was saved. */
function LookLine({
	ask,
	setAsk,
	wide = false,
}: { ask: Ask | null; setAsk: (a: Ask | null) => void; wide?: boolean }) {
	const s = useStore()
	const [failed, setFailed] = useState(false)
	const looking = s.look.country
	const home = s.base.country
	// A guest's country may be a guess: then nothing is "theirs" yet, and the line must not say so.
	const homeWords =
		s.base.countrySource === "guess"
			? `we still guess you are in ${countryName(home)}`
			: `your country is still ${countryName(home)}`
	const keep = async () => {
		if (!looking) return
		setFailed(false)
		const langBefore = s.effective.lang
		const result = await s.save({ country: looking })
		if (result === "failed") return setFailed(true)
		setAsk({ country: looking, langs: companionsOf(looking, langBefore) })
		focusSoon("[data-kept]")
	}
	const shell = wide ? "mx-auto mt-3 max-w-7xl px-4 sm:px-6 lg:px-8" : "mt-2.5"
	if (looking)
		return (
			<div className={shell}>
				<div
					data-look
					className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2 text-sm ring-1 ${failed ? "bg-red-950 text-red-100 ring-red-400/40" : "bg-amber-300/10 text-amber-100 ring-amber-300/40"}`}
				>
					<span
						role={failed ? "alert" : undefined}
						className="flex min-w-0 flex-1 basis-72 items-start gap-2"
					>
						{failed ? (
							<ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
						) : (
							<EyeIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
						)}
						<span>
							{failed ? (
								<>
									{countryName(looking)} didn't save. You are still only
									looking; {homeWords}.
								</>
							) : (
								<>
									<b className="font-semibold text-white">
										Looking at {countryName(looking)}.
									</b>{" "}
									Not saved: {homeWords}
									{s.lookScope === "visit"
										? ", and this look stays until you end it."
										: ", and the look ends when you leave this title."}
								</>
							)}
						</span>
					</span>
					<span className="flex shrink-0 gap-2">
						<Btn kind="look" data-keep busy={s.saving} onClick={keep}>
							{failed ? "Try again" : "Save as my country"}
						</Btn>
						<Btn
							data-back
							disabled={s.saving}
							onClick={() => {
								s.clearLook(`look ended: back to ${home}`)
								focusSoon("[data-country]")
							}}
						>
							Back to {countryName(home)}
						</Btn>
					</span>
				</div>
			</div>
		)
	if (ask)
		return (
			<div className={shell}>
				{/* Takes the focus when the button that led here is gone, so the keyboard stays where the answer is. */}
				<div
					data-kept
					tabIndex={-1}
					className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-100 outline-none ring-1 ring-green-400/30 focus-visible:ring-2 focus-visible:ring-amber-300"
				>
					<p className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<CheckCircleIcon className="h-4 w-4 shrink-0 text-green-400" />
						<span className="flex-1">
							{countryName(ask.country)} is now your country, saved to {s.place}
							.
						</span>
						{s.canUndo && (
							<button
								type="button"
								onClick={() => {
									s.undo()
									setAsk(null)
									focusSoon("[data-country]")
								}}
								className="cursor-pointer font-semibold underline"
							>
								Undo
							</button>
						)}
						<button
							type="button"
							onClick={() => {
								setAsk(null)
								focusSoon("[data-country]")
							}}
							className="cursor-pointer text-green-200/70 hover:text-white"
						>
							Dismiss
						</button>
					</p>
					{ask.langs.length > 0 && (
						<p
							data-companion-ask
							className="mt-2 flex flex-wrap items-center gap-2 border-t border-green-400/20 pt-2 text-gray-200"
						>
							<span className="flex-1 basis-40">
								Titles are still in {langLabel(s.effective.lang)}. That is a
								separate setting.
							</span>
							{ask.langs.map((l) => (
								<Btn
									key={l}
									busy={s.saving}
									onClick={async () => {
										const result = await s.save(
											{ lang: l },
											{
												toast: `Titles are now in ${langLabel(l)}. Saved to ${s.place}.`,
											},
										)
										if (result === "failed")
											s.say(
												`${langLabel(l)} didn't save. Titles stay in ${langLabel(s.effective.lang)}.`,
												{ tone: "error" },
											)
										else {
											setAsk(null)
											focusSoon("[data-country]")
										}
									}}
								>
									Show titles in {langLabel(l)}
								</Btn>
							))}
							<Btn
								kind="ghost"
								data-keep-lang
								onClick={() => {
									setAsk({ ...ask, langs: [] })
									focusSoon("[data-kept]")
								}}
							>
								Keep {langLabel(s.effective.lang)}
							</Btn>
						</p>
					)}
				</div>
			</div>
		)
	return null
}

type RowState = "idle" | "saved" | "failed"

/** One setting of the settings page: its value, where it comes from, and a list that saves the pick at once. */
function SettingRow({
	name,
	help,
	value,
	source,
	state,
	onRetry,
	onUndo,
	children,
}: {
	name: string
	help: string
	value: ReactNode
	source: string
	state: RowState
	onRetry: () => void
	onUndo: () => void
	children: (close: () => void) => ReactNode
}) {
	const s = useStore()
	const [open, setOpen] = useState(false)
	const change = useReturnFocus(open)
	return (
		<div
			data-row={name}
			className="rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10"
		>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<div className="min-w-0 flex-1 basis-56">
					<p className="text-sm font-semibold text-white">{name}</p>
					<p className="text-xs text-gray-400">{help}</p>
				</div>
				<div className="flex items-center gap-3">
					<span className="text-right">
						<span
							data-row-value
							className="flex items-center justify-end gap-2 text-sm font-semibold text-white"
						>
							{value}
						</span>
						<span className="block text-xs text-gray-400">{source}</span>
					</span>
					<button
						ref={change}
						type="button"
						aria-expanded={open}
						aria-label={`${open ? "Close" : "Change"} ${name}`}
						onClick={() => setOpen(!open)}
						className="inline-flex min-h-9 cursor-pointer items-center rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
					>
						{open ? "Close" : "Change"}
					</button>
				</div>
			</div>
			{open && (
				<div className="mt-3 rounded-lg bg-black/30 p-2 ring-1 ring-white/10">
					{children(() => setOpen(false))}
				</div>
			)}
			{state === "saved" && (
				<p
					data-row-saved
					className="mt-2 flex items-center gap-2 text-xs text-green-300"
				>
					<CheckCircleIcon className="h-4 w-4" />
					Saved to {s.place}.
					{s.canUndo && (
						<button
							type="button"
							onClick={onUndo}
							className="cursor-pointer font-semibold underline"
						>
							Undo
						</button>
					)}
				</p>
			)}
			{state === "failed" && (
				<p
					role="alert"
					className="mt-2 flex items-center gap-2 text-xs text-red-200"
				>
					<ExclamationTriangleIcon className="h-4 w-4" />
					That didn't save. Nothing changed.
					<button
						type="button"
						onClick={onRetry}
						className="cursor-pointer font-semibold underline"
					>
						Try again
					</button>
				</p>
			)}
		</div>
	)
}

function SettingsB() {
	const s = useStore()
	const words = sourceWords(s.effective, s.place)
	const [countryState, setCountryState] = useState<RowState>("idle")
	const [langState, setLangState] = useState<RowState>("idle")
	const [last, setLast] = useState<{ country?: Country; lang?: LangChoice }>({})
	const [ask, setAsk] = useState<Ask | null>(null)
	const saveCountry = async (country: Country) => {
		setLast((l) => ({ ...l, country }))
		setLangState("idle")
		if (country === s.saved.country) return
		const langBefore = s.effective.lang
		const result = await s.save({ country })
		setCountryState(result)
		setAsk(
			result === "saved"
				? { country, langs: companionsOf(country, langBefore) }
				: null,
		)
	}
	const saveLang = async (lang: LangChoice) => {
		setLast((l) => ({ ...l, lang }))
		setCountryState("idle")
		setAsk(null)
		if (lang === (s.saved.lang ?? "browser")) return
		setLangState(await s.save({ lang }))
	}
	// Undo takes back the last write. Every line that spoke of that write goes with it: the "Saved" mark and the
	// question about the language of a country that is no longer the saved one.
	const undo = () => {
		s.undo()
		setCountryState("idle")
		setLangState("idle")
		setAsk(null)
	}
	return (
		<div className="space-y-3">
			<SettingRow
				name="Country"
				help="Decides which services and offers you see."
				value={
					<>
						<Flag code={s.effective.country} />
						{countryName(s.effective.country)}
					</>
				}
				source={words.country}
				state={countryState}
				onRetry={() => last.country && saveCountry(last.country)}
				onUndo={undo}
			>
				{(close) => (
					<PickList
						label="Search countries"
						items={countryItems(s.title).map((i) => ({
							...i,
							right: undefined,
						}))}
						value={s.effective.country}
						search
						autoFocus
						onChoose={(c) => {
							close()
							saveCountry(c)
						}}
					/>
				)}
			</SettingRow>
			{ask && ask.langs.length > 0 && (
				<p
					data-companion-ask
					className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-gray-200 ring-1 ring-white/10"
				>
					<span className="flex-1 basis-48">
						Titles are still in {langLabel(s.effective.lang)}. That is the
						setting below, and it did not change.
					</span>
					{ask.langs.map((l) => (
						<Btn key={l} busy={s.saving} onClick={() => saveLang(l)}>
							Show titles in {langLabel(l)}
						</Btn>
					))}
					<Btn kind="ghost" onClick={() => setAsk(null)}>
						Keep {langLabel(s.effective.lang)}
					</Btn>
				</p>
			)}
			<SettingRow
				name="Titles in"
				help="Titles, posters, descriptions and episode text. Menus and buttons stay in English."
				value={langLabel(s.effective.lang)}
				source={words.lang}
				state={langState}
				onRetry={() => last.lang && saveLang(last.lang)}
				onUndo={undo}
			>
				{(close) => (
					<PickList
						label="Titles in"
						items={langItems(s.browserLang)}
						value={s.saved.lang ?? "browser"}
						autoFocus
						onChoose={(l) => {
							close()
							saveLang(l)
						}}
					/>
				)}
			</SettingRow>
			<p className="text-xs text-gray-400">
				Each setting saves when you pick, and Undo takes back the last pick
				only. Looking at another country on a title page does not change these.
			</p>
		</div>
	)
}

export function VariantB() {
	const s = useStore()
	const [listOpen, setListOpen] = useState(false)
	const [ask, setAsk] = useState<Ask | null>(null)
	const home = s.base.country
	const guessed = s.base.countrySource === "guess"
	const titleId = s.titleId
	// The line about a saved country belongs to the title it was saved on.
	useEffect(() => setAsk(null), [titleId])
	if (s.surface === "settings")
		return (
			<SettingsPage>
				<SettingsB />
			</SettingsPage>
		)
	const lookAt = (country: Country) => {
		setListOpen(false)
		setAsk(null)
		if (country === home) s.clearLook(`look ended: back to ${home}`)
		else s.setLook({ country })
	}
	const looking = Boolean(s.look.country)
	// A guessed country becomes the visitor's own only when they say so, here.
	const confirmGuess = async () => {
		setListOpen(false)
		const result = await s.save(
			{ country: home },
			{
				toast: `${countryName(home)} is now your country. Saved to ${s.place}.`,
			},
		)
		if (result === "failed")
			s.say(`${countryName(home)} didn't save. It is still only our guess.`, {
				tone: "error",
			})
	}
	const line = (
		<LookLine
			ask={ask}
			setAsk={setAsk}
			wide={s.lookScope === "visit" && looking}
		/>
	)
	return (
		<TitlePage
			slots={{
				countryControl: (
					<Popover
						open={listOpen}
						onClose={() => setListOpen(false)}
						button={
							<button
								type="button"
								data-country
								onClick={() => setListOpen(!listOpen)}
								aria-expanded={listOpen}
								aria-label={`Country: ${countryName(s.effective.country)}${looking ? ", only looking" : guessed ? ", our guess" : ""}. Look at another country`}
								className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-1.5 text-xs hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300 ${looking ? "bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/50" : "text-gray-300"}`}
							>
								{looking && <EyeIcon className="h-3.5 w-3.5" />}
								<Flag code={s.effective.country} className="h-2.5" />
								<span className="max-sm:hidden">{s.effective.country}</span>
								<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
							</button>
						}
					>
						<p className="text-xs font-semibold text-gray-300">
							Look at another country
						</p>
						<p className="mb-2 text-xs text-gray-500">
							Only a look: nothing is saved until you say so. Titles stay in{" "}
							{langLabel(s.effective.lang)}.
						</p>
						<PickList
							label="Search countries"
							items={countryItems(s.title)}
							value={s.effective.country}
							onChoose={lookAt}
							search
							autoFocus
							className="max-h-72"
						/>
						{guessed && !looking && (
							<p
								data-confirm-guess
								className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2 text-xs text-gray-400"
							>
								<span className="flex-1 basis-32">
									{countryName(home)} is our guess. Nothing is saved yet.
								</span>
								<Btn busy={s.saving} onClick={confirmGuess}>
									Save {countryName(home)} as my country
								</Btn>
							</p>
						)}
					</Popover>
				),
				watchNotice: s.lookScope === "visit" && looking ? undefined : line,
				pageNotice: s.lookScope === "visit" && looking ? line : undefined,
				aboutControl: <LangChip />,
				regionControl: (
					<span className="flex flex-wrap items-center justify-end gap-2">
						{s.persona.viewer === "member" && (
							<Btn kind="ghost" onClick={() => s.setSurface("settings")}>
								Settings
							</Btn>
						)}
					</span>
				),
				onOtherCountry: lookAt,
			}}
		/>
	)
}
