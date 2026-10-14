import { Client } from "pg"
import {
	crateAuthTransport,
	migrateAuthTables,
} from "../../app/server/auth/crate-adapter.server.ts"
import { seedFakeAuth } from "./fixtures.ts"

// Destructive test setup: only the dedicated fake-data cluster/database.
const source = new Client({
	host: "127.0.0.1",
	port: 15651,
	database: "auth_copy",
	user: "importer",
	password: "local-fake-only",
	connectionTimeoutMillis: 2000,
})
const sql = crateAuthTransport(["http://127.0.0.1:15648"], 2000)
try {
	await source.connect()
	const deadline = Date.now() + 60_000
	let ready = false
	while (Date.now() < deadline) {
		try {
			const cluster = (await sql("SELECT name FROM sys.cluster")).rows
			const nodes = (await sql("SELECT name,version['number'] FROM sys.nodes"))
				.rows
			if (
				cluster[0][0] !== "goodwatch-local-importer-551" ||
				JSON.stringify(nodes) !== JSON.stringify([["importer-551", "5.10.12"]])
			)
				throw new Error("Unexpected cluster")
			ready = true
			break
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 500))
		}
	}
	if (!ready)
		throw new Error("Disposable importer cluster did not become ready")
	await source.query(
		"CREATE TABLE IF NOT EXISTS public.goodwatch_auth_import_copy (id integer PRIMARY KEY, kind text NOT NULL)",
	)
	const marker = (
		await source.query(
			"SELECT kind FROM public.goodwatch_auth_import_copy WHERE id=551",
		)
	).rows[0]
	if (marker && marker.kind !== "fake")
		throw new Error("Refusing to reset a restored copy")
	await source.query(
		"INSERT INTO public.goodwatch_auth_import_copy (id,kind) VALUES (551,'fake') ON CONFLICT DO NOTHING",
	)
	await seedFakeAuth(source)
	await migrateAuthTables(sql)
	for (const table of [
		"user",
		"account",
		"user_email",
		"session",
		"verification",
	]) {
		await sql(`REFRESH TABLE doc.auth_${table}`)
		await sql(`DELETE FROM doc.auth_${table}`)
		await sql(`REFRESH TABLE doc.auth_${table}`)
	}
} finally {
	await source.end()
}
