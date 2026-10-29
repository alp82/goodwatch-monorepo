import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

let results: Record<string, boolean> | undefined
const run = () => {
	if (!results) {
		const output = execFileSync(
			"node_modules/.bin/vite-node",
			[
				"--config",
				"app/ui/imports/source-import-test-vite.config.ts",
				"app/ui/discover-bar/modal-dialog.test-support.tsx",
			],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
		)
		results = JSON.parse(output.split("__MODAL_TESTS__").at(-1) ?? "")
	}
	assert.ok(results)
	return results
}
for (const [check, description] of Object.entries({
	unavailableRadio:
		"unavailable Best match radio wraps Shift+Tab to the footer",
	wrap: "Tab and Shift+Tab wrap between the dialog's tab stops",
	domOrder:
		"negative-tabindex controls continue to the nearest stop in DOM order",
	empty: "Tab and Shift+Tab move focus into a dialog with no tab stops",
	scroll:
		"PhoneSheet locks scrolling only while open and restores styles and position on close and unmount",
})) {
	test(description, () => assert.equal(run()[check], true))
}
