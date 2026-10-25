// Run with the deployed app's environment: npx vite-node --config scripts/profile-tropes/vite.config.mjs scripts/profile-tropes/warm.ts HANDLE [HANDLE ...]
import { getProfilePage } from "../../app/server/share-lists/view.server"
import { refreshProfileTropes } from "../../app/server/profile/tropes.server"
import { stopRedisClusterForTest } from "../../app/utils/cache"

const handles = process.argv.slice(2)
if (!handles.length) throw new Error("Supply at least one profile handle")
try {
	for (const handle of handles) {
		const page = await getProfilePage(handle.replace(/^@/, ""))
		if (!page) throw new Error(`Profile @${handle} does not exist`)
		const started = Date.now()
		const pool = await refreshProfileTropes(page.profile.userId)
		console.log(
			`@${handle}: ${pool.tropes.length} tropes, ${pool.pool.length} titles, ${Date.now() - started} ms`,
		)
	}
} finally {
	stopRedisClusterForTest()
}
