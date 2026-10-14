#!/usr/bin/env node
// Source call-site index, not a control-flow analyzer or a runtime allowlist.
// NODE_PATH=/path/to/node_modules node scan-calls.cjs /path/to/better-auth
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(process.argv[2] || '.');
const pin = 'db02f233918ad1233bf0753e437e1c0da353273d';
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (sha !== pin) throw new Error(`Expected v1.7.7 ${pin}, found ${sha}`);
const directories = [
  'packages/better-auth/src/db', 'packages/better-auth/src/api',
  'packages/better-auth/src/oauth2', 'packages/better-auth/src/plugins/jwt',
  'packages/oauth-provider/src', 'packages/mcp/src', 'packages/cimd/src',
  'packages/core/src/db/adapter',
  'packages/better-auth/src/state.ts',
];
const operations = new Set(['create', 'findOne', 'findMany', 'update', 'updateMany',
  'delete', 'deleteMany', 'count', 'consumeOne', 'incrementOne', 'transaction']);
const hooks = new Set(['createWithHooks', 'updateWithHooks', 'updateManyWithHooks',
  'deleteWithHooks', 'deleteManyWithHooks', 'consumeOneWithHooks']);
const calls = [];
const compact = (node, source) => node.getText(source).replace(/\s+/g, ' ');
function scan(relative) {
  const isFile = fs.statSync(path.join(root, relative)).isFile();
  const entries = isFile ? [{ name: path.basename(relative), isDirectory: () => false }] :
    fs.readdirSync(path.join(root, relative), { withFileTypes: true });
  if (isFile) relative = path.dirname(relative);
  for (const entry of entries) {
    const file = `${relative}/${entry.name}`;
    if (entry.isDirectory()) { scan(file); continue; }
    if (!file.endsWith('.ts') || /\.(test|spec)\.ts$/.test(file)) continue;
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const method = ts.isPropertyAccessExpression(expression) ? expression.name.text :
          ts.isIdentifier(expression) ? expression.text : '';
        const receiver = ts.isPropertyAccessExpression(expression) ? compact(expression.expression, source) : '';
        const kind = hooks.has(method) ? 'hook' :
          operations.has(method) && (/adapter/i.test(receiver) || receiver === 'db') ? 'adapter' :
          /internalAdapter/.test(receiver) ? 'internal' :
          /secondaryStorage/.test(receiver) ? 'secondary' : null;
        if (kind) {
          const record = { file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, kind, method };
          if (kind === 'adapter' && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
            record.arguments = {};
            for (const property of node.arguments[0].properties) {
              if (ts.isPropertyAssignment(property)) record.arguments[compact(property.name, source)] = compact(property.initializer, source);
              else if (ts.isShorthandPropertyAssignment(property)) record.arguments[property.name.text] = property.name.text;
              else record.arguments.spread = compact(property, source);
            }
          } else {
            // Custom callback bodies are deliberately omitted; recurse visits their calls.
            record.arguments = node.arguments.map(arg => ts.isObjectLiteralExpression(arg) ?
              `{ ${arg.properties.map(p => p.name ? compact(p.name, source) : '...').join(', ')} }` :
              ts.isArrowFunction(arg) ? '<callback>' : compact(arg, source));
          }
          calls.push(record);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
directories.forEach(scan);
const versions = Object.fromEntries(['better-auth', 'core', 'oauth-provider', 'mcp', 'cimd', 'redis-storage'].map(name => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'packages', name, 'package.json'), 'utf8'));
  return [pkg.name, pkg.version];
}));
process.stdout.write(JSON.stringify({ source: 'https://github.com/better-auth/better-auth', tag: 'v1.7.7', sha, versions,
  caveat: 'Static call sites include optional and unreachable features. Resolve variables and hook/factory expansion using the accompanying inventory; this is not an executable allowlist.', calls }, null, 2) + '\n');
