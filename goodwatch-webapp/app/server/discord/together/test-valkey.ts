// Dev prerequisite: install lua; TOGETHER_SKIP_LUA=1 explicitly skips Lua agreement tests.
// Execute production Lua against in-memory hash commands, without a server or sockets.
import { spawnSync } from "node:child_process"
import type { EvalClient } from "./store.server.ts"
export const hasLua =
	process.env.TOGETHER_SKIP_LUA !== "1" && spawnSync("lua", ["-v"]).status === 0
if (!hasLua && process.env.TOGETHER_SKIP_LUA !== "1")
	throw new Error(
		"Lua is required for together agreement tests. Install lua or explicitly set TOGETHER_SKIP_LUA=1.",
	)
function literal(v: unknown): string {
	if (v == null) return "nil"
	if (typeof v === "string") return JSON.stringify(v)
	if (typeof v !== "object") return String(v)
	if (Array.isArray(v)) return `{${v.map(literal).join(",")}}`
	return `{${Object.entries(v)
		.map(([k, x]) => `[${literal(k)}]=${literal(x)}`)
		.join(",")}}`
}
export class LuaValkey implements EvalClient {
	hashes: Record<string, Record<string, string>> = {}
	expires: Record<string, number> = {}
	async eval(script: string, n: number, ...args: (string | number)[]) {
		const json: Record<string, unknown> = {}
		for (const v of [
			...Object.values(this.hashes).flatMap(Object.values),
			String(args[n + 2]),
		]) {
			try {
				json[v] = JSON.parse(v)
			} catch {
				/* Non-JSON field. */
			}
		}
		const lua = String.raw`
local hashes = ${literal(this.hashes)}
local expires = ${literal(this.expires)}
local decoded = ${literal(json)}
local function encode(v)
 if type(v) == 'nil' then return 'null' end
 if type(v) == 'boolean' or type(v) == 'number' then return tostring(v) end
 if type(v) == 'string' then
  return '"' .. v:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\r', '\\r'):gsub('\t', '\\t') .. '"'
 end
 local parts = {}
 if #v > 0 then
  for _, x in ipairs(v) do table.insert(parts, encode(x)) end
  return '[' .. table.concat(parts, ',') .. ']'
 end
 for k, x in pairs(v) do table.insert(parts, encode(k) .. ':' .. encode(x)) end
 return '{' .. table.concat(parts, ',') .. '}'
end
cjson = {
 decode = function(s) assert(decoded[s], 'Missing decoded JSON'); return decoded[s] end,
 encode = function(v) local s = encode(v); decoded[s] = v; return s end
}
redis = { call = function(op, key, field, value)
 local h = hashes[key] or {}
 if op == 'HGET' then return h[field] or false end
 if op == 'HGETALL' then
  local flat = {}; for k, v in pairs(h) do table.insert(flat, k); table.insert(flat, v) end; return flat
 end
 if op == 'HSET' then hashes[key] = h; h[field] = value; return 1 end
 if op == 'HDEL' then h[field] = nil; return 1 end
 if op == 'EXPIRE' then expires[key] = field; return 1 end
 error('Unsupported command ' .. op)
end, error_reply = function(s) error(s) end }
KEYS = ${literal(args.slice(0, n))}
ARGV = ${literal(args.slice(n).map(String))}
local function run()
${script}
end
local ok, result = pcall(run)
if not ok then print(encode({error = result})); return end
print(encode({result = result, hashes = hashes, expires = expires}))
`
		const run = spawnSync("lua", ["-e", lua], {
			encoding: "utf8",
			timeout: 5000,
		})
		if (run.status !== 0) throw new Error(run.stderr)
		const output = JSON.parse(run.stdout)
		if (output.error) throw new Error(output.error)
		this.hashes = output.hashes
		this.expires = output.expires
		return output.result ?? null
	}
}
