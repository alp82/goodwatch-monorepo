import assert from "node:assert/strict"
import { test } from "node:test"
import { accountDeletedEmail, deleteAccountEmail } from "./emails.server.ts"

test("the deletion confirmation email names the account, carries the link in both parts and says how long it works", () => {
	const url = "https://goodwatch.app/delete-account?token=abc123"
	const message = deleteAccountEmail("member@example.test", url)
	assert.match(message.subject, /deleting your GoodWatch account/i)
	assert.ok(message.text.includes(url), "plain text holds the full link")
	assert.ok(message.html.includes(`href="${url}"`), "the button opens the link")
	assert.ok(message.text.includes("member@example.test"))
	assert.match(message.text, /one hour and only once/)
	assert.match(message.text, /can't be undone/)
	assert.match(message.text, /Ignore this email/)
})

test("the deletion confirmation email escapes the address in its HTML", () => {
	const message = deleteAccountEmail(
		`"<b>"@example.test`,
		"https://goodwatch.app/delete-account?token=a&b",
	)
	assert.ok(!message.html.includes("<b>"))
	assert.ok(message.html.includes("token=a&amp;b"))
})

test("the account-deleted notice has no link that signs anyone in", () => {
	const message = accountDeletedEmail("https://goodwatch.app")
	assert.match(message.subject, /deleted/i)
	assert.doesNotMatch(message.text, /token=/)
	assert.match(message.text, /connected apps/i)
})
