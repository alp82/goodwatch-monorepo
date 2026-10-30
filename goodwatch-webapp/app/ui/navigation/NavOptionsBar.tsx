// PROTOTYPE OPTIONS - remove with nav-options.ts after the owner picks (member nav, round 8). The floating bar that
// switches the round's options: development builds only (SiteChrome mounts it behind import.meta.env.DEV). Bottom
// center, above the phone dock; it folds into a small pill, and starts folded on phones so it never covers the dock.
import {
	AdjustmentsHorizontalIcon,
	ChevronDownIcon,
} from "@heroicons/react/20/solid"
import { useEffect, useState } from "react"
import {
	NAV_OPTIONS,
	type NavOptionKey,
	type NavOptions,
	setNavOption,
	useNavOptions,
} from "./nav-options"

const ROWS: { key: NavOptionKey; label: string }[] = [
	{ key: "twins", label: "Compare" },
]

const FOLDED_KEY = "gw-nav-options-folded"

function readFolded(): boolean {
	try {
		const saved = window.localStorage.getItem(FOLDED_KEY)
		if (saved != null) return saved === "1"
	} catch {}
	return !window.matchMedia("(min-width: 1024px)").matches
}

function saveFolded(folded: boolean) {
	try {
		window.localStorage.setItem(FOLDED_KEY, folded ? "1" : "0")
	} catch {}
}

function Row({
	options,
	option,
	label,
}: { options: NavOptions; option: NavOptionKey; label: string }) {
	const values = NAV_OPTIONS[option] as readonly string[]
	return (
		<div className="flex items-center gap-2">
			<span className="w-14 shrink-0 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
				{label}
			</span>
			<div
				role="group"
				aria-label={label}
				className="flex rounded-full bg-white/[0.06] p-0.5 ring-1 ring-white/10"
			>
				{values.map((value) => {
					const on = options[option] === value
					return (
						<button
							key={value}
							type="button"
							aria-pressed={on}
							onClick={() =>
								!on &&
								setNavOption(
									options,
									option,
									value as NavOptions[typeof option],
								)
							}
							className={`h-7 cursor-pointer rounded-full px-2.5 text-[12px] whitespace-nowrap transition-colors ${
								on
									? "bg-white font-bold text-gray-950"
									: "text-gray-300 hover:text-white"
							}`}
						>
							{value}
						</button>
					)
				})}
			</div>
		</div>
	)
}

/** The options bar. Renders nothing on the server, so the page's own markup never depends on it. */
export function NavOptionsBar() {
	const options = useNavOptions()
	const [folded, setFolded] = useState<boolean | null>(null)
	useEffect(() => setFolded(readFolded()), [])
	if (folded === null) return null
	const fold = (next: boolean) => {
		setFolded(next)
		saveFolded(next)
	}
	return (
		<div
			data-nav-options
			className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 bottom-[calc(var(--nav-dock-height,76px)+10px)] lg:bottom-4"
		>
			{folded ? (
				<button
					type="button"
					onClick={() => fold(false)}
					aria-expanded={false}
					className="pointer-events-auto flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-gray-950 px-3 text-[12px] font-semibold text-gray-200 shadow-xl shadow-black/60 ring-1 ring-white/15 hover:text-white"
				>
					<AdjustmentsHorizontalIcon className="size-4 text-amber-300" />
					Options
					<span className="text-gray-500">
						{ROWS.map((r) => options[r.key]).join(" · ")}
					</span>
				</button>
			) : (
				<section
					aria-label="Navigation options"
					className="pointer-events-auto flex max-w-full flex-col gap-1.5 rounded-2xl bg-gray-950 p-2.5 pt-2 shadow-2xl shadow-black/70 ring-1 ring-white/15"
				>
					<div className="flex items-center justify-between gap-3">
						<span className="flex items-center gap-1.5 text-[12px] font-bold text-gray-200">
							<AdjustmentsHorizontalIcon className="size-4 text-amber-300" />
							Options
						</span>
						<button
							type="button"
							onClick={() => fold(true)}
							aria-expanded
							aria-label="Fold the options"
							className="flex size-7 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
						>
							<ChevronDownIcon className="size-4" />
						</button>
					</div>
					{ROWS.map((r) => (
						<Row key={r.key} options={options} option={r.key} label={r.label} />
					))}
				</section>
			)}
		</div>
	)
}
