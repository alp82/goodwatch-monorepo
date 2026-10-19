/// <reference types="vite/client" />
/// <reference types="@remix-run/node" />

// A blog post, compiled by @mdx-js/rollup (vite.config.js). Its components prop maps elements and the post's own
// pieces (app/ui/blog/mdx-components.tsx).
declare module "*.mdx" {
	import type { ComponentType } from "react"
	const Post: ComponentType<{ components?: Record<string, unknown> }>
	export default Post
}

// The lazy server import uses Remix's exact route manifest in dev and production.
declare module "virtual:remix/server-build" {
	export const routes: import("@remix-run/server-runtime").ServerBuild["routes"]
	export const assetsBuildDirectory: string
	export const publicPath: string
	export const assets: import("@remix-run/server-runtime").ServerBuild["assets"]
}
