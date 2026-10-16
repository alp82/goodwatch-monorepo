import { Client } from "pg"
import { crateAuthTransport } from "../../app/server/auth/crate-adapter.server.ts"
import { parseAuthEncryptionKeys } from "../../app/server/auth/payload-codec.server.ts"
import {
	SupabaseImportError,
	importSupabaseAuth,
} from "../../app/server/auth/supabase-importer.server.ts"
import { productionBinding, productionImport } from "./production.ts"

// Sources remain isolated loopback copies. Production targets require a verified
// SSH tunnel, explicit opt-in and a frozen source; no dotenv/app config is loaded.
let source: Client | undefined
let failureCode = "configuration_refused"
try {
	const args = process.argv.slice(2)
	const sourceUrl = new URL(process.env.AUTH_IMPORT_SOURCE_URL ?? "")
	const targetUrl = new URL(process.env.AUTH_IMPORT_CRATE_ORIGIN ?? "")
	const encryptionSecret = process.env.AUTH_IMPORT_PAYLOAD_SECRET ?? ""
	const crateUsername = process.env.AUTH_IMPORT_CRATE_USERNAME
	const cratePassword = process.env.AUTH_IMPORT_CRATE_PASSWORD
	const targetProfile = process.env.AUTH_IMPORT_TARGET_PROFILE ?? "fake-551"
	const production = targetProfile === "production"
	const encryptionKeys = process.env.AUTH_IMPORT_ENCRYPTION_KEYS
		? parseAuthEncryptionKeys(process.env.AUTH_IMPORT_ENCRYPTION_KEYS)
		: undefined
	if (
		!["fake-551", "restored-563", "production"].includes(targetProfile) ||
		new Set(args).size !== args.length ||
		args.some(
			(arg) =>
				!(
					production
						? ["--allow-production", "--apply", "--rerun"]
						: ["--apply"]
				).includes(arg),
		) ||
		(args.includes("--rerun") && !args.includes("--apply")) ||
		(production
			? !args.includes("--allow-production") ||
				process.env.AUTH_IMPORT_COPY_ONLY !== undefined ||
				process.env.AUTH_IMPORT_WRITERS_STOPPED !== "yes" ||
				crateUsername !== "goodwatch_auth" ||
				!cratePassword ||
				!encryptionKeys ||
				!process.env.AUTH_IMPORT_RECEIPT ||
				sourceUrl.username !== "auth_copy_reader" ||
				!sourceUrl.password
			: process.env.AUTH_IMPORT_COPY_ONLY !== "yes") ||
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
		!(
			production ? ["frozen-production-552"] : ["fake", "restored-copy"]
		).includes(marker[0].kind)
	)
		throw new Error()
	const sql = crateAuthTransport(
		[targetUrl.origin],
		15_000,
		crateUsername && cratePassword
			? { username: crateUsername, password: cratePassword }
			: undefined,
	)
	const expectedCluster = production
		? "crate-cluster"
		: targetProfile === "restored-563"
			? "goodwatch-restore-563-551"
			: "goodwatch-local-importer-551"
	if (
		(await sql("SELECT name FROM sys.cluster")).rows[0][0] !== expectedCluster
	)
		throw new Error()
	const nodes = (await sql("SELECT name,version['number'] FROM sys.nodes")).rows
	const expectedNodes = production
		? [1, 2, 3].map((i) => [`crate-0${i}`, "5.10.16"])
		: targetProfile === "restored-563"
			? [1, 2, 3].map((i) => [`restore-563-${i}`, "5.10.16"])
			: [["importer-551", "5.10.12"]]
	if (JSON.stringify([...nodes].sort()) !== JSON.stringify(expectedNodes))
		throw new Error()
	if (targetProfile === "restored-563" && marker[0].kind !== "restored-copy")
		throw new Error()
	failureCode = "production_preflight_refused"
	const binding =
		production && encryptionKeys
			? await productionBinding(source, sql, encryptionKeys)
			: undefined
	failureCode = "import_failed"
	const connectedSource = source
	const run = (guards = {}) =>
		importSupabaseAuth({
			source: connectedSource,
			sql,
			encryptionSecret,
			encryptionKeys,
			apply: args.includes("--apply"),
			...guards,
		})
	const report = production
		? await productionImport({
				phase: args.includes("--rerun")
					? "rerun"
					: args.includes("--apply")
						? "apply"
						: "dry",
				receiptPath: process.env.AUTH_IMPORT_RECEIPT ?? "",
				secret: encryptionSecret,
				binding,
				run,
			})
		: await run()
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} catch (error) {
	process.stdout.write(
		`${JSON.stringify(error instanceof SupabaseImportError ? error.report : { status: "failed", issues: [{ code: failureCode }] }, null, 2)}\n`,
	)
	process.exitCode = 1
} finally {
	if (source) await source.end().catch(() => {})
}
