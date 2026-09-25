// Dialogs the card opens: one rank (swap, move up, remove, or pick a title), and the title.
import { useEffect, useState } from "react"
import {
	Thumb,
	PromptLinks,
	TitleInput,
	sectionLabel,
} from "~/ui/share-list-editor/parts"
import type { Editor } from "~/ui/share-list-editor/useEditor"
import { useTitleSearch } from "~/ui/share-list-editor/useTitleSearch"

const PICKS = 24

function useEscape(onClose: () => void) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onClose])
}

function RankDialog({
	ed,
	index,
	onClose,
}: { ed: Editor; index: number; onClose: () => void }) {
	const [text, setText] = useState("")
	const { results, loading } = useTitleSearch(text)
	const { list } = ed
	const current = list.items[index]
	const shown = (results ?? ed.quickPicks).slice(0, PICKS)
	useEscape(onClose)
	return (
		<div
			className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={`Rank ${index + 1}`}
				className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-neutral-900 p-5 pb-10 text-white shadow-2xl ring-1 ring-white/10 sm:rounded-[28px]"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between gap-4">
					<div className="flex min-w-0 items-center gap-3">
						<span className="text-4xl font-black">#{index + 1}</span>
						{current && (
							<span className="truncate text-lg text-neutral-400">
								{current.title}
							</span>
						)}
					</div>
					<div className="flex shrink-0 gap-1 text-sm font-bold">
						{current && (
							<>
								<button
									type="button"
									disabled={index === 0}
									onClick={() => {
										list.place(current, index - 1)
										onClose()
									}}
									className="rounded-full bg-white/5 px-3 py-1.5 hover:bg-white/10 disabled:opacity-30"
								>
									Move up
								</button>
								<button
									type="button"
									onClick={() => {
										list.remove(current.key)
										onClose()
									}}
									className="rounded-full bg-white/5 px-3 py-1.5 hover:bg-red-600"
								>
									Remove
								</button>
							</>
						)}
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="rounded-full px-3 py-1.5 hover:bg-white/10"
						>
							✕
						</button>
					</div>
				</div>
				<input
					autoFocus
					type="search"
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={current ? "Swap for…" : "Search movies and shows"}
					aria-label="Search movies and shows"
					className="mt-4 w-full rounded-2xl border-0 bg-neutral-800 px-4 py-3 text-lg placeholder:text-neutral-500 focus:ring-2 focus:ring-white"
				/>
				<div className={`${sectionLabel} mt-3 mb-2`}>
					{loading ? "Searching…" : results ? "Results" : "Quick picks"}
				</div>
				<div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
					{shown.map((title) => {
						const rank = list.items.findIndex((i) => i.key === title.key)
						return (
							<button
								key={title.key}
								type="button"
								onClick={() => {
									if (rank < 0 && index >= list.items.length) list.add(title)
									else list.place(title, index)
									onClose()
								}}
								className="relative text-left"
								title={rank >= 0 ? `Swap with #${rank + 1}` : title.title}
							>
								<Thumb
									item={title}
									className={`w-full rounded-lg transition hover:scale-105 ${rank >= 0 ? "opacity-40" : ""}`}
								/>
								{rank >= 0 && (
									<span className="absolute top-1 left-1 rounded-full bg-black/80 px-2 text-xs font-bold">
										#{rank + 1}
									</span>
								)}
								<div className="mt-1 truncate text-xs text-neutral-400">
									{title.title}
								</div>
							</button>
						)
					})}
				</div>
			</div>
		</div>
	)
}

function TextDialog({
	ed,
	kind,
	onClose,
}: { ed: Editor; kind: "title"; onClose: () => void }) {
	useEscape(onClose)
	return (
		<div
			className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
			onClick={onClose}
		>
			<form
				role="dialog"
				aria-modal="true"
				aria-label="List title"
				onSubmit={(e) => {
					e.preventDefault()
					onClose()
				}}
				className="flex w-full max-w-xl flex-col gap-4 rounded-t-[28px] bg-neutral-900 p-5 pb-10 text-white shadow-2xl ring-1 ring-white/10 sm:rounded-[28px] sm:pb-5"
				onClick={(e) => e.stopPropagation()}
			>
				<div className={sectionLabel}>List title</div>
				<TitleInput
					ed={ed}
					autoFocus
					className="rounded-2xl bg-white/10 px-4 py-3 text-2xl"
				/>
				<PromptLinks ed={ed} />
				<button
					type="submit"
					className="rounded-full bg-white py-2.5 font-black text-black"
				>
					Done
				</button>
			</form>
		</div>
	)
}

export function EditorDialogs({ ed }: { ed: Editor }) {
	const { dialog } = ed
	if (!dialog) return null
	const close = () => ed.setDialog(null)
	if (dialog.kind === "rank")
		return <RankDialog ed={ed} index={dialog.index} onClose={close} />
	return <TextDialog ed={ed} kind={dialog.kind} onClose={close} />
}
