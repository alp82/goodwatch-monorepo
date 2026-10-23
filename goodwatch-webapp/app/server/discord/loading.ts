// The instant answer to a press that updates its own message: the same card with every control disabled and a short
// loading line, built only from the message the interaction carries, so it needs no read before Discord's 3-second ack.
import {
	type Component,
	componentCount,
	IS_COMPONENTS_V2,
	discordText,
} from "./cards.ts"

const disable = (c: Component): Component => ({
	...c,
	...(c.type === 2 || c.type === 3 ? { disabled: true } : {}),
	...(c.components ? { components: c.components.map(disable) } : {}),
	...(c.accessory ? { accessory: disable(c.accessory) } : {}),
})

const find = (
	components: Component[],
	match: (c: Component) => boolean,
): Component | undefined => {
	for (const c of components) {
		if (match(c)) return c
		const inner =
			find(c.components ?? [], match) ??
			(c.accessory ? find([c.accessory], match) : undefined)
		if (inner) return inner
	}
	return undefined
}

/**
 * What the press loads, in words: the chosen option's label for a menu, the next or previous page, or the pressed
 * button's own label. `fallback` names it when the message doesn't say.
 */
export function pressedName(
	components: Component[],
	customId: string,
	values: string[] = [],
	fallback = "",
) {
	const pressed = find(components, (c) => c.custom_id === customId)
	if (pressed?.type === 3) {
		const option = (pressed.options as { label?: string; value?: string }[])
			?.find((o) => o.value === values[0])
			?.label?.replace(/^\d+\.\s+/, "")
		if (option) return option
	}
	const label = typeof pressed?.label === "string" ? pressed.label : ""
	if (label === "Next") return "the next page"
	if (label === "Previous") return "the previous page"
	return fallback || label
}

/**
 * The message as a type 7 answer: every button and menu disabled, and "-# Loading Similar…" (or `line`) at the bottom.
 * Null when the interaction carries no components to show.
 */
export function loadingMessage(
	components: Component[] | undefined,
	line: string,
) {
	if (!components?.length) return null
	const disabled = components.map(disable)
	const loading: Component = {
		type: 10,
		content: `-# ${discordText(line)}`.slice(0, 200),
	}
	// A full card has no room for one more component, so the line joins its last text instead.
	if (componentCount(disabled) < 40) disabled.push(loading)
	else {
		const texts: Component[] = []
		const collect = (list: Component[]) =>
			list.forEach((c) => {
				if (c.type === 10) texts.push(c)
				collect(c.components ?? [])
			})
		collect(disabled)
		const last = texts.at(-1)
		if (last) last.content = `${String(last.content ?? "")}\n${loading.content}`
	}
	return {
		flags: IS_COMPONENTS_V2,
		components: disabled,
		allowed_mentions: { parse: [] },
	}
}

/** "Loading Similar…", "Loading the next page…", or "Loading…" when nothing names it. */
export const loadingLine = (name: string) =>
	name ? `Loading ${name}…` : "Loading…"
