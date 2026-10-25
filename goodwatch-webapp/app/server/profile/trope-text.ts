import entities from "./html-entities.json" with { type: "json" }

/** Plain text only, including text inside spoiler spans. Never render this as HTML. */
export function htmlToText(html: string): string {
	const text = html
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
		.replace(/<[^>]*>/g, " ")
	return text
		.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (raw, entity: string) => {
			if (entity.startsWith("#")) {
				const hex = entity[1]?.toLowerCase() === "x"
				const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
				return code > 0 &&
					code <= 0x10ffff &&
					!(code >= 0xd800 && code <= 0xdfff)
					? String.fromCodePoint(code)
					: "�"
			}
			return Object.prototype.hasOwnProperty.call(entities, entity)
				? entities[entity as keyof typeof entities]
				: raw
		})
		.replace(/\s+/g, " ")
		.trim()
}
