// One definition of the Search chip filters, shared by the route, retrieval and the browser.
// No server-only imports: the client builds and applies the same object.
export interface SearchFilters {
	type?: "movie" | "show";
	// Genre names as stored in Crate and Qdrant ("Comedy"). A title must have all of them.
	genres?: string[];
	minYear?: number;
	maxYear?: number;
	streaming?: { country: string; providerIds: number[] };
	// Only these titles ("movie:550"): the credits of the people a search names. Set by the server only;
	// parseSearchFilters never reads it from a request.
	onlyTitles?: string[];
}

const GENRE = /^[\p{L}\p{N} &-]{1,40}$/u;
const year = (value: unknown) =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value >= 1870 &&
	value <= 2100
		? value
		: undefined;

// Strict: anything that does not validate is dropped, never passed on.
export const parseSearchFilters = (input: unknown): SearchFilters => {
	if (!input || typeof input !== "object" || Array.isArray(input)) return {};
	const raw = input as Record<string, unknown>;
	const filters: SearchFilters = {};
	if (raw.type === "movie" || raw.type === "show") filters.type = raw.type;
	if (Array.isArray(raw.genres)) {
		const genres = [
			...new Set(
				raw.genres.filter(
					(g): g is string => typeof g === "string" && GENRE.test(g),
				),
			),
		].slice(0, 10);
		if (genres.length) filters.genres = genres;
	}
	const minYear = year(raw.minYear),
		maxYear = year(raw.maxYear);
	if (minYear !== undefined) filters.minYear = minYear;
	if (maxYear !== undefined) filters.maxYear = maxYear;
	const streaming = raw.streaming as Record<string, unknown> | null | undefined;
	if (streaming && typeof streaming === "object") {
		const providerIds = Array.isArray(streaming.providerIds)
			? [
					...new Set(
						streaming.providerIds.filter(
							(id): id is number =>
								typeof id === "number" && Number.isInteger(id) && id > 0,
						),
					),
				].slice(0, 50)
			: [];
		if (
			typeof streaming.country === "string" &&
			/^[A-Z]{2}$/.test(streaming.country) &&
			providerIds.length
		)
			filters.streaming = { country: streaming.country, providerIds };
	}
	return filters;
};

// Stable across key order and list order; empty when nothing is filtered.
export const searchFiltersKey = (filters: SearchFilters | undefined) => {
	if (!filters) return "";
	const parts: string[] = [];
	if (filters.type) parts.push(`t=${filters.type}`);
	if (filters.genres?.length) parts.push(`g=${[...filters.genres].sort().join(",")}`);
	if (filters.minYear !== undefined) parts.push(`min=${filters.minYear}`);
	if (filters.maxYear !== undefined) parts.push(`max=${filters.maxYear}`);
	if (filters.streaming?.providerIds.length)
		parts.push(
			`s=${filters.streaming.country}:${[...filters.streaming.providerIds].sort((a, b) => a - b).join(",")}`,
		);
	return parts.join(";");
};

const yearRange = (filters: SearchFilters) =>
	filters.minYear !== undefined || filters.maxYear !== undefined
		? {
				...(filters.minYear !== undefined ? { gte: filters.minYear } : {}),
				...(filters.maxYear !== undefined ? { lte: filters.maxYear } : {}),
			}
		: null;

// Qdrant point ids: movies at 10^12 + TMDB id, shows at 2 * 10^12 + TMDB id.
export const titlePointId = (key: string) => {
	const [type, id] = key.split(":");
	return (type === "show" ? 2 : 1) * 1_000_000_000_000 + Number(id);
};

// Title lookup rows skip retrieval, so their titles are checked here.
export const allowsTitle = (filters: SearchFilters | undefined, key: string) =>
	!filters?.onlyTitles || filters.onlyTitles.includes(key);

// Qdrant payload: media_type, genres (names), release_year (integer), streaming_availability ("8_DE").
export const toQdrantMust = (filters: SearchFilters | undefined): unknown[] => {
	if (!filters) return [];
	const must: unknown[] = [];
	if (filters.type)
		must.push({ key: "media_type", match: { value: filters.type } });
	for (const genre of filters.genres ?? [])
		must.push({ key: "genres", match: { value: genre } });
	const range = yearRange(filters);
	if (range) must.push({ key: "release_year", range });
	if (filters.onlyTitles)
		must.push({ has_id: filters.onlyTitles.map(titlePointId) });
	if (filters.streaming?.providerIds.length)
		must.push({
			key: "streaming_availability",
			match: {
				any: filters.streaming.providerIds.map(
					(id) => `${id}_${filters.streaming?.country}`,
				),
			},
		});
	return must;
};

// Crate columns: genres (text array), release_year, streaming_availabilities ("DE_8").
// `sql` is empty or starts with " AND "; null means the table is excluded by type or by the titles.
export const toCrateSql = (
	filters: SearchFilters | undefined,
	table: "movie" | "show",
): { sql: string; params: (string | number)[] } | null => {
	if (!filters) return { sql: "", params: [] };
	if (filters.type && filters.type !== table) return null;
	const clauses: string[] = [],
		params: (string | number)[] = [];
	for (const genre of filters.genres ?? []) {
		clauses.push("? = ANY(genres)");
		params.push(genre);
	}
	if (filters.minYear !== undefined) {
		clauses.push("release_year >= ?");
		params.push(filters.minYear);
	}
	if (filters.maxYear !== undefined) {
		clauses.push("release_year <= ?");
		params.push(filters.maxYear);
	}
	if (filters.onlyTitles) {
		const ids = filters.onlyTitles
			.filter((key) => key.startsWith(`${table}:`))
			.map((key) => Number(key.slice(table.length + 1)))
			.filter(Number.isSafeInteger);
		if (!ids.length) return null;
		// "+ 0": a bare tmdb_id IN (...) makes Crate plan a primary key lookup, which can't evaluate MATCH.
		clauses.push(`(tmdb_id + 0) IN (${ids.map(() => "?").join(",")})`);
		params.push(...ids);
	}
	if (filters.streaming?.providerIds.length) {
		const { country, providerIds } = filters.streaming;
		clauses.push(
			`(${providerIds.map(() => "? = ANY(streaming_availabilities)").join(" OR ")})`,
		);
		params.push(...providerIds.map((id) => `${country}_${id}`));
	}
	return { sql: clauses.map((c) => ` AND ${c}`).join(""), params };
};

// For rows retrieval cannot filter (title matches). Streaming is left to the watchability check.
export const matchesRow = (
	filters: SearchFilters | undefined,
	row: { type: string; year?: string | number | null; genres?: string[] | null },
) => {
	if (!filters) return true;
	if (filters.type && row.type !== filters.type) return false;
	if (filters.genres?.some((genre) => !(row.genres ?? []).includes(genre)))
		return false;
	if (filters.minYear !== undefined && !(Number(row.year) >= filters.minYear))
		return false;
	if (filters.maxYear !== undefined && !(Number(row.year) <= filters.maxYear))
		return false;
	return true;
};
