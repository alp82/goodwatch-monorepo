const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const app = path.resolve(__dirname, '..');
const contract = path.join(app, 'node_modules/@goodwatch/yepwatch-contracts');
assert.equal(fs.lstatSync(contract).isSymbolicLink(), false, 'Contract must be an isolated installed copy');
const resolutions = ['react', 'react-native', 'react-native-web', 'expo'].map(name => {
  const resolved = require.resolve(name, { paths: [contract] });
  assert.ok(resolved.startsWith(path.join(app, 'node_modules/')), `${name} escaped app dependencies`);
  return { name, resolved: path.relative(app, resolved) };
});
function files(root) { return fs.readdirSync(root, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(root, e.name)) : [path.join(root, e.name)]); }
function mapSources(map) { return [...(map.sources ?? []), ...(map.sections ?? []).flatMap(section => mapSources(section.map))]; }
const graphs = ['dist', 'dist-native'].map(folder => {
  const maps = files(path.join(app, folder)).filter(file => file.endsWith('.map'));
  assert.ok(maps.length, `Export ${folder} with --source-maps first`);
  const sources = maps.flatMap(file => mapSources(JSON.parse(fs.readFileSync(file, 'utf8')))).filter(s => typeof s === 'string');
  assert.ok(sources.some(s => s.includes('@goodwatch/yepwatch-contracts')), 'Contract absent from graph');
  assert.equal(sources.some(s => s.includes('goodwatch-webapp/')), false, 'Webapp dependencies leaked into app bundle');
  assert.equal(sources.some(s => /(?:node-crate|ioredis|auth-stack|app\/server\/)/.test(s)), false, 'Server code leaked into app');
  return { folder, sourceMaps: maps.length, modules: sources.length, sharedContractPresent: true, webappOrServerCodePresent: false };
});
const report = { installedContractIsCopy: true, resolutions, graphs };
fs.writeFileSync(path.join(app, 'artifacts/resolution.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
