import { defineConfig } from "vitest/config"
export default defineConfig({ test: { include: ["adapter.test.ts", "strict-flows.test.ts"], fileParallelism: false, testTimeout: 120000, hookTimeout: 120000 } })
