// The toolbar's design and color pickers. Both have fixed widths per breakpoint, so a longer name never shifts the
// layout, and both preview on hover: the card changes, the list doesn't, and a click commits.
import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "@heroicons/react/24/outline"
import { useState } from "react"
import { DESIGNS } from "~/ui/share-card/designs"
import { THEMES, type ThemeKey } from "~/ui/share-card/model"
import { ScaledCard } from "~/ui/share-card/ScaledCard"
import { Popover, sectionLabel } from "~/ui/share-list-editor/parts"
import type { Editor } from "~/ui/share-list-editor/useEditor"

const swatch = (key: ThemeKey) => ({
	backgroundImage: `linear-gradient(135deg, ${THEMES[key].accent}, ${THEMES[key].accent2})`,
})

export function DesignPicker({ ed }: { ed: Editor }) {
	const [open, setOpen] = useState(false)
	const close = () => {
		setOpen(false)
		ed.setPreviewDesign(null)
	}
	return (
		<div className="relative">
			<div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
				<button
					type="button"
					onClick={() => ed.stepDesign(-1)}
					aria-label="Previous design"
					className="rounded-full p-1.5 transition hover:bg-white/15"
				>
					<ChevronLeftIcon className="size-4" />
				</button>
				<button
					type="button"
					onClick={() => (open ? close() : setOpen(true))}
					aria-expanded={open}
					aria-haspopup="dialog"
					className={`flex w-32 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition sm:w-40 ${open ? "bg-white text-black" : "hover:bg-white/15"}`}
				>
					<span className="truncate">{ed.design.name}</span>
					<ChevronDownIcon
						className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
					/>
				</button>
				<button
					type="button"
					onClick={() => ed.stepDesign(1)}
					aria-label="Next design"
					className="rounded-full p-1.5 transition hover:bg-white/15"
				>
					<ChevronRightIcon className="size-4" />
				</button>
			</div>
			{/* On wide screens the panel opens along the left edge, so the card stays visible while hovering. */}
			<Popover
				open={open}
				onClose={close}
				className="fixed! top-[8.5rem] left-4 max-h-[calc(100dvh-10rem)] w-[min(340px,calc(100vw-2rem))] overflow-y-auto"
			>
				<div className={sectionLabel}>Designs</div>
				<div
					className="grid grid-cols-2 gap-2"
					onMouseLeave={() => ed.setPreviewDesign(null)}
				>
					{DESIGNS.map((d) => {
						const active = d.key === ed.design.key
						return (
							<button
								key={d.key}
								type="button"
								onMouseEnter={() => ed.setPreviewDesign(d.key)}
								onFocus={() => ed.setPreviewDesign(d.key)}
								onClick={() => {
									ed.list.set({ design: d.key })
									close()
								}}
								aria-pressed={active}
								className={`group flex flex-col items-center gap-1.5 rounded-2xl p-2 transition ${active ? "bg-white/15 ring-2" : "hover:-translate-y-0.5 hover:bg-white/10"}`}
								style={{ ["--tw-ring-color" as string]: ed.colors.accent }}
							>
								<div className="pointer-events-none flex h-40 w-full items-center">
									<ScaledCard
										design={d}
										card={{ ...ed.card, theme: ed.list.theme }}
										maxHeight={152}
										className="rounded-md shadow-lg shadow-black/50"
									/>
								</div>
								<span
									className={`text-xs font-bold ${active ? "text-white" : "text-neutral-400 group-hover:text-white"}`}
								>
									{d.name}
								</span>
								<span className="-mt-1 text-[10px] text-neutral-500">
									{d.format}
								</span>
							</button>
						)
					})}
				</div>
			</Popover>
		</div>
	)
}

export function ThemePicker({ ed }: { ed: Editor }) {
	const [open, setOpen] = useState(false)
	const close = () => {
		setOpen(false)
		ed.setPreviewTheme(null)
	}
	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => (open ? close() : setOpen(true))}
				aria-expanded={open}
				aria-haspopup="listbox"
				className={`flex w-32 items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-sm font-bold transition sm:w-36 ${open ? "bg-white text-black" : "bg-white/10 hover:bg-white/15"}`}
			>
				<span
					className="size-6 shrink-0 rounded-full"
					style={swatch(ed.list.theme)}
				/>
				<span className="flex-1 truncate text-left">{ed.colors.label}</span>
				<ChevronDownIcon
					className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			<Popover
				open={open}
				onClose={close}
				className="top-12 left-1/2 w-52 -translate-x-1/2 gap-0.5! p-2!"
			>
				<div
					role="listbox"
					aria-label="Colors"
					className="flex flex-col gap-0.5"
					onMouseLeave={() => ed.setPreviewTheme(null)}
				>
					{(Object.keys(THEMES) as ThemeKey[]).map((key) => (
						<button
							key={key}
							type="button"
							role="option"
							aria-selected={ed.list.theme === key}
							onMouseEnter={() => ed.setPreviewTheme(key)}
							onFocus={() => ed.setPreviewTheme(key)}
							onClick={() => {
								ed.list.set({ theme: key })
								close()
							}}
							className={`flex items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm font-semibold transition hover:bg-white/10 ${ed.list.theme === key ? "bg-white/10" : ""}`}
						>
							<span className="size-6 rounded-full" style={swatch(key)} />
							<span className="flex-1">{THEMES[key].label}</span>
							{ed.list.theme === key && (
								<span className="text-xs text-neutral-400">✓</span>
							)}
						</button>
					))}
				</div>
			</Popover>
		</div>
	)
}
