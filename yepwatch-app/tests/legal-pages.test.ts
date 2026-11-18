import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { legalPages, linkify, renderLegalPage } from '../scripts/legal-pages';

test('a link stops before the sentence\'s final period', () => {
  assert.equal(linkify('Operator contact details are at https://goodwatch.app/disclaimer. This policy'),
    'Operator contact details are at <a href="https://goodwatch.app/disclaimer">https://goodwatch.app/disclaimer</a>. This policy');
  assert.equal(linkify('Privacy policy: https://yepwatch.com/privacy.'), 'Privacy policy: <a href="https://yepwatch.com/privacy">https://yepwatch.com/privacy</a>.');
});

test('email addresses become mailto links, without the final period', () => {
  assert.equal(linkify('Contact hello@goodwatch.app.'), 'Contact <a href="mailto:hello@goodwatch.app">hello@goodwatch.app</a>.');
  assert.equal(linkify('Email hello@goodwatch.app, or'), 'Email <a href="mailto:hello@goodwatch.app">hello@goodwatch.app</a>, or');
});

test('text around links is escaped', () => {
  assert.equal(linkify('Yep & Nope <b> at https://yepwatch.com/'), 'Yep &amp; Nope &lt;b&gt; at <a href="https://yepwatch.com/">https://yepwatch.com/</a>');
});

test('the committed pages are what the generator writes (npx tsx scripts/build-store-assets.ts)', () => {
  for (const page of legalPages) {
    const committed = fs.readFileSync(path.join(__dirname, '..', 'public', `${page.path}.html`), 'utf8');
    assert.equal(committed, renderLegalPage(page), `public/${page.path}.html is stale`);
    assert.doesNotMatch(committed, /<script/);
  }
});
