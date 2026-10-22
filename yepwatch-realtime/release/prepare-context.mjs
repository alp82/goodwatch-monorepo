import { readdir, readFile, mkdir, copyFile, lstat, writeFile, access } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1])
const source = resolve(args.get('--source') ?? '.')
const apkName = args.get('--preview-apk-filename') ?? 'yepwatch-preview-r1.apk'
if (!/^yepwatch-preview-r[1-9][0-9]*\.apk$/.test(apkName)) throw new Error('Expected a versioned preview APK filename')
if (!args.get('--out')) throw new Error('Explicit new --out build-context directory required')
const out = resolve(args.get('--out'))
try { await access(out); throw new Error('Refusing an existing build-context directory') } catch (error) { if (error.code !== 'ENOENT') throw error }
const manifest = []
async function copy(from, relative) {
  const stat = await lstat(from)
  if (stat.isSymbolicLink()) throw new Error(`No symlink build input: ${relative}`)
  if (stat.isDirectory()) {
    for (const entry of (await readdir(from)).sort()) await copy(join(from, entry), join(relative, entry))
    return
  }
  if (!stat.isFile() || /(^|\/)\.env($|\.)|\.map$/.test(relative)) throw new Error(`Unexpected build input: ${relative}`)
  const target = join(out, relative), data = await readFile(from)
  try {
    const existing = await readFile(target)
    if (!existing.equals(data)) throw new Error(`Conflicting static asset across releases: ${relative}`)
    return
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  await mkdir(dirname(target), { recursive: true }); await copyFile(from, target)
  manifest.push({ path: relative, sha256: createHash('sha256').update(data).digest('hex') })
}
for (const file of ['package.json', 'package-lock.json', 'tsconfig.json', 'src', 'release/Dockerfile.gateway', 'release/runtime.package.json', 'release/launch-gateway.mjs'])
  await copy(join(source, 'yepwatch-realtime', file), join('gateway/yepwatch-realtime', file))
await copy(join(source, 'goodwatch-webapp/packages/yepwatch-contracts'), 'gateway/goodwatch-webapp/packages/yepwatch-contracts')
if (args.has('--web-export')) {
  const web = resolve(args.get('--web-export')); await access(join(web, 'index.html'))
  await copy(web, 'front/public')
  if (args.has('--previous-web-export')) for (const directory of ['_expo', 'assets']) {
    const previous = join(resolve(args.get('--previous-web-export')), directory)
    try { await access(previous) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    await copy(previous, join('front/public', directory))
  }
  for (const file of ['Dockerfile.front', 'Caddyfile']) await copy(join(source, 'yepwatch-realtime/release', file), join('front', file))
}
if (args.has('--preview-download')) {
  if (!args.has('--web-export')) throw new Error('Preview download requires --web-export')
  const downloads = join(resolve(args.get('--preview-download')), 'downloads')
  for (const file of [apkName, `${apkName}.sha256`])
    await copy(join(downloads, file), join('front/public/downloads', file))
  const apk = await readFile(join(downloads, apkName))
  const checksum = (await readFile(join(downloads, `${apkName}.sha256`), 'utf8')).split(/\s+/)[0]
  if (createHash('sha256').update(apk).digest('hex') !== checksum) throw new Error('Preview APK checksum mismatch')
}
if (args.has('--api-bundle')) {
  const api = resolve(args.get('--api-bundle'))
  for (const file of ['server.mjs', 'operator.mjs', 'title-snapshot.worker.js', 'package.json', 'package-lock.json'])
    await copy(join(api, file), join('api/build/yepwatch-release', file))
  for (const file of ['package.json', 'package-lock.json']) await copy(join(api, file), join('api', file))
  await copy(join(source, 'yepwatch-realtime/release/Dockerfile.api'), 'api/Dockerfile.api')
}
await writeFile(join(out, 'manifest.json'), JSON.stringify({ recordedAt: new Date().toISOString(), source, files: manifest }, null, 2) + '\n')
console.info(JSON.stringify({ out, files: manifest.length, gateway: 'Explicit owned source/contracts only; no checkout-wide Docker context', front: args.has('--web-export'), previewDownload: args.has('--preview-download'), api: args.has('--api-bundle') }))
