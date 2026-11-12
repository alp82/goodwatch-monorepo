import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

/**
 * Loads an app module with its imports replaced: `deps` maps an import specifier to its stand-in; `local`
 * maps a specifier to another app module loaded the same way (with the same stand-ins), e.g. a shared helper
 * the module under test builds on.
 */
export function loadIsolated<T>(file: URL, deps: Record<string, unknown>, local: Record<string, URL> = {}): T {
  const loaded = new Map<string, unknown>();
  const load = (url: URL): unknown => {
    const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports: Record<string, unknown> = {};
    runInNewContext(code, { exports, Date, Math, Promise, Error, Array, Set, Map, Number, console, setTimeout, clearTimeout, require: (name: string) => {
      if (name in local) {
        if (!loaded.has(name)) loaded.set(name, load(local[name]));
        return loaded.get(name);
      }
      if (name in deps) return deps[name];
      throw new Error(`Unexpected dependency ${name}`);
    } });
    return exports;
  };
  return load(file) as T;
}
