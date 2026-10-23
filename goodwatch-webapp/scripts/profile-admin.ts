// Removes a member's profile photo and/or bio by handle, for content that has to go (there is no moderation queue).
// Without --yes it only prints what it would do.
//
//   CRATE_HOSTS=… CRATE_PASS=… node scripts/profile-admin.ts --handle someone --photo --bio [--yes]
//
// It talks to Crate's HTTP endpoint with the webapp's CRATE_* variables. The webapp's caches (settings 5 minutes,
// photo version 1 minute, pages seconds) let the change show within 5 minutes; nothing else needs a restart.

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const value = (name: string) => {
	const at = args.indexOf(`--${name}`)
	return at >= 0 ? args[at + 1] : undefined
}

const handle = (value("handle") ?? "").trim().toLowerCase()
const photo = flag("photo")
const bio = flag("bio")
const yes = flag("yes")

if (!/^[a-z][a-z0-9_]{2,29}$/.test(handle) || (!photo && !bio)) {
	console.error(
		"Usage: node scripts/profile-admin.ts --handle <handle> [--photo] [--bio] [--yes]",
	)
	process.exit(2)
}

const host = (process.env.CRATE_HOSTS ?? "").split(",")[0]?.trim()
if (!host) {
	console.error("CRATE_HOSTS is required")
	process.exit(2)
}
const endpoint = `http://${host}:${process.env.CRATE_PORT || "4200"}/_sql`
const auth = Buffer.from(
	`${process.env.CRATE_USER || "crate"}:${process.env.CRATE_PASS || ""}`,
).toString("base64")

async function sql(stmt: string, params: unknown[] = []) {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Basic ${auth}`,
		},
		body: JSON.stringify({ stmt, args: params }),
	})
	const body = (await response.json()) as {
		rows?: unknown[][]
		rowcount?: number
		error?: { message: string }
	}
	if (!response.ok || body.error)
		throw new Error(body.error?.message ?? `Crate answered ${response.status}`)
	return body
}

const found = await sql(
	"SELECT user_id FROM doc.user_profile WHERE handle = ? AND deleted_at IS NULL",
	[handle],
)
const userId = found.rows?.[0]?.[0] as string | undefined
if (!userId) {
	console.error(`No profile @${handle}`)
	process.exit(1)
}

const plan: string[] = []
if (photo) {
	const current = await sql(
		"SELECT bytes FROM doc.user_avatar WHERE user_id = ?",
		[userId],
	)
	plan.push(
		current.rows?.length
			? `delete the photo (${current.rows[0][0]} bytes)`
			: "no photo to delete",
	)
}
if (bio) {
	const current = await sql(
		"SELECT value FROM user_setting WHERE user_id = ? AND key = 'profile_bio'",
		[userId],
	)
	plan.push(
		current.rows?.[0]?.[0]
			? `clear the bio: ${JSON.stringify(current.rows[0][0])}`
			: "no bio to clear",
	)
}
console.log(`@${handle} (${userId}):\n- ${plan.join("\n- ")}`)
if (!yes) {
	console.log("Dry run. Add --yes to do it.")
	process.exit(0)
}

if (photo) {
	await sql("DELETE FROM doc.user_avatar WHERE user_id = ?", [userId])
	// The picture falls back to the initial when it pointed at the photo.
	await sql(
		`UPDATE user_setting SET value = '{"kind":"initial","color":"amber"}'
		 WHERE user_id = ? AND key = 'profile_avatar' AND value LIKE '%"photo"%'`,
		[userId],
	)
	await sql("REFRESH TABLE doc.user_avatar")
}
if (bio)
	await sql(
		"UPDATE user_setting SET value = '' WHERE user_id = ? AND key = 'profile_bio'",
		[userId],
	)
await sql("REFRESH TABLE user_setting")
console.log("Done. It shows within 5 minutes.")
