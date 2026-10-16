import { Client } from "pg"
import { crateAuthTransport } from "../../app/server/auth/crate-adapter.server.ts"
import {
	SupabaseImportError,
	importSupabaseAuth,
} from "../../app/server/auth/supabase-importer.server.ts"

// This entry point deliberately cannot connect to hosted databases. A real
// rehearsal restores backups locally; neither dotenv nor application DB config
// is loaded. Markers must be installed explicitly on the restored copy.
let source: Client | undefined
let failureCode = "configuration_refused"
try {
	const args = process.argv.slice(2)
	if (args.length > 1 || args.some((arg) => arg !== "--apply"))
		throw new Error()
	const sourceUrl = new URL(process.env.AUTH_IMPORT_SOURCE_URL ?? "")
	const targetUrl = new URL(process.env.AUTH_IMPORT_CRATE_ORIGIN ?? "")
	const encryptionSecret = process.env.AUTH_IMPORT_PAYLOAD_SECRET ?? ""
	const crateUsername = process.env.AUTH_IMPORT_CRATE_USERNAME
	const cratePassword = process.env.AUTH_IMPORT_CRATE_PASSWORD
	const targetProfile = process.env.AUTH_IMPORT_TARGET_PROFILE ?? "fake-551"
	if (
		!["fake-551", "restored-563"].includes(targetProfile) ||
		process.env.AUTH_IMPORT_COPY_ONLY !== "yes" ||
		encryptionSecret.length < 32 ||
		((crateUsername !== undefined || cratePassword !== undefined) &&
			(!crateUsername || !cratePassword || /[:\r\n]/.test(crateUsername))) ||
		!["postgres:", "postgresql:"].includes(sourceUrl.protocol) ||
		sourceUrl.hostname !== "127.0.0.1" ||
		sourceUrl.port !== "15651" ||
		sourceUrl.pathname !== "/auth_copy" ||
		sourceUrl.search ||
		sourceUrl.hash ||
		!sourceUrl.username ||
		targetUrl.origin !== "http://127.0.0.1:15648" ||
		targetUrl.pathname !== "/" ||
		targetUrl.username ||
		targetUrl.password ||
		targetUrl.search ||
		targetUrl.hash
	)
		throw new Error()
	source = new Client({
		host: "127.0.0.1",
		port: 15651,
		database: "auth_copy",
		user: decodeURIComponent(sourceUrl.username),
		password: decodeURIComponent(sourceUrl.password),
		ssl: false,
		connectionTimeoutMillis: 5000,
		statement_timeout: 60_000,
		application_name: "goodwatch-supabase-import-copy-551",
	})
	source.on("error", () => {
		/* Raw driver errors can contain secrets. Requests fail through the sanitized boundary. */
	})
	failureCode = "copy_marker_refused"
	await source.connect()
	const marker = (
		await source.query(
			"SELECT kind FROM public.goodwatch_auth_import_copy WHERE id=551",
		)
	).rows
	if (
		marker.length !== 1 ||
		!["fake", "restored-copy"].includes(marker[0].kind)
	)
		throw new Error()
	const sql = crateAuthTransport(
		[targetUrl.origin],
		15_000,
		crateUsername && cratePassword
			? { username: crateUsername, password: cratePassword }
			: undefined,
	)
	const expectedCluster =
		targetProfile === "restored-563"
			? "goodwatch-restore-563-551"
			: "goodwatch-local-importer-551"
	if (
		(await sql("SELECT name FROM sys.cluster")).rows[0][0] !== expectedCluster
	)
		throw new Error()
	const nodes = (await sql("SELECT name,version['number'] FROM sys.nodes")).rows
	const expectedNodes =
		targetProfile === "restored-563"
			? [1, 2, 3].map((i) => [`restore-563-${i}`, "5.10.16"])
			: [["importer-551", "5.10.12"]]
	if (JSON.stringify([...nodes].sort()) !== JSON.stringify(expectedNodes))
		throw new Error()
	if (targetProfile === "restored-563" && marker[0].kind !== "restored-copy")
		throw new Error()
	failureCode = "import_failed"
	const report = await importSupabaseAuth({
		source,
		sql,
		encryptionSecret,
		apply: args.includes("--apply"),
	})
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} catch (error) {
	process.stdout.write(
		`${JSON.stringify(error instanceof SupabaseImportError ? error.report : { status: "failed", issues: [{ code: failureCode }] }, null, 2)}\n`,
	)
	process.exitCode = 1
} finally {
	if (source) await source.end().catch(() => {})
}
