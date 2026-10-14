import resources from "../locales/media/templates.json" with { type: "json" }
import { presentationLanguage } from "../utils/media-presentation.ts"
import { createHash } from "node:crypto"
import { query } from "../utils/crate.ts"
import { cached } from "../utils/cache.ts"
import {
	overlayProsePayload as overlayCore,
	proseBatchKey,
	type ProseTranslation,
	type ProseSource,
} from "../utils/prose-overlay-core.ts"
export const proseRevision = (text: string) =>
	createHash("sha256").update(text, "utf8").digest("hex")

async function readProse(sources: readonly ProseSource[], language: string) {
	const fixed: ProseTranslation[] = []
	const keys = [
		"feelLine",
		"humorLine",
		"worldLine",
		"storyLine",
		"craftLine",
	] as const
	for (const source of sources) {
		for (const key of keys) {
			const revision = proseRevision(resources.locales.en[key])
			if (
				source.sourceId === `template:${revision}` &&
				source.sourceRevision === revision
			) {
				fixed.push({
					source_id: source.sourceId,
					source_revision: revision,
					language,
					text: resources.locales[presentationLanguage(language)][key],
					kind: "template",
					status: "valid",
					validation_revision: "prose-v1",
				})
			}
		}
	}
	const remaining = sources.filter(
		(s) => !fixed.some((row) => row.source_id === s.sourceId),
	)
	if (!remaining.length) return fixed
	try {
		const available = await cached({
			name: "prose-translation-source-v1",
			params: {},
			ttlMinutes: 5,
			target: async () => ({
				tables: await query<{ table_name: string }>(
					"SELECT table_name FROM information_schema.tables WHERE table_schema = 'doc' AND table_name = 'prose_translation'",
				),
			}),
		})
		if (!available.tables.length) return fixed
		return fixed.concat(
			(
				await cached({
					name: "prose-translation-v1",
					params: proseBatchKey(remaining, language),
					ttlMinutes: 5,
					staleMinutes: 0,
					target: async () => ({
						rows: await query<ProseTranslation>(
							`SELECT source_id, source_revision, language, text, status, validation_revision FROM prose_translation WHERE (${remaining
								.map(() => "(source_id = ? AND source_revision = ?)")
								.join(
									" OR ",
								)}) AND language = ? AND status = 'valid' AND validation_revision = 'prose-v1'`,
							[
								...remaining.flatMap((s) => [s.sourceId, s.sourceRevision]),
								language,
							],
						),
					}),
				})
			).rows,
		)
	} catch {
		return fixed
	}
}
export const overlayProsePayload = <T>(payload: T, language: string) =>
	overlayCore(payload, language, proseRevision, readProse)
