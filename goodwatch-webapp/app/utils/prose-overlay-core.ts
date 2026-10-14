import { presentationLanguage } from "./media-presentation.ts"
import { parseTitleKey } from "./title-key.ts"

export interface ProseField {
	language: string
	source: "localized" | "canonical" | "template"
	fallback: boolean
	sourceId: string
	sourceRevision: string
}
export interface ProseTranslation {
	kind?: "template"
	source_id: string
	source_revision: string
	language: string
	text: string
	status: string
	validation_revision: string
}
export type ProsePresentation = Record<string, ProseField | ProseField[]>
export interface ProseSource {
	sourceId: string
	sourceRevision: string
	text: string
}
export const PROSE_BATCH_SIZE = 200
export const PROSE_VALIDATION_REVISION = "prose-v1"
export function proseBatchKey(
	sources: readonly ProseSource[],
	language: string,
) {
	return {
		language: presentationLanguage(language),
		sources: sources.map((s) => `${s.sourceId}:${s.sourceRevision}`).sort(),
	}
}

/** Only display fields with an explicit source identity. Matching inputs and numeric fingerprints stay canonical. */
export async function overlayProsePayload<T>(
	payload: T,
	selected: string,
	hash: (text: string) => string,
	read: (
		sources: readonly ProseSource[],
		language: string,
	) => Promise<ProseTranslation[]>,
): Promise<T> {
	const language = presentationLanguage(selected)
	type ObjectValue = Record<string, unknown>
	const fields: {
		object: ObjectValue
		key: string
		values: ProseSource[]
		array: boolean
	}[] = []
	const visit = (
		value: unknown,
		inherited?: string,
		portrait = false,
		content?: "faq" | "category",
	) => {
		if (Array.isArray(value)) {
			value.forEach((child) => visit(child, inherited, portrait, content))
			return
		}
		if (!value || typeof value !== "object" || value instanceof Date) return
		const object = value as ObjectValue
		const kindValue = object.media_type ?? object.mediaType ?? object.type
		const kind =
			kindValue === "movie"
				? "movie"
				: kindValue === "show" || kindValue === "tv"
				? "show"
				: undefined
		const id = Number(
			object.tmdb_id ??
				object.tmdbId ??
				(object.details as ObjectValue | undefined)?.tmdb_id ??
				(kind ? object.id : undefined),
		)
		const numeric =
			typeof object.key === "number" && object.key >= 1e12 && object.key < 3e12
				? parseTitleKey(object.key)
				: undefined
		const stringKey =
			typeof object.key === "string" && /^(movie|show)[:-]\d+$/.test(object.key)
				? object.key.replace("-", ":")
				: undefined
		const identity =
			kind && Number.isSafeInteger(id) && id > 0
				? `${kind}:${id}`
				: numeric
				? `${numeric.mediaType}:${numeric.tmdbId}`
				: stringKey ?? inherited
		if (identity) {
			for (const key of [
				"essenceText",
				"essence_text",
				"essenceTags",
				"essence_tags",
			]) {
				const canonical =
					(object.canonicalProse as ObjectValue | undefined)?.[key] ??
					object[key]
				const array = Array.isArray(canonical)
				const strings = array
					? canonical
					: typeof canonical === "string"
					? [canonical]
					: []
				if (
					!strings.length ||
					!strings.every((text) => typeof text === "string")
				)
					continue
				const values = (strings as string[]).map((text) => ({
					text,
					sourceRevision: hash(text),
					sourceId: `${identity}:${
						array ? `essence_tag:${hash(text)}` : "essence_text"
					}`,
				}))
				fields.push({ object, key, values, array })
			}
		}
		// Portrait narratives are deterministic templates, content-addressed for reuse
		// without storing account IDs. Translation rows must match the rendered source.
		const inPortrait =
			portrait ||
			(["fingerprint", "sides", "everyone"].includes(String(object.tab)) &&
				"subject" in object)
		if (inPortrait) {
			for (const key of [
				"line",
				"name",
				"headline",
				"lead",
				"place",
				"sentence",
				"description",
			]) {
				const text =
					(object.canonicalProse as ObjectValue | undefined)?.[key] ??
					object[key]
				if (typeof text === "string" && text.trim()) {
					const sourceRevision = hash(text)
					fields.push({
						object,
						key,
						values: [
							{ text, sourceRevision, sourceId: `template:${sourceRevision}` },
						],
						array: false,
					})
				}
			}
		}
		// Handwritten category copy/FAQ blocks are also fixed templates. Controls remain English.
		if (content) {
			for (const key of content === "faq"
				? ["q", "a"]
				: ["subtitle", "description"]) {
				const text =
					(object.canonicalProse as ObjectValue | undefined)?.[key] ??
					object[key]
				if (typeof text === "string" && text.trim()) {
					const sourceRevision = hash(text)
					fields.push({
						object,
						key,
						values: [
							{ text, sourceRevision, sourceId: `template:${sourceRevision}` },
						],
						array: false,
					})
				}
			}
		}
		// Registered externally generated display blocks can share this same read boundary.
		const registeredText = (object.canonicalProse as ObjectValue | undefined)?.text ?? object.text
		if (
			typeof object.sourceId === "string" &&
			typeof registeredText === "string" &&
			object.sourceRevision === hash(registeredText)
		) {
			fields.push({
				object,
				key: "text",
				values: [
					{
						sourceId: object.sourceId,
						sourceRevision: object.sourceRevision as string,
						text: registeredText,
					},
				],
				array: false,
			})
		}
		for (const [key, child] of Object.entries(object)) {
			if (
				!["canonicalProse", "prosePresentation", "presentation"].includes(key)
			)
				visit(
					child,
					identity,
					inPortrait &&
						!["titles", "services", "subject", "attributes"].includes(key),
					key === "faq" ? "faq" : key === "pageData" ? "category" : undefined,
				)
		}
	}
	visit(payload)
	if (!fields.length) return payload
	const sources = [
		...new Map(
			fields
				.flatMap((field) => field.values)
				.map((s) => [`${s.sourceId}:${s.sourceRevision}`, s]),
		).values(),
	]
	const translations = new Map<string, ProseTranslation>()
	if (language !== "en") {
		for (let offset = 0; offset < sources.length; offset += PROSE_BATCH_SIZE) {
			try {
				for (const row of await read(
					sources.slice(offset, offset + PROSE_BATCH_SIZE),
					language,
				)) {
					if (
						row.language === language &&
						row.status === "valid" &&
						row.validation_revision === PROSE_VALIDATION_REVISION &&
						row.text?.trim()
					)
						translations.set(`${row.source_id}:${row.source_revision}`, row)
				}
			} catch {
				/* Missing schema/source never makes an entity unavailable. */
			}
		}
	}
	const copies = new Map<object, ObjectValue>()
	for (const field of fields) {
		const copy = copies.get(field.object) ?? {
			...field.object,
			canonicalProse: {
				...(field.object.canonicalProse as ObjectValue | undefined),
			},
			prosePresentation: {
				...(field.object.prosePresentation as ObjectValue | undefined),
			},
		}
		const provenance: ProseField[] = []
		const values = field.values.map((source) => {
			const translated = translations.get(
				`${source.sourceId}:${source.sourceRevision}`,
			)
			provenance.push({
				language: translated ? language : "en",
				source: translated
					? translated.kind === "template"
						? "template"
						: "localized"
					: "canonical",
				fallback: !translated && language !== "en",
				sourceId: source.sourceId,
				sourceRevision: source.sourceRevision,
			})
			return translated?.text ?? source.text
		})
		copy[field.key] = field.array ? values : values[0]
		;(copy.canonicalProse as ObjectValue)[field.key] = field.array
			? field.values.map((s) => s.text)
			: field.values[0].text
		;(copy.prosePresentation as ObjectValue)[field.key] = field.array
			? provenance
			: provenance[0]
		copies.set(field.object, copy)
	}
	const clone = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(clone)
		if (!value || typeof value !== "object" || value instanceof Date)
			return value
		return Object.fromEntries(
			Object.entries(copies.get(value) ?? value).map(([key, child]) => [
				key,
				clone(child),
			]),
		)
	}
	return clone(payload) as T
}
export function proseFieldLanguage(
	value: unknown,
	key: string,
	index?: number,
): string {
	const metadata = (
		value as { prosePresentation?: ProsePresentation } | undefined
	)?.prosePresentation?.[key]
	return (
		(Array.isArray(metadata) ? metadata[index ?? 0] : metadata)?.language ??
		"en"
	)
}
