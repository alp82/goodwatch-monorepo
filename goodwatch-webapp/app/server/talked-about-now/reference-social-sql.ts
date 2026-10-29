// Frozen pre-staging queries, used only for regression tests and the local SQL benchmark.
import { CONTENT_QUALITY_VERSION, RELEVANCE_VERSION } from "./social-store.server.ts"
import type { BuzzTitle } from "../../domain/talked-about-now.ts"
export const contentQualityJoin = (schema: string) =>
	`JOIN ${schema}.social_content_quality q ON q.post_id = p.post_id AND q.content_hash = p.content_hash
    AND q.version = '${CONTENT_QUALITY_VERSION}' AND q.status = 'pass'`

export const relevanceJoin = (schema: string) =>
	`JOIN ${schema}.social_relevance rel ON rel.media_type = l.media_type AND rel.media_tmdb_id = l.media_tmdb_id
    AND rel.post_id = l.post_id AND rel.content_hash = p.content_hash
    AND rel.version = '${RELEVANCE_VERSION}' AND rel.status = 'keep'`

export function readTitleSql(schema: string, disabledLanes: readonly string[]): string {
	const lanes = disabledLanes.length ? ` AND l.lane NOT IN (${disabledLanes.map(() => "?").join(", ")})` : ""
	return `SELECT post_id, source, source_id, url, author, published_at, text, image, lane, score FROM (
  SELECT p.post_id, p.source, p.source_id, p.url, p.author, p.published_at, p.text, CASE WHEN i.post_id IS NOT NULL THEN '/api/social/image/' || p.post_id ELSE NULL END AS image, l.lane, rel.score,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(rel.dup_group, l.duplicate_group, l.post_id)
      ORDER BY rel.score DESC NULLS LAST, p.published_at DESC, p.post_id DESC) AS duplicate_rank
  FROM ${schema}.social_title_link l JOIN ${schema}.social_post p ON p.post_id = l.post_id
  LEFT JOIN ${schema}.social_image i ON i.post_id = p.post_id AND i.status = 'ok'
  ${contentQualityJoin(schema)}
  ${relevanceJoin(schema)}
  LEFT JOIN ${schema}.social_link_report r ON r.media_type = l.media_type AND r.media_tmdb_id = l.media_tmdb_id
    AND r.post_id = l.post_id AND r.status IN ('open', 'confirmed')
  WHERE l.media_type = ? AND l.media_tmdb_id = ? AND l.hidden_at IS NULL AND p.deleted_at IS NULL
    AND p.published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND l.content_hash = p.content_hash AND r.report_id IS NULL${lanes}
) visible WHERE duplicate_rank = 1 ORDER BY score DESC NULLS LAST, published_at DESC, post_id DESC LIMIT ?`
}

export function socialQuery(
	titles: Pick<BuzzTitle, "mediaType" | "tmdbId">[],
	lanes: string[] = [],
): { sql: string; params: (string | number)[] } {
	const params: (string | number)[] = []
	const which = titles
		.map((title) => {
			params.push(title.mediaType === "show" ? "tv" : "movie", title.tmdbId)
			return "(l.media_type = ? AND l.media_tmdb_id = ?)"
		})
		.join(" OR ")
	const lane = lanes.length
		? ` AND l.lane NOT IN (${lanes.map(() => "?").join(", ")})`
		: ""
	params.push(...lanes)
	const sql = `SELECT media_type, media_tmdb_id, post_id, source, source_id, url, author, published_at, text, image, score, dup_group FROM (
  SELECT l.media_type, l.media_tmdb_id, p.post_id, p.source, p.source_id, p.url, p.author, p.published_at, p.text, CASE WHEN i.post_id IS NOT NULL THEN '/api/social/image/' || p.post_id ELSE NULL END AS image,
    rel.score, COALESCE(rel.dup_group, l.duplicate_group, p.post_id) AS dup_group,
    ROW_NUMBER() OVER (PARTITION BY l.media_type, l.media_tmdb_id, COALESCE(rel.dup_group, l.duplicate_group, p.post_id)
      ORDER BY rel.score DESC NULLS LAST, p.published_at DESC, p.post_id DESC) AS duplicate_rank
  FROM doc.social_title_link l JOIN doc.social_post p ON p.post_id = l.post_id
  LEFT JOIN doc.social_image i ON i.post_id = p.post_id AND i.status = 'ok'
  ${contentQualityJoin("doc")}
  ${relevanceJoin("doc")}
  LEFT JOIN doc.social_link_report r ON r.media_type = l.media_type AND r.media_tmdb_id = l.media_tmdb_id
    AND r.post_id = l.post_id AND r.status IN ('open', 'confirmed')
  WHERE (${which}) AND l.hidden_at IS NULL AND p.deleted_at IS NULL
    AND p.published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND l.content_hash = p.content_hash AND r.report_id IS NULL${lane}
) visible WHERE duplicate_rank = 1 ORDER BY score DESC NULLS LAST, published_at DESC, post_id DESC LIMIT 400`
	return { sql, params }
}

