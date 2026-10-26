import { getUserData } from "~/server/userData.server"
import { titlePath } from "~/utils/helpers"
import { readProfileCatalog } from "./catalog.server"
import {
	readTropeDescriptions,
	resolveTropeReferences,
} from "./trope-catalog.server"
import {
	readCachedTropePool,
	writeCachedTropePool,
} from "./tropes-cache.server"
import { createTropesLoader } from "./tropes-data"

// TV Tropes text, CC BY-NC-SA 3.0. Views must link to the source and license.
const loaders = createTropesLoader({
	read: readProfileCatalog,
	userData: (userId) => getUserData({ user_id: userId }),
	readCache: readCachedTropePool,
	writeCache: writeCachedTropePool,
	titlePath,
	readDescriptions: readTropeDescriptions,
	resolveReferences: resolveTropeReferences,
})

/** Call with the context resolved by profileLoader or loadProfileShell. Hidden parts return null. */
export const loadProfileTropes = loaders.loadProfileTropes
export const loadProfileTropeExcerpts = loaders.loadProfileTropeExcerpts
export type { ProfileTropes } from "./tropes-data"
export type { TropePool, PoolTitle } from "./tropes-model"

/** Called off the ratings write path after writes have settled. A write during a build needs one more build. */
export async function refreshProfileTropes(userId: string) {
	return loaders.refreshProfileTropes(userId, true)
}
