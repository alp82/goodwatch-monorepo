import test from 'node:test';
import assert from 'node:assert/strict';
import { scaledDisplay, currentDensity } from '../e2e/native/lib/display.mjs';
import { a11yAudit } from '../e2e/native/lib/gates.mjs';

test('software-rendered half resolution preserves the dp viewport and physical touch requirement', () => {
  const size = 'Physical size: 1080x2400\nOverride size: 540x1200';
  const density = 'Physical density: 420\nOverride density: 210';
  const full = scaledDisplay(size, density), half = scaledDisplay(size, density, 0.5);
  assert.equal(half.width * 160 / half.density, full.width * 160 / full.density);
  assert.equal(half.height * 160 / half.density, full.height * 160 / full.density);
  assert.equal(currentDensity(density), 210);
  assert.equal(currentDensity('Physical density: 420'), 420);
});

test('48 dp remains required at both emulator render resolutions', () => {
  for (const density of [420, 210]) {
    const px = Math.round(48 * density / 160);
    const root = { depth: 0, bounds: [0, 0, 1080, 2400] };
    const action = { depth: 1, bounds: [100, 200, 100 + px, 200 + px], w: px, h: px, cls: 'android.widget.Button', desc: 'Action', text: '', visible: true, enabled: true, clickable: true };
    assert.equal(a11yAudit([root, action], { density }).length, 0);
    assert.equal(a11yAudit([root, { ...action, w: px - 1 }], { density })[0].rule, 'target-size');
  }
});

test('invalid display configuration fails explicitly', () => {
  assert.throws(() => scaledDisplay('Physical size: 1080x2400', 'Physical density: 420', 0));
  assert.throws(() => scaledDisplay('unavailable', 'Physical density: 420', 0.5));
  assert.throws(() => currentDensity('unavailable'));
});
