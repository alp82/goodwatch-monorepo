// PROTOTYPE - throwaway. Variant G of /prototype/media-language (round two): an edit mode of the title bar itself.
// Edit turns the line under the title into the two controls, country and titles, and the right end of the bar into
// Reset, Done and close. The title stays in view, so it shows each pick at once, as does the rest of the page. The
// bar keeps one height in and out of the mode. Done saves what differs in one step; Reset goes back to what is saved
// and stays in the mode; Escape or close leave without saving. A language picked in the list is the visitor's and
// survives any later country pick. A new country only lifts its language to the top of the list, marked suggested.
import {
	ArrowUturnLeftIcon,
	ChevronDownIcon,
	LanguageIcon,
	PencilIcon,
	XMarkIcon,
} from "@heroicons/react/24/solid"
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
import {
	Btn,
	Flag,
	type PickItem,
	PickList,
	countryItems,
	langItems,
} from "./parts"
import {
	HeaderOverlay,
	LANG_CODE,
	pairLabel,
	useDraftLang,
	useOverlay,
} from "./round2"

export function VariantG() {
	const s = useStore()
	const { savedChoice, langOf } = useDraftLang()
	const [editing, setEditing] = useState(false)
	const [openList, setOpenList] = useState<"country" | "lang" | null>(null)
	// The visitor's own pick in the titles list; null while they have picked none. A country never sets or clears it.
	const [choice, setChoice] = useState<LangChoice | null>(null)
	const [failed, setFailed] = useState(false)
	const base = s.base
	const country = s.look.country ?? base.country
	const lang = langOf(choice)
	const countryChanged = country !== base.country
	const langChanged = choice !== null && choice !== savedChoice
	const dirty = countryChanged || langChanged
	const suggested =
		countryChanged && choice === null ? companionsOf(country, base.lang) : []
	const countryList = useOverlay(openList === "country", () =>
		setOpenList(null),
	)
	const langList = useOverlay(openList === "lang", () => setOpenList(null))
	const editButton = useRef<HTMLButtonElement>(null)
	const words = sourceWords(base, s.place)

	const show = (c: Country, l: LangChoice | null) => {
		const shownLang = langOf(l)
		s.setLook({
			country: c !== base.country ? c : undefined,
			lang: shownLang !== base.lang ? shownLang : undefined,
		})
	}
	const reset = () => {
		setChoice(null)
		setFailed(false)
		s.clearLook("reset: back to what is saved")
	}
	const leave = () => {
		if (s.saving) return
		reset()
		setEditing(false)
		setOpenList(null)
	}
	const done = async () => {
		if (!dirty) return leave()
		setFailed(false)
		const result = await s.save(
			{
				country: countryChanged ? country : undefined,
				lang: langChanged ? (choice ?? undefined) : undefined,
			},
			{
				toast: `Saved: ${[countryChanged && countryName(country), langChanged && langLabel(lang)].filter(Boolean).join(", ")}`,
			},
		)
		if (result === "failed") return setFailed(true)
		setChoice(null)
		setEditing(false)
	}
	// Escape leaves the mode when no list is open (a list takes its own Escape first).
	useEffect(() => {
		if (!editing) return
		const key = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !openList && !e.defaultPrevented) leave()
		}
		document.addEventListener("keydown", key)
		return () => document.removeEventListener("keydown", key)
	})
	// Into the mode: the focus goes to its first control. Out of it: back to Edit.
	const was = useRef(editing)
	useEffect(() => {
		if (editing && !was.current)
			countryList.button.current?.focus({ preventScroll: true })
		if (!editing && was.current)
			editButton.current?.focus({ preventScroll: true })
		was.current = editing
	}, [editing, countryList.button])

	// The titles list: browser default first, then a suggested language, then the rest.
	const langOptions: PickItem<LangChoice>[] = (() => {
		const items = langItems(s.browserLang)
		if (suggested.length === 0) return items
		const marked = items
			.filter((i) => suggested.includes(i.key as never))
			.map((i) => ({ ...i, hint: `Suggested for ${countryName(country)}` }))
		return [
			items[0],
			...marked,
			...items.slice(1).filter((i) => !suggested.includes(i.key as never)),
		]
	})()

	const control =
		"relative inline-flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg bg-white/[0.08] px-2 text-sm text-white ring-1 hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-amber-300 sm:h-9 sm:px-2.5"
	const status = s.saving
		? "Saving…"
		: failed
			? "Didn't save"
			: dirty
				? "Not saved"
				: ""

	// The line under the title, while editing: the two controls and the state in words, on every screen size.
	const controls = (
		<div
			data-edit-bar
			className="flex w-full min-w-0 items-center gap-1.5 sm:gap-2"
		>
			<button
				ref={countryList.button}
				type="button"
				data-g="country"
				aria-expanded={openList === "country"}
				aria-label={`Country ${countryName(country)}. Change`}
				onClick={() => setOpenList(openList === "country" ? null : "country")}
				className={`${control} w-[3.25rem] shrink-0 sm:w-[11rem] ${countryChanged ? "ring-amber-300/60" : "ring-white/15"}`}
			>
				<Flag code={country} className="h-3" />
				<span className="hidden min-w-0 truncate sm:inline">
					{countryName(country)}
				</span>
				<ChevronDownIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400" />
			</button>
			<button
				ref={langList.button}
				type="button"
				data-g="lang"
				aria-expanded={openList === "lang"}
				aria-label={`Titles in ${langLabel(lang)}${suggested.length ? `, ${langLabel(suggested[0])} suggested` : ""}. Change`}
				onClick={() => setOpenList(openList === "lang" ? null : "lang")}
				className={`${control} w-[4rem] shrink-0 sm:w-[10rem] ${langChanged ? "ring-amber-300/60" : "ring-white/15"}`}
			>
				<LanguageIcon className="hidden h-3.5 w-3.5 shrink-0 text-gray-400 sm:block" />
				<span className="sm:hidden">{LANG_CODE[lang]}</span>
				<span className="hidden min-w-0 truncate sm:inline">
					{langLabel(lang)}
				</span>
				<ChevronDownIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400" />
				{suggested.length > 0 && (
					<span
						aria-hidden="true"
						className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-sky-400 ring-2 ring-black"
					/>
				)}
			</button>
			{/* A fixed slot for the state in words: it never pushes the controls, and is read out when it changes. */}
			<span
				role={failed ? "alert" : "status"}
				data-g-status
				className={`w-[4.5rem] shrink-0 truncate text-[11px] sm:w-24 sm:text-xs ${failed ? "font-semibold text-red-300" : "text-amber-200/80"}`}
			>
				{status}
			</span>
			{openList === "country" && (
				<HeaderOverlay
					panelRef={countryList.ref}
					label="Country"
					className="!left-2 !right-auto w-[17rem] p-2 sm:!left-4"
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
					className="!left-2 !right-auto w-[17rem] p-2 sm:!left-4"
				>
					<PickList
						label="Titles in"
						items={langOptions}
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
		</div>
	)

	const iconButton =
		"inline-flex h-9 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-300 hover:bg-white/10 disabled:cursor-default disabled:opacity-30 sm:w-9"
	return (
		<TitlePage
			slots={{
				// One height for the line under the title, editing or not, so the bar never changes height.
				factsRowClass: "min-h-8 sm:min-h-9",
				factsReplacement: editing ? controls : undefined,
				hideShare: editing,
				headerControl: editing ? (
					<span className="flex items-center gap-1">
						<button
							type="button"
							data-reset
							disabled={!dirty || s.saving}
							onClick={reset}
							aria-label="Reset to what is saved"
							title="Reset"
							className={iconButton}
						>
							<ArrowUturnLeftIcon className="h-4 w-4" />
						</button>
						<Btn
							kind="primary"
							data-done
							busy={s.saving}
							onClick={done}
							className={failed ? "!bg-red-300" : ""}
						>
							{failed ? "Retry" : "Done"}
						</Btn>
						<button
							type="button"
							data-leave
							disabled={s.saving}
							onClick={leave}
							aria-label="Close without saving"
							className={iconButton}
						>
							<XMarkIcon className="h-5 w-5" />
						</button>
					</span>
				) : (
					<button
						ref={editButton}
						type="button"
						data-g-edit
						onClick={() => setEditing(true)}
						aria-label={pairLabel(
							s.effective.country,
							words.country,
							s.effective.lang,
							words.lang,
							"Edit",
						)}
						className="inline-flex h-9 w-[5.75rem] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white/[0.06] text-xs font-semibold text-gray-100 ring-1 ring-white/15 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:w-[11.5rem] sm:justify-start sm:px-3"
					>
						<Flag code={s.effective.country} className="h-3" />
						<span className="sm:hidden">{s.effective.country}</span>
						<span className="hidden min-w-0 flex-1 truncate sm:inline">
							{countryName(s.effective.country)} · {langLabel(s.effective.lang)}
						</span>
						<PencilIcon className="h-3 w-3 shrink-0 text-gray-400" />
					</button>
				),
				onOtherCountry: (c) => {
					setEditing(true)
					show(c, choice)
				},
			}}
		/>
	)
}
