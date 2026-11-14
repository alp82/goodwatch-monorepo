type AuthSql = (statement: string, args?: unknown[]) => Promise<any>; const localTransports = new WeakSet<AuthSql>();
export const authModelTable = (model: string) => {
	if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(model)) throw new Error("Invalid auth model name")
	return `doc.auth_${model.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`
}
export const authModels = ["user", "account", "session", "verification", "jwks", "oauthClient", "oauthResource", "oauthClientResource", "oauthConsent", "oauthAccessToken", "oauthRefreshToken", "oauthClientAssertion", "rateLimit"]
const indexedFields = ["userId", "clientId", "sessionId", "referenceId", "resourceId", "identifier", "refreshId", "authorizationCodeId", "lastRequest", "count"]
export async function migrateAuthTables(sql: AuthSql, additionalModels: string[] = []) {
	if (additionalModels.length && !localTransports.has(sql)) throw new Error("Additional tables require the disposable local transport")
	for (const model of new Set([...authModels, "capacity", ...additionalModels])) {
		await sql(`CREATE TABLE IF NOT EXISTS ${authModelTable(model)} (
		id TEXT PRIMARY KEY, payload TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL,
		lookup OBJECT(STRICT) AS (${indexedFields.map(field => `"${field}" ${["lastRequest", "count"].includes(field) ? "DOUBLE PRECISION" : "TEXT"}`).join(",")}),
		created_at TIMESTAMP WITH TIME ZONE, expires_at TIMESTAMP WITH TIME ZONE,
		deleted BOOLEAN NOT NULL DEFAULT false, receipts TEXT INDEX OFF STORAGE WITH (columnstore = false) NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1)`)
		const ddl = String((await sql(`SHOW CREATE TABLE ${authModelTable(model)}`)).rows[0]?.[0])
		for (const field of ["payload", "receipts"]) if (!new RegExp(`"${field}" TEXT NOT NULL INDEX OFF STORAGE WITH \\(\\s*columnstore = false`).test(ddl)) throw new Error("Incompatible prerelease auth schema: rebuild disposable tables or perform an offline migration before use")
	}
	await sql(`CREATE TABLE IF NOT EXISTS doc.auth_user_email (
		email_norm TEXT PRIMARY KEY, user_id TEXT NOT NULL, operation_id TEXT NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL, user_seq LONG NOT NULL
	) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='2', "write.wait_for_active_shards"=1,
		"translog.durability"='REQUEST', refresh_interval=-1)`)
	if (!String((await sql("SHOW CREATE TABLE doc.auth_user_email")).rows[0]?.[0]).includes('"user_seq" BIGINT NOT NULL')) throw new Error("Incompatible prerelease email claim schema: offline migration required")
}
