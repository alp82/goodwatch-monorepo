/** Fixture data must never share an authenticated member's cache entry. */
export const TASTE_GROUPS_FIXTURE_ID = "fixture:member"

export const tasteGroupsKey = (language: string, userId: string | null) =>
	["discover-panel", "taste", language, userId] as const
