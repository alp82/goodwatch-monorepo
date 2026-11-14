import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOM_SCREENS, ROOT_SCREENS } from '../src/features/shell/route-order';

const require = createRequire(import.meta.url);
const { getRoutes } = require('expo-router/build/getRoutes');
const { sortRoutesWithInitial } = require('expo-router/build/sortRoutes');

type Node = { route: string; type: string; initialRouteName?: string; children: Node[] };
/** src/app as expo-router reads it (a require.context stand-in), without its generated routes. */
function routeTree(): Node {
  const app = path.join(import.meta.dirname, '../src/app');
  const files: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), `${prefix}${e.name}/`);
      else if (/\.tsx?$/.test(e.name)) files.push(`./${prefix}${e.name}`);
    }
  };
  walk(app, '');
  const context = Object.assign(() => ({ default: () => null }), { keys: () => files, resolve: (k: string) => k, id: 'app' });
  return getRoutes(context, { ignoreEntryPoints: true, skipGenerated: true, platform: 'web' });
}
const seeded = (node: Node) => [...node.children].sort(sortRoutesWithInitial(node.initialRouteName)).map((c) => c.route);

test('each Stack declares its screens in the order expo-router seeds them (no ROUTE_NAMES_CHANGED after mount)', () => {
  const root = routeTree();
  assert.deepEqual(seeded(root), [...ROOT_SCREENS]);
  const room = root.children.find((c) => c.route === 'room/[id]');
  assert.ok(room);
  assert.deepEqual(seeded(room), [...ROOM_SCREENS]);
});
