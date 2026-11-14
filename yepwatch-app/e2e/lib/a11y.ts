// Accessibility gate for one screen state: axe-core (WCAG 2.2 AA tags) plus the owner's rules — every
// visible interactive control has an accessible name and a target of at least 48 × 48 CSS px.
import type { Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { rules as B } from './rules.mjs';
import type { GateFailure } from './gates';

const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');
// One audit per distinct screen state per worker: the same screen in another journey adds nothing.
const audited = new Set<string>();
// The one accepted axe finding. Owner decision 2026-11-14 (Q69): the Rotten Tomatoes score chip keeps its brand
// red (#f83309, src/features/glow/score-format.ts) with white text (3.8:1, audience value at 0.9 opacity 3.3:1),
// "keep it as it is now". Only axe's color-contrast rule, and only nodes inside that chip, are let through; every
// other rule there and every color-contrast node elsewhere still fails.
const ACCEPTED = { rule: 'color-contrast', within: '[data-testid="source-score-rotten"]' } as const;

export async function audit(page: Page, person: string, label: string): Promise<GateFailure[]> {
  const sig = await page.evaluate(() => (window as unknown as { __yw: { signature(): string } }).__yw.signature()).catch(() => '');
  const key = `${sig}|${page.viewportSize()?.width}`;
  if (audited.has(key)) return [];
  audited.add(key);
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE });
  const result = await page.evaluate(async ({ tags, accepted }) => {
    const axe = (window as unknown as { axe: { run(ctx: unknown, opts: unknown): Promise<{ violations: { id: string; impact: string; help: string; nodes: { target: string[]; failureSummary: string }[] }[] }> } }).axe;
    const r = await axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    // A node is accepted only when its target is one plain light-DOM selector (a shadow-DOM target is a nested array,
    // a frame target has several parts: neither is accepted) resolving to an element inside the accepted chip.
    const isAccepted = (id: string, target: unknown[]) => id === accepted.rule && target.length === 1 && typeof target[0] === 'string' && !!document.querySelector(target[0])?.closest(accepted.within);
    return r.violations
      .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !isAccepted(v.id, n.target)) }))
      .filter((v) => v.nodes.length > 0)
      .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')}: ${n.failureSummary.split('\n').slice(1, 2).join(' ').trim()}`), count: v.nodes.length }));
  }, { tags: B.axeTags as string[], accepted: ACCEPTED });
  const controls = await page.evaluate((min) => {
    const sel = 'button, a[href], input:not([type=hidden]), textarea, select, [role=button], [role=link], [role=switch], [role=checkbox], [role=radio], [role=tab], [role=menuitem], [role=slider], [tabindex]:not([tabindex="-1"])';
    const out: { name: string; w: number; h: number; what: string; problem: string }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (el.closest('[aria-hidden="true"], [inert]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const labelled = el.getAttribute('aria-labelledby');
      const name = (el.getAttribute('aria-label') || (labelled && document.getElementById(labelled)?.textContent) || (el as HTMLInputElement).labels?.[0]?.textContent || el.getAttribute('title') || el.textContent || (el as HTMLInputElement).placeholder || '').trim();
      const what = `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''}${el.closest('[data-testid]') ? ` in [${el.closest('[data-testid]')!.getAttribute('data-testid')}]` : ''}`;
      if (!name) out.push({ name, w: r.width, h: r.height, what, problem: 'no accessible name' });
      if (r.width < min - 0.5 || r.height < min - 0.5) out.push({ name: name.slice(0, 50), w: Math.round(r.width), h: Math.round(r.height), what, problem: 'small target' });
    }
    return out;
  }, B.minTargetPx);
  const failures: GateFailure[] = result.map((v) => ({ gate: 'a11y' as const, person, detail: `${label} [${sig}]: axe ${v.id} (${v.impact}, ${v.count} nodes): ${v.help} — ${v.nodes.join(' | ')}`, measured: v.count, budget: 0 }));
  const unnamed = controls.filter((c) => c.problem === 'no accessible name');
  const small = controls.filter((c) => c.problem === 'small target');
  if (unnamed.length) failures.push({ gate: 'a11y', person, detail: `${label} [${sig}]: ${unnamed.length} controls without an accessible name: ${unnamed.slice(0, 6).map((c) => c.what).join(', ')}`, measured: unnamed.length, budget: 0 });
  if (small.length) failures.push({ gate: 'a11y', person, detail: `${label} [${sig}]: ${small.length} targets under ${B.minTargetPx}×${B.minTargetPx}: ${small.slice(0, 8).map((c) => `"${c.name}" ${c.w}×${c.h}`).join(', ')}${small.length > 8 ? ', …' : ''}`, measured: small.length, budget: 0 });
  return failures;
}
