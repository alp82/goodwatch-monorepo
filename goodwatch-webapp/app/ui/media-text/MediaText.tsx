// One piece of media text in its own language: see media-text.ts. Any element, any classes; `truncate` and
// `line-clamp-*` work for every launch script.
import type { ComponentPropsWithoutRef, ElementType } from "react"
import { type MediaTextValue, mediaTextAttributes } from "./media-text"

export type { MediaTextValue }

export default function MediaText<T extends ElementType = "span">({
	value,
	as,
	...rest
}: { value: MediaTextValue; as?: T } & Omit<
	ComponentPropsWithoutRef<T>,
	"children" | "lang" | "dir"
>) {
	const Tag: ElementType = as ?? "span"
	return (
		<Tag {...rest} {...mediaTextAttributes(value.lang)}>
			{value.text}
		</Tag>
	)
}
