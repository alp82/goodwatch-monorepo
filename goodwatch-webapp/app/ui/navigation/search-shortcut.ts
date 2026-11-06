type ShortcutEvent = Pick<
	KeyboardEvent,
	"key" | "metaKey" | "ctrlKey" | "target"
>

/**
 * Whether a keydown opens the search dialog: ⌘K / Ctrl K anywhere, "/" outside text fields. Chrome's autofill sends
 * keydown events without a key when a saved email or password is picked, so a missing key is never a shortcut.
 */
export function isSearchShortcut(event: ShortcutEvent) {
	if (typeof event.key !== "string") return false
	if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey))
		return true
	const typing = (event.target as HTMLElement | null)?.closest?.(
		"input, textarea, select, [contenteditable]",
	)
	return event.key === "/" && !typing && !event.metaKey
}
