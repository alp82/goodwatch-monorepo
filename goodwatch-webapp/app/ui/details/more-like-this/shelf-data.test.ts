import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { nearestKeys } = await import("./shelf-data.ts")
const { titleKey } = await import("../../../utils/title-key.ts")

const t = (key: string, sim: number, poster = "p.jpg") =>
	[key, key, "2020", poster, sim, ""] as never

test("the Similar shelf is the pack's nearest titles, most similar first, without the title and posterless ones", () => {
	const pack = {
		n: [
			t("m1", 0.5),
			t("m693134", 0.99),
			t("s2", 0.9),
			t("m3", 0.95, ""),
			t("m4", 0.7),
			t("s2", 0.9),
		],
	}
	assert.deepEqual(nearestKeys(pack, "movie", 693134), [
		titleKey("show", 2),
		titleKey("movie", 4),
		titleKey("movie", 1),
	])
	assert.deepEqual(nearestKeys(pack, "movie", 693134, 2), [
		titleKey("show", 2),
		titleKey("movie", 4),
	])
})
