/// <reference types="vite/client" />
/// <reference types="@remix-run/node" />

// The lazy server import uses Remix's exact route manifest in dev and production.
declare module "virtual:remix/server-build" {
	export const routes: import("@remix-run/server-runtime").ServerBuild["routes"]
	export const assetsBuildDirectory: string
	export const publicPath: string
}
