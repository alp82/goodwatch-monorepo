// PROTOTYPE OPTIONS (member nav round 11, country): how New picks its country, in place of the breadcrumb bar.
// - title: the heading itself is the control, "New on streaming in [Germany ▾]".
// - flag: a compact flag + code button at the heading row's right end.
// - chips: your own country first, then nearby and popular countries as chips, and "More".
// - sheet: a country button under the heading; on phones a bottom sheet with search, on desktop a two-column menu,
//   with "Use my country" on top.
// Every option opens the same searchable navigation menu (./CountryMenu.tsx, loaded on first use). A pick goes to
// /new/<country>, or to the same service there on a service page (NewPageData.countryChoices).
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { Suspense, lazy, useRef, useState } from "react"
import { withArticle } from "~/utils/country-article"
import useLocale from "~/utils/locale"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { CountryChoice } from "./CountryMenu"
import { Flag } from "./parts"

export type { CountryChoice }

const loadMenu = reloadOnStaleChunk(() => import("./CountryMenu"))
const CountryMenu = lazy(loadMenu)
const preload = () => {
	void loadMenu()
}

/** The country the viewer watches from (account, cookie or request), upper case. */
export function useHomeCountry(): string {
	return useLocale().locale.country.toUpperCase()
}

/** A trigger and the menu it opens. `look` picks the menu's shape. */
function useMenu(look: "list" | "sheet") {
	const anchor = useRef<HTMLButtonElement>(null)
	const [open, setOpen] = useState(false)
	const triggerProps = {
		ref: anchor,
		type: "button" as const,
		"aria-expanded": open,
		"aria-haspopup": "true" as const,
		"data-country-chooser": look,
		onPointerEnter: preload,
		onFocus: preload,
		onClick: () => setOpen((was) => !was),
	}
	const menu = (props: {
		choices: CountryChoice[]
		current: string
		home: string
	}) =>
		open && anchor.current ? (
			<Suspense fallback={null}>
				<CountryMenu
					{...props}
					look={look}
					anchor={anchor.current}
					onClose={(refocus) => {
						setOpen(false)
						if (refocus) anchor.current?.focus()
					}}
				/>
			</Suspense>
		) : null
	return { triggerProps, menu, open }
}

interface ChooserProps {
	choices: CountryChoice[]
	/** The page's country code. */
	current: { code: string; name: string }
}

/** OPTION country=title: the country in the heading, "in [Germany ▾]", as the control. */
export function TitleCountry({ choices, current }: ChooserProps) {
	const home = useHomeCountry()
	const { triggerProps, menu, open } = useMenu("list")
	return (
		<>
			{"in "}
			<button
				{...triggerProps}
				aria-label={`${current.name}, choose another country`}
				className={`group inline-flex cursor-pointer items-baseline gap-[0.12em] rounded-[0.2em] text-left underline decoration-white/25 decoration-[0.06em] underline-offset-[0.14em] outline-none transition-colors hover:decoration-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400 ${open ? "decoration-amber-400" : ""}`}
			>
				{withArticle(current.name)}
				<ChevronDownIcon
					aria-hidden
					className={`size-[0.55em] shrink-0 self-center text-amber-400 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{menu({ choices, current: current.code, home })}
		</>
	)
}

/** OPTION country=flag: a compact flag + code button for the heading row's right end. */
export function FlagCountry({ choices, current }: ChooserProps) {
	const home = useHomeCountry()
	const { triggerProps, menu, open } = useMenu("list")
	return (
		<>
			<button
				{...triggerProps}
				aria-label={`Country: ${current.name}. Choose another country`}
				className={`flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl pr-2 pl-2.5 text-sm font-black tracking-wide ring-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${open ? "bg-white text-black ring-white" : "bg-gray-950/60 text-gray-100 ring-white/15 hover:ring-white/40"}`}
			>
				<Flag country={current.code} />
				{current.code}
				<ChevronDownIcon
					aria-hidden
					className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{menu({ choices, current: current.code, home })}
		</>
	)
}

/** Nearby countries for the chips, by the viewer's own country. Others get the popular ones. */
const NEARBY: Record<string, string[]> = {
	AT: ["DE", "CH", "IT", "CZ"],
	AU: ["NZ", "GB", "US"],
	BE: ["NL", "FR", "DE", "LU"],
	BR: ["PT", "AR", "MX"],
	CA: ["US", "GB", "FR"],
	CH: ["DE", "AT", "FR", "IT"],
	DE: ["AT", "CH", "NL", "FR", "PL"],
	DK: ["SE", "NO", "DE"],
	ES: ["PT", "FR", "IT", "MX"],
	FR: ["BE", "CH", "ES", "DE", "IT"],
	GB: ["IE", "US", "FR", "DE"],
	IE: ["GB", "US", "FR"],
	IN: ["GB", "US", "AE"],
	IT: ["CH", "FR", "ES", "AT"],
	JP: ["KR", "US", "TW"],
	MX: ["US", "ES", "AR"],
	NL: ["BE", "DE", "GB"],
	NO: ["SE", "DK", "FI"],
	PL: ["DE", "CZ", "GB"],
	PT: ["ES", "BR", "FR"],
	SE: ["NO", "DK", "FI"],
	US: ["CA", "GB", "MX"],
}
/** The countries most members watch from, as Settings' country grid suggests them. */
const POPULAR = ["US", "GB", "DE", "FR", "ES", "IT", "CA", "AU", "BR", "JP"]
const CHIPS = 6

/** The chips: your country, the page's, nearby ones, then popular ones, each only once and only with a page. */
export function chipCountries(
	choices: readonly CountryChoice[],
	current: string,
	home: string,
): CountryChoice[] {
	const byCode = new Map(choices.map((c) => [c.code, c]))
	const order = [home, current, ...(NEARBY[home] ?? []), ...POPULAR]
	const out: CountryChoice[] = []
	for (const code of order) {
		const choice = byCode.get(code)
		if (choice && !out.includes(choice)) out.push(choice)
		if (out.length >= CHIPS) break
	}
	return out
}

const CHIP =
	"flex h-9 shrink-0 items-center gap-2 rounded-full pr-3.5 pl-2 text-sm font-bold ring-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400"
const CHIP_ON = "bg-white text-black ring-white"
const CHIP_OFF =
	"bg-gray-950/60 text-gray-200 ring-white/15 hover:ring-white/40"

/** OPTION country=chips: a row of country chips over the heading, with More for the rest. */
export function ChipCountries({ choices, current }: ChooserProps) {
	const home = useHomeCountry()
	const { triggerProps, menu, open } = useMenu("list")
	const chips = chipCountries(choices, current.code, home)
	const more = choices.length > chips.length
	return (
		<nav
			aria-label="Countries"
			className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
		>
			{chips.map((choice) => {
				const on = choice.code === current.code
				return (
					<Link
						key={choice.code}
						to={choice.path}
						prefetch="intent"
						aria-current={on ? "page" : undefined}
						className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
					>
						<Flag country={choice.code} />
						{choice.name}
						{choice.code === home && (
							<span
								className={`text-[11px] font-semibold ${on ? "text-black/55" : "text-gray-500"}`}
							>
								Yours
							</span>
						)}
					</Link>
				)
			})}
			{more && (
				<button
					{...triggerProps}
					className={`${CHIP} cursor-pointer pl-3.5 ${open ? CHIP_ON : CHIP_OFF}`}
				>
					More
					<ChevronDownIcon
						aria-hidden
						className={`-mr-1 size-4 transition-transform ${open ? "rotate-180" : ""}`}
					/>
				</button>
			)}
			{menu({ choices, current: current.code, home })}
		</nav>
	)
}

/** OPTION country=sheet: the page's country as a button under the heading, opening the sheet or two-column menu. */
export function SheetCountry({ choices, current }: ChooserProps) {
	const home = useHomeCountry()
	const { triggerProps, menu, open } = useMenu("sheet")
	return (
		<>
			<button
				{...triggerProps}
				aria-label={`Country: ${current.name}. Choose another country`}
				className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full pr-2.5 pl-2 text-sm font-bold ring-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${open ? "bg-white text-black ring-white" : "bg-white/[0.07] text-white ring-white/20 hover:ring-white/40"}`}
			>
				<Flag country={current.code} />
				{current.name}
				<ChevronDownIcon
					aria-hidden
					className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{menu({ choices, current: current.code, home })}
		</>
	)
}
