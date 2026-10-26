import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve("vite"))("esbuild")
const here = dirname(fileURLToPath(import.meta.url))
const app = resolve(here, "../../app")
const noCache = `export const cached=async({target,params})=>target(params); export const declareResettableCache=()=>{}; export const resetCache=async()=>1; export const resetCacheConfirmed=async()=>true; export const getRedisCluster=()=>null; export const readCacheMarker=async()=>null; export const writeCacheMarker=async()=>{}; export const withRedisDeadline=promise=>promise;`
const stubs = {
	"server/genre-row/genre-row.server.ts": `export const genreRow=async()=>null; export const relatedMapKeys=async()=>[];`,
	"utils/cache.ts": noCache,
	"utils/auth.ts": `export const getUserIdFromRequest=async()=>"proof-member"; export const useUser=()=>{throw new Error("UI not exercised")}; export const getAuthFromRequest=async()=>({user:{id:"proof-member"},headers:new Headers()});`,
	"server/media-context.server.ts": `export const saveMediaPreferences=async()=>{}; export const currentSavedMediaPreferences=async()=>({}); export const resolveMediaContext=async()=>({effectiveContext:{country:"US",language:"en",services:[]}});`,
	"server/media-overlay.server.ts": `export const overlayTitles=async()=>new Map(); export {copyPresentationFields} from "${app}/utils/media-overlay-core.ts";`,
	"server/related-map.server.ts": `export const relatedMapLookup=async()=>"none"; export const relatedSectionData=()=>({});`,
	"server/title-extras.server.ts": `export const prefetchTitleExtrasState=async()=>null;`,
	"server/taste/index.server.ts": `export * from "${app}/server/taste/taste.server.ts"; export const loadTaste=async()=>NO_TASTE; import {NO_TASTE} from "${app}/server/taste/taste.server.ts"; export const markTasteChanged=async()=>{}; export const stopTasteStore=async()=>{};`,
	"server/taste/member.server.ts": `export const markTasteChanged=async()=>{}; export const stopTasteStore=async()=>{}; export const loadMemberTaste=async()=>null;`,
	"server/personal-order/rebuild.server.ts": `export const markPersonalOrderChanged=async()=>{};`,
	"server/onboarding-media.server.ts": `export const resetOnboardingMediaCache=async()=>{};`,
	"server/newly-available.server.ts": `export const newOnForLibrary=async()=>new Map();`,
	"server/availability-index.server.ts": `export const isOnServices=()=>false; export const availabilityLoaded=async()=>true; export const availabilityLoadedAt=()=>1; export const servicesFor=(_country,keys)=>keys.map(()=>[]);`,
	"server/title-snapshot/index.server.ts": `export * from "${app}/server/title-snapshot/format.server.ts"; export * from "${app}/server/title-snapshot/snapshot.server.ts"; export const getTitleSnapshot=()=>globalThis.crateProofSnapshot; export const startTitleSnapshot=()=>{};`,
	"server/user-settings.server.ts": `export const setUserSettings=async()=>{}; export const getUserSettings=async()=>({country_default:"US",streaming_providers_default:"",for_you:"yes"});`,
	"server/streaming-providers.server.ts": `export const slimStreamingProviders=x=>x; export const getStreamingProviders=async()=>[];`,
}
await build({
	entryPoints: [resolve(here, "page-loaders.ts")],
	outfile: resolve(here, "page-loaders.generated.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node24",
	packages: "external",
	tsconfig: resolve(here, "../../tsconfig.json"),
	loader: {
		".css": "empty",
		".xml": "text",
		".png": "empty",
		".svg": "empty",
		".woff2": "empty",
		".webp": "empty",
	},
	plugins: [
		{
			name: "local-fault-proof-boundaries",
			setup(b) {
				b.onResolve({ filter: /.*/ }, async (args) => {
					if (args.pluginData?.proofResolved) return
					if (args.path === "virtual:remix/server-build")
						return { path: args.path, namespace: "proof-empty" }
					const r = await b.resolve(args.path, {
						resolveDir: args.resolveDir,
						kind: args.kind,
						pluginData: { proofResolved: true },
					})
					const name = r.path.startsWith(app + "/")
						? r.path.slice(app.length + 1)
						: ""
					if (stubs[name]) return { path: name, namespace: "proof-stub" }
					if (
						name === "server/combined-search/catalog.server.ts" &&
						process.env.CRATE_PROOF_BASELINE === "1"
					)
						return { path: r.path, namespace: "proof-baseline" }
					if (name === "server/tracking.server.ts" && process.env.CRATE_PROOF_TRACKING_BASELINE_COMMIT)
						return { path: r.path, namespace: "proof-tracking-baseline" }
					if (name === "utils/crate.ts")
						return {
							path:
								process.env.CRATE_PROOF_BASELINE === "1"
									? resolve(here, "baseline-crate.ts")
									: r.path,
							external: true,
						}
					if (name === "utils/crate-diagnostics.ts")
						return { path: r.path, external: true }
				})
				b.onLoad({ filter: /.*/, namespace: "proof-tracking-baseline" }, (args) => ({
					contents: execFileSync("git", ["show", `${process.env.CRATE_PROOF_TRACKING_BASELINE_COMMIT}:goodwatch-webapp/app/server/tracking.server.ts`], { encoding: "utf8" }),
					resolveDir: dirname(args.path), loader: "ts",
				}))
				b.onLoad({ filter: /.*/, namespace: "proof-baseline" }, (args) => ({
					contents: execFileSync(
						"git",
						[
							"show",
                            `${process.env.CRATE_PROOF_BASELINE_COMMIT ?? "d3867c10"}:goodwatch-webapp/app/server/combined-search/catalog.server.ts`,
						],
						{ encoding: "utf8" },
					),
					resolveDir: dirname(args.path),
					loader: "ts",
				}))
				b.onLoad({ filter: /.*/, namespace: "proof-stub" }, (args) => ({
					contents: stubs[args.path],
					resolveDir: app,
					loader: "ts",
				}))
				b.onLoad({ filter: /.*/, namespace: "proof-empty" }, () => ({
					contents: "export const routes={};",
					loader: "js",
				}))
			},
		},
	],
})
