import { readFile } from "node:fs/promises"
import type { Sql } from "../repository.server.ts"
/** Explicit operator helper only. Never invoked by API startup. No connection is opened here. */
export async function applyRoomRedesign(sql: Sql) {
	const source = await readFile(
		new URL("./20261101-room-redesign.sql", import.meta.url),
		"utf8"
	)
	for (const statement of source
		.replace(/--[^\n]*/g, "")
		.split(";")
		.map((s) => s.trim())
		.filter(Boolean)) {
		const addition = /^ALTER TABLE doc\.(\w+) ADD COLUMN (\w+) /i.exec(
			statement
		)
		if (addition) {
			const found = await sql(
				"SELECT column_name FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?",
				["doc", addition[1], addition[2]]
			)
			if (found.rows.length) continue
		}
		await sql(statement)
	}
}
