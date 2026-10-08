import assert from "node:assert/strict";
import { test } from "node:test";
import { processRole, runsSearch, searchRoleUrl, searchRoleKey } from "./role.server.ts";

test("roles default to both and only page disables search", () => {
	for (const value of [undefined, "", "other", "PAGE", " page ", "both"]) {
		assert.equal(processRole({ WEBAPP_ROLE: value }), "both");
		assert.equal(runsSearch({ WEBAPP_ROLE: value }), true);
	}
	assert.equal(processRole({ WEBAPP_ROLE: "search" }), "search");
	assert.equal(runsSearch({ WEBAPP_ROLE: "search" }), true);
	assert.equal(processRole({ WEBAPP_ROLE: "page" }), "page");
	assert.equal(runsSearch({ WEBAPP_ROLE: "page" }), false);
});

test("only the page role returns a configured, trimmed search URL", () => {
	assert.equal(searchRoleUrl({ WEBAPP_ROLE: "page", SEARCH_ROLE_URL: " https://search.example/ " }), "https://search.example");
	for (const SEARCH_ROLE_URL of [undefined, "", "  "]) {
		assert.equal(searchRoleUrl({ WEBAPP_ROLE: "page", SEARCH_ROLE_URL }), null);
	}
	for (const WEBAPP_ROLE of [undefined, "search", "both", "invalid"]) {
		assert.equal(searchRoleUrl({ WEBAPP_ROLE, SEARCH_ROLE_URL: "https://search.example" }), null);
	}
	assert.equal(searchRoleKey({}), null);
	assert.equal(searchRoleKey({ SEARCH_ROLE_KEY: "secret" }), "secret");
});
