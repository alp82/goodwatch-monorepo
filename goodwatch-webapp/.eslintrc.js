/** @type {import('eslint').Linter.Config} */

module.exports = {
	extends: [
		"plugin:@tanstack/eslint-plugin-query/recommended",
		"@remix-run/eslint-config",
		"@remix-run/eslint-config/node",
	],
}
