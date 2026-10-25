import { getUserData } from "~/server/userData.server"
import { titlePath } from "~/utils/helpers"
import { readProfileCatalog } from "./catalog.server"
import descriptions from "./trope-descriptions.json"
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
	descriptions,
})

/** Call with the context resolved by profileLoader or loadProfileShell. Hidden parts return null. */
export const loadProfileTropes = loaders.loadProfileTropes
export const loadProfileTropeExcerpts = loaders.loadProfileTropeExcerpts
export type { ProfileTropes } from "./tropes-data"
export type { TropePool, PoolTitle } from "./tropes-model"
