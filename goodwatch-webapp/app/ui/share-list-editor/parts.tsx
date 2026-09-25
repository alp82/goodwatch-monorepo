// Small shared pieces of the share list editor.
import type { ReactNode } from "react"
import { LIST_PROMPTS, type CardTitle } from "~/ui/share-card/model"
import type { Editor } from "~/ui/share-list-editor/useEditor"

export const sectionLabel =
	"text-xs font-bold tracking-[0.2em] text-neutral-500 uppercase"

export const titleMeta = (t: CardTitle) =>
	[t.year, t.type === "movie" ? "Movie" : "Series"].filter(Boolean).join(" · ")

export const Thumb = ({
	item,
	className = "",
}: { item: CardTitle; className?: string }) =>
	item.poster ? (
		<img
			src={item.poster.replace("/w500/", "/w185/")}
			alt=""
			draggable={false}
			className={`aspect-[2/3] object-cover ${className}`}
		/>
	) : (
		<div
			className={`flex aspect-[2/3] items-center justify-center bg-neutral-800 p-1 text-center text-[10px] leading-tight text-neutral-400 ${className}`}
		>
			{item.title}
		</div>
	)

/** A panel anchored to its trigger. Clicking outside closes it. */
export function Popover({
	open,
	onClose,
	children,
	className = "",
}: {
	open: boolean
	onClose: () => void
	children: ReactNode
	className?: string
}) {
	if (!open) return null
	return (
		<>
			<div className="fixed inset-0 z-20" onClick={onClose} />
			<div
				className={`absolute z-30 flex flex-col gap-4 rounded-3xl bg-neutral-900/95 p-4 shadow-2xl ring-1 ring-white/10 backdrop-blur ${className}`}
			>
				{children}
			</div>
		</>
	)
}

export function TitleInput({
	ed,
	className = "",
	autoFocus,
}: { ed: Editor; className?: string; autoFocus?: boolean }) {
	return (
		<input
			autoFocus={autoFocus}
			value={ed.list.title}
			onChange={(e) => ed.list.setTitle(e.target.value)}
			placeholder="Name your list"
			aria-label="List title"
			className={`w-full border-0 font-black tracking-tight placeholder:text-neutral-600 focus:ring-2 focus:ring-white ${className}`}
		/>
	)
}

export function SignatureInput({
	ed,
	autoFocus,
}: { ed: Editor; autoFocus?: boolean }) {
	return (
		<input
			autoFocus={autoFocus}
			value={ed.list.signature}
			onChange={(e) => ed.list.setSignature(e.target.value)}
			placeholder="your name or @handle"
			aria-label="Signature"
			className="w-full rounded-full border-0 bg-white/10 px-4 py-2.5 text-sm placeholder:text-neutral-500 focus:ring-2 focus:ring-white"
		/>
	)
}

/** List prompts as small inline links that wrap. Picking one sets the title and the quick picks. */
export function PromptLinks({ ed }: { ed: Editor }) {
	return (
		<div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] leading-snug">
			<span className="text-neutral-500">Try:</span>
			{LIST_PROMPTS.map((p) => {
				const active = ed.list.title === p.title
				return (
					<button
						key={p.id}
						type="button"
						onClick={() => ed.list.set({ title: p.title, promptId: p.id })}
						className={`underline decoration-1 underline-offset-4 transition ${active ? "text-white decoration-white" : "text-neutral-400 decoration-white/20 hover:text-white hover:decoration-white"}`}
					>
						{p.title}
					</button>
				)
			})}
		</div>
	)
}

/** The poster that follows the pointer while dragging. */
export function DragGhost({ ed }: { ed: Editor }) {
	const drag = ed.dnd.drag
	if (!drag) return null
	return (
		<div
			className="pointer-events-none fixed z-[60] w-16 -translate-x-1/2 -translate-y-1/2 rotate-6"
			style={{ left: drag.x, top: drag.y }}
		>
			<Thumb
				item={drag.payload.item}
				className="w-16 rounded-lg shadow-2xl ring-2 ring-white"
			/>
			{drag.over?.kind === "slot" && (
				<span
					className="absolute -top-3 -right-3 rounded-full px-2 py-0.5 text-sm font-black text-black"
					style={{ backgroundColor: ed.colors.accent }}
				>
					#{drag.over.index + 1}
				</span>
			)}
		</div>
	)
}
