// lint-staged passes filenames as arguments, backs up the index, and hides unstaged hunks.
export default {
	"goodwatch-webapp/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json,jsonc,css,html,md,mdx}":
		"node scripts/code-quality.mjs staged",
	"{scripts/code-quality*.mjs,lint-staged.config.mjs,package.json,.oxfmtrc.json,.oxlintrc.json,.vscode/*.json}":
		"node scripts/code-quality.mjs staged",
}
