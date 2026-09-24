// Open Graph images live under /og/. The fixed-depth routes are needed because the
// catch-all alone loses to $type.$category.$page and friends for paths up to three segments.
export { ogImageLoader as loader } from "~/server/og-image/og-image-route.server"
