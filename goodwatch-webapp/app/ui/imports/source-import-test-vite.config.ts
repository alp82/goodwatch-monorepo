import path from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
	resolve: { alias: { "~": path.resolve(process.cwd(), "app") } },
})
