// The titles languages to pick from: "Browser default" first, then the offered languages, each with its own name.
// The header pair's dialog and the settings page show it. Up and down move through it, as in a list box.
import { CheckIcon } from "@heroicons/react/24/solid"
import type { KeyboardEvent } from "react"
import { MEDIA_LANGUAGES } from "~/utils/media-language"
import { englishName, ownName } from "./languages"
import { BROWSER } from "./machine"

export function TitlesList({
	value,
	browserLanguage,
	onPick,
	className = "h-full",
}: {
	/** The choice shown as current: a language, or "browser". */
	value: string
	/** The language "Browser default" follows now. */
	browserLanguage: string
	onPick: (choice: string) => void
	className?: string
}) {
	const options = [BROWSER, ...MEDIA_LANGUAGES]
	const move = (e: KeyboardEvent<HTMLUListElement>) => {
		if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
		const buttons = [
			...e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
		]
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
		const next =
			buttons[
				Math.min(
					buttons.length - 1,
					Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)),
				)
			]
		if (next) {
			e.preventDefault()
			next.focus()
		}
	}
	return (
		<ul
			aria-label="Titles in"
			onKeyDown={move}
			className={`overflow-y-auto overscroll-contain pr-1 ${className}`}
		>
			{options.map((l) => {
				const selected = l === value
				return (
					<li key={l}>
						<button
							type="button"
							data-language={l}
							aria-current={selected || undefined}
							onClick={() => onPick(l)}
							className={`flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-white hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-white disabled:cursor-wait ${selected ? "bg-white/[0.1] ring-1 ring-white/20" : ""}`}
						>
							{l === BROWSER ? (
								<span className="min-w-0 flex-1">
									<span className="block">Browser default</span>
									<span className="block text-xs text-gray-400">
										Follows your browser: {englishName(browserLanguage)} right
										now
									</span>
								</span>
							) : (
								<span className="min-w-0 flex-1 truncate">
									{englishName(l)}{" "}
									<span lang={l} className="text-gray-500">
										{ownName(l)}
									</span>
								</span>
							)}
							{selected && (
								<CheckIcon
									className="h-4 w-4 shrink-0 text-gray-300"
									aria-label="Current"
								/>
							)}
						</button>
					</li>
				)
			})}
		</ul>
	)
}
