import test from 'node:test';
import assert from 'node:assert/strict';
import { roomView } from '../src/features/room/model';
import { deviceCountryHint } from '../src/core/lobby';
import { timeZoneCountry } from '../src/core/time-zone-country';
import { nextSaveStep, servicesCountry, servicesOnLeave } from '../src/features/room/settings-save';
import { continuousFixture } from './continuous-fixture';

/** A room the host (in Germany) created; a friend from Serbia has just joined. */
function joined() {
  const s = continuousFixture();
  s.shared.phase = 'setup';
  s.shared.screens = [{ id: 'room', label: 'Our room', country: 'DE', serviceIds: [8], confirmed: true }];
  s.shared.hostParticipantId = 'host';
  s.shared.participants = [
    { participantId: 'host', nickname: 'Alp', screenId: 'room', ready: true, serviceIds: [8] },
    { participantId: 'friend', nickname: 'Mila', screenId: 'room', ready: true, serviceIds: null },
  ];
  s.own.participantId = 'friend';
  s.own.canHost = false;
  return s;
}

test('a friend who joins from Serbia starts Your services in Serbia, not the host’s Germany', () => {
  assert.equal(servicesCountry(undefined, roomView(joined()), 'RS'), 'RS');
});

test('the host still sees the room’s country, and a friend without any hint falls back to it', () => {
  const s = joined();
  assert.equal(servicesCountry(undefined, roomView(s), null), 'DE');
  s.own.participantId = 'host'; s.own.canHost = true;
  assert.equal(servicesCountry(undefined, roomView(s), 'RS'), 'DE');
});

test('a friend’s own country goes along only when a pick isn’t in the room’s catalog, and never changes the room', () => {
  const s = joined();
  const v = roomView(s);
  const germany = new Set([8, 9]);
  // Netflix (8) streams in Germany too: saved exactly as before, no country.
  assert.deepEqual(servicesOnLeave({ country: null, catalog: 'RS', picked: [8] }, v, 'RS', germany), { country: null, picked: [8] });
  const local = servicesOnLeave({ country: null, catalog: 'RS', picked: [8, 1773] }, v, 'RS', germany)!;
  assert.deepEqual(local, { country: null, picked: [8, 1773], catalog: 'RS' });
  assert.deepEqual(nextSaveStep('services', { services: local }, v, s), { type: 'services', serviceIds: [8, 1773], country: 'RS' });
  // The room's catalog not loaded yet: the country goes along to be safe.
  assert.equal(servicesOnLeave({ country: null, catalog: 'RS', picked: [8] }, v, 'RS')?.catalog, 'RS');
});

test('the device hint follows the time zone before the language, so a German-speaking phone in Belgrade says Serbia', () => {
  for (const [zone, country] of [['Europe/Belgrade', 'RS'], ['Europe/Zagreb', 'HR'], ['Europe/Sarajevo', 'BA'], ['Europe/Ljubljana', 'SI'], ['Europe/Skopje', 'MK'], ['Europe/Podgorica', 'ME'], ['Europe/Berlin', 'DE'], ['Asia/Calcutta', 'IN'], ['Atlantic/Jan_Mayen', 'SJ']]) {
    assert.equal(timeZoneCountry(zone), country, zone);
    assert.equal(deviceCountryHint(zone), country, zone);
  }
  assert.equal(timeZoneCountry('UTC'), null);
  assert.equal(timeZoneCountry('Etc/GMT+2'), null);
});
