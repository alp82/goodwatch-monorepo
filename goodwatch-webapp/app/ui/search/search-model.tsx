// Accepted balanced blend and literal fragment highlighting.
import type { Result } from "~/server/combined-search/reading-retrieval.server";
export type Title = {
	id: number;
	title: string;
	original?: string;
	type: string;
	year: string;
	poster: string | null;
	popularity: number;
	adult?: boolean;
	/** The localized name the search matched, when the lookup matched one (see aliases.server.ts). */
	matchedAlias?: MatchedAlias;
};
/** A localized name (alias) a title matched by: the name as stored, and its language. */
export type MatchedAlias = { text: string; language: string };
// How far a match by a localized name sits below a title match of the same kind (aliases.server.ts ALIAS_STEP).
const ALIAS_STEP = 0.01;
export type Description = { results: Result[] };
const words = (s: string): string[] =>
	s.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const normalized = (s: string) => words(s).join(" ");
type Policy = "balanced" | "title" | "discovery";
export type Row = {
	adult?: boolean;
	key: string;
	title: string;
	original?: string;
	type: string;
	year: string;
	poster: string | null;
	popularity: number;
	discovery?: Description["results"][number];
	lexical: number;
	match: string;
	/** The localized name the row matched by, when that beat its title and original title. */
	matchedAlias?: MatchedAlias;
	score: number;
	// With the new filter bar, for members: the taste match (50 to 99, null without one) and how many places For you
	// moves the row (positive: up; 0 when For you is off). Rows stay in the ranking's order.
	tasteMatch?: number | null;
	moved?: number;
};
export function titleMatch(title: string, query: string) {
	const name = normalized(title),
		request = normalized(query);
	if (!name || !request) return { lexical: 0, match: "" };
	if (name === request) return { lexical: 2, match: "Exact title" };
	const target = words(title),
		wanted = words(query);
	const hits = [...new Set(wanted)].filter((w) => target.includes(w)).length;
	const coverage = hits / new Set(wanted).size;
	if (` ${name} `.includes(` ${request} `))
		return { lexical: 1.05, match: "Exact phrase in title" };
	if (coverage === 1)
		return { lexical: 0.9, match: "All search words in title" };
	if (hits) return { lexical: 0.65 * coverage, match: "Words in title" };
	if (
		wanted.length &&
		target.some((w) => w.startsWith(wanted[wanted.length - 1])) &&
		wanted[wanted.length - 1].length >= 2
	)
		return { lexical: 0.15, match: "Partial word in title" };
	return { lexical: 0, match: "Catalog suggestion" };
}
/**
 * The match by a localized name, one step below a title match of the same kind, when it beats `lexical` (the title's
 * and original title's best); else null.
 */
export function aliasMatch(
	alias: MatchedAlias | undefined,
	q: string,
	lexical: number,
): { lexical: number; match: string; matchedAlias: MatchedAlias } | null {
	if (!alias) return null;
	const m = titleMatch(alias.text, q);
	if (!m.lexical || m.lexical - ALIAS_STEP <= lexical) return null;
	return {
		lexical: m.lexical - ALIAS_STEP,
		match: `${m.match} (localized name)`,
		matchedAlias: alias,
	};
}
export function blend(
	titles: Title[],
	description: Description | null,
	q: string,
	policy: Policy,
) {
	const rows = new Map<string, Row>();
	for (const t of titles) {
		const type = t.type === "tv" ? "show" : t.type;
		const key = `${type}:${t.id}`;
		rows.set(key, {
			key,
			title: t.title,
			original: t.original,
			type,
			year: t.year,
			poster: t.poster,
			adult: t.adult,
			popularity: t.popularity,
			...titleMatch(t.title, q),
			matchedAlias: t.matchedAlias,
			score: 0,
		});
	}
	for (const d of description?.results ?? []) {
		const key = `${d.media_type}:${d.tmdb_id}`;
		const row = rows.get(key) ?? {
			key,
			title: d.title,
			type: d.media_type,
			year: String(d.release_year),
			poster: d.poster_path,
			popularity: 0,
			...titleMatch(d.title, q),
			score: 0,
		};
		row.discovery = d;
		rows.set(key, row);
	}
	for (const row of rows.values()) {
		const original = titleMatch(row.original ?? "", q);
		if (original.lexical > row.lexical) {
			row.lexical = original.lexical;
			row.match = `${original.match} (original name)`;
		}
		const alias = aliasMatch(row.matchedAlias, q, row.lexical);
		if (alias) Object.assign(row, alias);
		else delete row.matchedAlias;
		// Rank fusion avoids pretending that text relevance and fingerprint scores share a scale.
		const fingerprint = row.discovery ? 10 / (9 + row.discovery.rank) : 0;
		const titleWeight =
			policy === "title" ? 1.4 : policy === "discovery" ? 0.75 : 1;
		const discoveryWeight = policy === "discovery" ? 1.1 : 0.9;
		row.score =
			row.lexical === 2
				? 3 + 0.1 * fingerprint
				: Math.max(row.lexical * titleWeight, fingerprint * discoveryWeight) +
					Math.min(row.lexical, fingerprint) * 0.15;
	}
	return [...rows.values()]
		.sort(
			(a, b) =>
				b.score - a.score ||
				b.popularity - a.popularity ||
				a.key.localeCompare(b.key),
		)
		.slice(0, 100);
}
export function Highlight({ text, query }: { text: string; query: string }) {
	const terms = [...new Set(words(query))].sort((a, b) => b.length - a.length);
	if (!terms.length) return <>{text}</>;
	// Tokens contain only letters/numbers, so they are safe regex alternatives.
	// Match every query token anywhere in the title, preferring longer overlaps.
	const pattern = new RegExp(`(${terms.join("|")})`, "giu");
	return (
		<>
			{text.split(pattern).map((part, i) =>
				i % 2 === 1 ? (
					<mark key={i} className="rounded bg-amber-300/20 text-amber-200">
						{part}
					</mark>
				) : (
					<span key={i}>{part}</span>
				),
			)}
		</>
	);
}
