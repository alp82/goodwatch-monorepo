// How New picks its country: the page's country as a button in the line under the heading. It opens the country menu
// (./CountryMenu.tsx, loaded on first use): a bottom sheet with search on phones, a two-column menu on desktop, with
// "Use my country" on top. A pick goes to /new/<country>, or to the same service there on a service page
// (NewPageData.countryChoices).
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { Suspense, lazy, useRef, useState } from "react"
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

/** The country button and the menu it opens. */
export function CountryChooser({
	choices,
	current,
}: {
	choices: CountryChoice[]
	/** The page's country. */
	current: { code: string; name: string }
}) {
	// The country the viewer watches from (account, cookie or request).
	const home = useLocale().locale.country.toUpperCase()
	const anchor = useRef<HTMLButtonElement>(null)
	const [open, setOpen] = useState(false)
	return (
		<>
			<button
				ref={anchor}
				type="button"
				aria-expanded={open}
				aria-haspopup="true"
				aria-label={`Country: ${current.name}. Choose another country`}
				data-country-chooser
				onPointerEnter={preload}
				onFocus={preload}
				onClick={() => setOpen((was) => !was)}
				className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full pr-2.5 pl-2 text-sm font-bold ring-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${open ? "bg-white text-black ring-white" : "bg-white/[0.07] text-white ring-white/20 hover:ring-white/40"}`}
			>
				<Flag country={current.code} />
				{current.name}
				<ChevronDownIcon
					aria-hidden
					className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{open && anchor.current && (
				<Suspense fallback={null}>
					<CountryMenu
						choices={choices}
						current={current.code}
						home={home}
						anchor={anchor.current}
						onClose={(refocus) => {
							setOpen(false)
							if (refocus) anchor.current?.focus()
						}}
					/>
				</Suspense>
			)}
		</>
	)
}
