// The live card on the front of the editor. Clicking a poster opens its rank dialog, clicking the title opens the
// title dialog, dragging a poster onto another swaps them, and titles can be dropped onto posters.
import type { MouseEvent, PointerEvent } from "react"
import { ScaledCard } from "~/ui/share-card/ScaledCard"
import type { Editor } from "~/ui/share-list-editor/useEditor"

/** Hover and drop-target highlights for the card's ranks and title. */
export function CardPreviewStyles({ ed }: { ed: Editor }) {
	const over =
		ed.dnd.drag?.over?.kind === "slot" ? ed.dnd.drag.over.index : null
	const accent = ed.shown.colors.accent
	const css = `
		[data-card-preview] [data-slot], [data-card-preview] [data-edit] { cursor: pointer; transition: filter .15s; }
		[data-card-preview] [data-slot]:hover, [data-card-preview] [data-edit]:hover { filter: brightness(1.12) drop-shadow(0 0 18px ${accent}); }
		${over != null ? `[data-card-preview] [data-slot="${over}"] { filter: brightness(1.2) drop-shadow(0 0 30px ${accent}) drop-shadow(0 0 8px ${accent}); }` : ""}
	`
	return <style dangerouslySetInnerHTML={{ __html: css }} />
}

export function CardPreview({ ed }: { ed: Editor }) {
	const onClick = (e: MouseEvent) => {
		const el = e.target as HTMLElement
		const slot = el.closest<HTMLElement>("[data-slot]")
		if (slot)
			return ed.setDialog({
				kind: "rank",
				index: Math.min(Number(slot.dataset.slot), ed.list.items.length),
			})
		const edit = el.closest<HTMLElement>("[data-edit]")?.dataset.edit
		if (edit === "title") ed.setDialog({ kind: "title" })
	}
	const onPointerDown = (e: PointerEvent) => {
		const index = Number(
			(e.target as HTMLElement).closest<HTMLElement>("[data-slot]")?.dataset
				.slot,
		)
		const item = ed.list.items[index]
		if (item) ed.dnd.start(e, { item, from: index })
	}
	return (
		<div
			data-card-preview
			onClick={onClick}
			onPointerDown={onPointerDown}
			onDragStart={(e) => e.preventDefault()}
			className="h-full w-full min-w-0 touch-pan-y select-none"
		>
			<ScaledCard
				design={ed.shown.design}
				card={ed.card}
				fill
				editing
				className="rounded-[18px] shadow-2xl shadow-black/60"
			/>
		</div>
	)
}
