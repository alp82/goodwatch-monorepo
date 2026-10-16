import { installGlobals } from "@remix-run/node"

// Match remix-serve before loading the test alias hook: its fetch globals differ
// from Node's native implementations and load CommonJS dependencies lazily.
installGlobals()
