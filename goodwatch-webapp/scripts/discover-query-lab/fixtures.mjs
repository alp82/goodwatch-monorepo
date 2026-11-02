import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { generatedCases } from "./generated-cases.mjs"

export async function loadFixtures(directory) {
	const files = ["phrases.json"]
	try {
		files.push(
			...(await readdir(resolve(directory, "cases")))
				.filter((file) => file.endsWith(".json"))
				.sort()
				.map((file) => `cases/${file}`),
		)
	} catch (error) {
		if (error.code !== "ENOENT") throw error
	}
	const groups = await Promise.all(
		files.map(async (file) => {
			const cases = JSON.parse(await readFile(resolve(directory, file), "utf8"))
			if (
				!Array.isArray(cases) ||
				cases.some((row) => typeof row.query !== "string")
			)
				throw Error(`Invalid phrase set: ${file}`)
			return cases.map((row) => ({ ...row, sourceFile: file }))
		}),
	)
	return [...groups.flat(), ...generatedCases()]
}
