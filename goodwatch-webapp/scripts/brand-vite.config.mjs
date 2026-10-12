// PROTOTYPE - throwaway. Reuse the app's dev config for the brand comparison.
// The metrics labeler imports the virtual server build during its own initialization in development,
// which can leave Remix holding its routes before they have initialized. This preview needs no route
// metrics: skip that recursive import here. Production source and the normal Vite config are unchanged.
import baseConfig from "../vite.config.js"

export default async function brandConfig(env) {
	const config = await baseConfig(env)
	return {
		...config,
		plugins: [
			{
				name: "prototype-brand-metrics",
				enforce: "pre",
				transform(code, id) {
					if (!id.endsWith("/app/server/metrics/http.server.ts")) return
					return {
						code: code.replace(
							'const build = await import("virtual:remix/server-build")',
							'return () => "prototype";\n\tconst build = await import("virtual:remix/server-build")',
						),
						map: null,
					}
				},
			},
			...config.plugins,
		],
	}
}
