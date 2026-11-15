import { test, expect, type Page } from '@playwright/test';
import type { CommandEnvelope, GuestAdmissionRequest } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousFixture } from '../continuous-fixture';
import { reading, setUpDevice } from './room-fake';
const JOIN = /^(Join|Retry joining|Joining…)$/;
/** New couch on a set-up start page: the create starts by itself on the New couch screen. */
async function newCouch(page: Page) {
  await setUpDevice(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'New couch', exact: true }).click();
}
/** After a refusal the New couch screen offers Try again. */
const tryAgain = (page: Page) => page.getByRole('button', { name: 'Try again', exact: true });
/** The join form filled in; the action returned here explicitly submits it. */
async function open(page: Page, mode: 'create' | 'join', name: string) {
  if (mode === 'create') {
    await newCouch(page);
    return tryAgain(page);
  }
  if (mode === 'join') {
    await page.goto('/?open=join');
    await page.getByLabel('Couch code or invitation').fill('fixture-invite');
    await page.getByLabel('Your name').fill(name);
  }
  return page.getByRole('button', { name: JOIN });
}
async function common(page: Page) {
  const room = continuousFixture();
  room.shared.stream = { state: 'exhausted', version: 1, reason: 'catalog_end' };
  await page.route('**/api/yepwatch/v1/proposal/**', async route => {
    const url = route.request().url().split('?')[0];
    if (url.endsWith('/realtime-ticket')) return route.fulfill({status:501,json:{error:{code:'not_implemented',message:'Isolated test has no WS',retryable:false}}});
    if (url.endsWith('/guest/resolve-invite')) return route.fulfill({json:{roomId:'test-room'}});
    if (url.endsWith('/commands')) {
      const body = route.request().postDataJSON();
      if (body.command.type === 'add_idea') room.shared.ideas.push({ id: 'created-idea', text: body.command.text, authorId: room.own.participantId, on: true, attributes: reading(body.command.text) });
      room.own.nextSequence++; room.shared.revision++;
      return route.fulfill({json:{receipt:{},snapshot:room}});
    }
    if (url.endsWith('/rooms/test-room')) return route.fulfill({json:room});
    return route.fulfill({json:{countries:[{code:'DE',name:'Germany'}],services:[{id:8,name:'Netflix',logoUrl:null}],moods:[]}});
  });
  return room;
}
test('429 create keeps the same request through a reload and sends it again by itself after the server\'s wait',async({page})=>{
  const room = await common(page);
  const bodies: GuestAdmissionRequest[]=[];
  await page.route(/\/proposal\/rooms(\?|$)/,async route=>{
    bodies.push(route.request().postDataJSON());
    if (bodies.length >= 2) return route.fulfill({json:{credential:{roomId:'test-room',participantId:'host',token:'',expiresAt:room.shared.expiresAt},snapshot:room,invite:{code:'fixture-invite',path:'/r/fixture-invite'}}});
    return route.fulfill({status:429,headers:{'Retry-After':'2'},json:{error:{code:'limit_reached',message:'Please wait before retrying.',retryable:true}}});
  });
  await newCouch(page);
  await expect.poll(() => bodies.length).toBe(1); const first=structuredClone(bodies[0]);
  await page.reload();
  await expect(tryAgain(page)).toHaveCount(0);
  await page.waitForURL('**/room/test-room**', { timeout: 15_000 });
  expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(first);
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('yepwatch.v3.admission.'))).toBeNull();
});

{ const mode = 'join' as const; test(`429 ${mode} retains the same bootstrap through reload/cooldown; retries only on manual press`,async({page})=>{
  const room = await common(page);
  let admitted = false;
  await page.route(/\/proposal\/rooms\/test-room(\?|$)/, route => admitted ? route.fulfill({json:room}) : route.fulfill({status:401,json:{error:{code:'unauthorized',message:'No existing membership in this isolated guest context',retryable:false}}}));
  const bodies: GuestAdmissionRequest[]=[];
  await page.route(/\/proposal\/rooms\/test-room\/join(\?|$)/,async route=>{
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 2) { admitted = true; return route.fulfill({json:{credential:{roomId:'test-room',participantId:'host',token:'',expiresAt:room.shared.expiresAt},snapshot:room,invite:{code:'fixture-invite',path:'/r/fixture-invite'}}}); }
    return route.fulfill({status:429,headers:{'Retry-After':'2'},json:{error:{code:'limit_reached',message:'Please wait before retrying.',retryable:true}}});
  });
  const action = await open(page, mode, 'Guest');
  await action.click(); await expect(action).toBeDisabled();
  await expect(page.getByText(/Retry preserves your identity/)).toBeVisible(); await expect(action).not.toHaveText(/\d/);
  // The saved request (and its words) show before the request goes out: wait for it to have gone.
  await expect.poll(() => bodies.length).toBe(1); const first=structuredClone(bodies[0]);
  await page.reload(); await expect(action).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Change name', exact: true })).toBeVisible();
  await expect(page.getByLabel('Couch code or invitation')).toHaveValue('fixture-invite');
  await expect(action).toBeEnabled(); expect(bodies).toHaveLength(1);
  await page.waitForTimeout(150); expect(bodies).toHaveLength(1);
  await action.click(); await expect.poll(()=>bodies.length).toBe(2); expect(bodies[1]).toEqual(first);
  await page.waitForURL('**/room/test-room');
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('yepwatch.v3.admission.'))).toBeNull();
}); }

test('retryable command retains exact envelope + cooldown across reload; expiry is manual and no proposal agreement is invented',async({page})=>{
  const room=await common(page); const commands:CommandEnvelope[]=[];
  await page.route(/\/proposal\/rooms\/test-room\/commands(\?|$)/,async route=>{
    const body=route.request().postDataJSON() as CommandEnvelope;commands.push(body);
    if(commands.length===1)return route.fulfill({status:429,headers:{'Retry-After':'2'},json:{error:{code:'limit_reached',message:'Please wait.',retryable:true}}});
    room.own.nextSequence++;room.shared.revision++;
    room.own.votes=[{candidateId:'c1',value:'watch',revision:1,activeExposureMs:null,timingSource:'unavailable'}];room.own.nextCandidateId='c2';
    return route.fulfill({json:{receipt:{},snapshot:room}});
  });
  await page.goto('/room/test-room'); await page.getByRole('button',{name:'Yep',exact:true}).click();
  // The saved vote waits quietly; after 3 s one connection line offers Retry, never a countdown.
  const retry=page.getByRole('button',{name:'Retry',exact:true}); await expect(retry).toBeVisible({timeout:6000});
  await expect(page.getByText(/Try again in|Retry in|awaiting confirmation|action is saved/)).toHaveCount(0);
  const first=structuredClone(commands[0]); await page.reload();
  await expect(retry).toBeEnabled({timeout:6000}); await page.waitForTimeout(150);expect(commands).toHaveLength(1);
  await retry.click(); await expect.poll(()=>commands.length).toBe(2);expect(commands[1]).toEqual(first);
  expect(commands.every(c=>c.command.type==='vote')).toBe(true);
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeEnabled();
});

test('definitive admission failure clears bootstrap so the next Create is a new request; malformed Retry-After is bounded',async({page})=>{
  await common(page);const bodies:GuestAdmissionRequest[]=[];
  await page.route(/\/proposal\/rooms(\?|$)/,async route=>{bodies.push(route.request().postDataJSON());return route.fulfill({status:400,headers:{'Retry-After':'999999999999999'},json:{error:{code:'invalid_request',message:'Please try again.',retryable:false}}});});
  const action = await open(page, 'create', '');
  await expect(page.getByText('Please try again.',{exact:true})).toBeVisible();
  // New couch (and each Try again) sends the create with its setup, then (refused, as by an older server) the plain create
  // with the same id: two requests per press.
  expect(bodies).toHaveLength(2); expect(bodies[1].commandId).toBe(bodies[0].commandId);
  await action.click();
  await expect.poll(()=>bodies.length).toBe(4);expect(bodies[2].commandId).not.toBe(bodies[0].commandId);expect(bodies[2].nickname).toBe('Alp');
});

test('terminal HTTP status takes precedence over retryable busy and never offers a pending action',async({page})=>{
  await common(page);let commands=0;
  await page.route(/\/proposal\/rooms\/test-room\/commands(\?|$)/,async route=>{commands++;return route.fulfill({status:410,headers:{'Retry-After':'60'},json:{error:{code:'expired',message:'Expired',retryable:true}}});});
  await page.goto('/room/test-room');await page.getByRole('button',{name:'Yep',exact:true}).click();
  await expect(page.getByText('This couch has expired',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Retry',exact:true})).toHaveCount(0);expect(commands).toBe(1);
});

for (const mode of ['create', 'join'] as const) test(`${mode} must persist the exact bootstrap before every submit after repeated storage failures`, async ({page}) => {
  await common(page);
  if (mode === 'join') await page.route(/\/proposal\/rooms\/test-room(\?|$)/, route => route.fulfill({status:401,json:{error:{code:'unauthorized',message:'No existing membership',retryable:false}}}));
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    const state = { allow: false, writes: [] as string[] };
    Object.defineProperty(window, 'admissionStorageTest', {value:state});
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('yepwatch.v3.admission.')) {
        state.writes.push(value);
        if (!state.allow) throw new Error('Injected admission storage write failure');
      }
      return original.call(this,key,value);
    };
  });
  const bodies: GuestAdmissionRequest[] = [];
  await page.route(mode === 'create' ? /\/proposal\/rooms(\?|$)/ : /\/proposal\/rooms\/test-room\/join(\?|$)/, route => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({status:429,headers:{'Retry-After':'1'},json:{error:{code:'limit_reached',message:'Manual retry only',retryable:true}}});
  });
  const action = await open(page, mode, 'Persist first');
  if (mode === 'join') await action.click();
  await expect(page.getByText(mode === 'join' ? /storage is unavailable/ : /Couldn’t make the couch/)).toBeVisible();expect(bodies).toHaveLength(0);
  await expect(action).toBeEnabled();await action.click();
  if (mode === 'join') { await expect(action).toBeDisabled();await expect(action).not.toHaveText(/\d/); }
  else await expect(page.getByText(/Couldn’t make the couch/)).toBeVisible();
  expect(bodies).toHaveLength(0); // A retained in-memory request is not proof of persistence.
  const first = await page.evaluate(() => {
    const state = (window as unknown as {admissionStorageTest:{allow:boolean;writes:string[]}}).admissionStorageTest;
    state.allow=true; return JSON.parse(state.writes[0]);
  });
  await expect(action).toBeEnabled();await action.click();await expect.poll(()=>bodies.length).toBe(1);
  expect(bodies[0]).toEqual({...first.request,...(mode==='join'?{inviteCode:first.code}:{})});
  const stored=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('yepwatch.v3.admission.')!));
  expect(stored.request).toEqual(first.request); expect(stored.code).toBe(first.code);
});

test('Continue with GoodWatch sends no room request; a saved room request still retries unchanged', async ({ page }) => {
  const room = await common(page); const requests: GuestAdmissionRequest[] = []; let signIns = 0;
  await page.route(/\/proposal\/rooms(\?|$)/, async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) return route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, json: { error: { code: 'limit_reached', message: 'Wait then retry', retryable: true } } });
    return route.fulfill({ json: { credential: { roomId: 'test-room', participantId: 'host', token: '', expiresAt: room.shared.expiresAt }, snapshot: room, invite: { code: 'fixture-invite', path: '/r/fixture-invite' } } });
  });
  await page.route('**/proposal/account/start', async route => {
    signIns++;
    await route.fulfill({ status: 501, json: { error: { code: 'not_implemented', message: 'No external issuer in this test', retryable: false } } });
  });
  await setUpDevice(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with GoodWatch', exact: true }).click();
  await expect.poll(() => signIns).toBe(1);
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  // New couch: refused with a wait, then the same saved request goes again by itself.
  await page.getByRole('button', { name: 'New couch', exact: true }).first().click();
  await expect.poll(() => requests.length, { timeout: 10_000 }).toBe(2);
  expect(requests[1]).toEqual(requests[0]);
});

test('covered entrance controls are inert until the panel closes', async ({ page }) => {
  await common(page); await page.goto('/');
  // Joining is a full screen now; the profile is still a panel over the start page.
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  const body = page.getByTestId('covered-body'); await expect(body).toHaveAttribute('inert', '');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[inert]')))).toBe(false);
  }
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(body).not.toHaveAttribute('inert');
});

for (const mode of ['create', 'join'] as const) test(`Back escapes an unconfirmed ${mode} without forgetting its exact retry`, async ({ page }) => {
  // Owner rule Q16b (resend.ts): while the page is in front, an unanswered request keeps going by itself (the
  // same saved request each time), with one Reconnecting line after 3 s and no error or Try again.
  test.setTimeout(90_000);
  await common(page); const bodies: GuestAdmissionRequest[]=[];
  if(mode==='join') await page.route(/\/proposal\/rooms\/test-room(\?|$)/, route => route.fulfill({status:401,json:{error:{code:'unauthorized',message:'No existing membership',retryable:false}}}));
  await page.route(mode==='create'?/\/proposal\/rooms(\?|$)/:/\/proposal\/rooms\/test-room\/join(\?|$)/, route => { bodies.push(route.request().postDataJSON()); return route.abort('failed'); });
  const action=await open(page,mode,'Connection check');
  if (mode === 'join') { await action.click(); await expect(action).toHaveText('Joining…'); }
  await expect(page.getByText('Reconnecting…',{exact:true})).toBeVisible({ timeout: 6_000 });
  await expect.poll(()=>bodies.length,{ timeout: 20_000 }).toBeGreaterThanOrEqual(3);
  if (mode === 'join') await expect(action).toBeDisabled(); else await expect(action).toHaveCount(0);
  await expect(page.getByText('Couldn’t reach YepWatch. Your request is saved. Try again.',{exact:true})).toHaveCount(0);
  // Back stops the resends; the saved request stays.
  await page.getByRole('button',{name:'Back',exact:true}).click();
  // Create: the device set up before (New couch, the Join field). Join: a first visit (Start with you).
  await expect(page.getByRole('button',{name:mode==='create'?'New couch':'Start with you',exact:true})).toBeVisible();
  await expect(page.getByLabel('Your name')).toHaveCount(0);
  const sent = bodies.length;
  await page.waitForTimeout(6_000);
  expect(bodies).toHaveLength(sent);
  for (const body of bodies) expect(body).toEqual(bodies[0]);
  // Even the other entry action resumes the original operation, without replacing its identity: a manual press.
  if (mode === 'create') {
    await page.getByLabel('Code or invitation link').fill('fixture-invite');
    await page.getByRole('button',{name:'Join as Alp',exact:true}).click();
  } else await page.getByRole('button',{name:'Start with you',exact:true}).click();
  // Create: the New couch screen opens again and sends the saved request by itself. Join: a manual press.
  if (mode === 'join') { await expect(action).toBeEnabled(); await action.click(); }
  await expect.poll(()=>bodies.length).toBeGreaterThanOrEqual(sent + 1);expect(bodies[sent]).toEqual(bodies[0]);
});

test('Back during admission cooldown allows reopening the saved request without a new POST',async({page})=>{
  await common(page);let posts=0;
  await page.route(/\/proposal\/rooms(\?|$)/,route=>{posts++;return route.fulfill({status:429,headers:{'Retry-After':'60'},json:{error:{code:'limit_reached',message:'Wait before retrying',retryable:true}}});});
  await newCouch(page);await expect.poll(()=>posts).toBe(1);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'New couch',exact:true}).click();
  await expect(page).toHaveURL(/\/new$/);
  // The saved wait holds: no new POST, no countdown digits, no Try again while it runs.
  await page.waitForTimeout(1000);
  await expect(page.getByText(/\d+ ?s\b/)).toHaveCount(0);await expect(tryAgain(page)).toHaveCount(0);expect(posts).toBe(1);
});

test('a lost create response followed by proxy 404s keeps the saved request; its resends end in the same room', async ({ page }) => {
  // The proxy's 404 pages are no answer from the API: the saved request keeps going by itself until it lands.
  test.setTimeout(120_000);
  const room = await common(page);
  // A fake API that is idempotent per command id, like the real one: it counts rooms actually created.
  const rooms = new Map<string, string>();
  const bodies: GuestAdmissionRequest[] = [];
  await page.route(/\/proposal\/rooms(\?|$)/, async (route) => {
    const body = route.request().postDataJSON() as GuestAdmissionRequest; bodies.push(body);
    if (bodies.length >= 2 && bodies.length <= 6)
      // The server is restarting: the proxy answers its own 404 page, never reaching the API.
      return route.fulfill({ status: 404, contentType: 'text/html', body: '<html><body>404 page not found</body></html>' });
    if (!rooms.has(body.commandId)) rooms.set(body.commandId, `room-${rooms.size + 1}`);
    // The first answer is lost on the way back: the room exists, the app never hears of it.
    if (bodies.length === 1) return route.abort('failed');
    return route.fulfill({ json: { credential: { roomId: 'test-room', participantId: 'host', token: '', expiresAt: room.shared.expiresAt }, snapshot: room, invite: { code: 'fixture-invite', path: '/r/fixture-invite' } } });
  });
  await newCouch(page);
  await page.waitForURL('**/room/test-room**', { timeout: 90_000 });
  await expect(page.getByText('Couldn’t reach YepWatch. Your request is saved. Try again.', { exact: true })).toHaveCount(0);
  expect(bodies).toHaveLength(7);
  for (const body of bodies) expect(body).toEqual(bodies[0]);
  expect(rooms.size).toBe(1);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('yepwatch.v3.admission.'))).toBeNull();
});

for (const leave of ['panel', 'background'] as const) test(`automatic admission retries stop when the ${leave === 'panel' ? 'panel is dismissed' : 'app goes to the background'}, keeping the saved request`, async ({ page }) => {
  test.setTimeout(60_000);
  await common(page);
  const bodies: GuestAdmissionRequest[] = [];
  await page.route(/\/proposal\/rooms(\?|$)/, (route) => { bodies.push(route.request().postDataJSON()); return route.abort('failed'); });
  await newCouch(page);
  // The first try got no answer; the second waits its backoff (about a second): leave now.
  await expect.poll(() => bodies.length).toBe(1);
  if (leave === 'panel') {
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('button', { name: 'New couch', exact: true })).toBeVisible();
  } else {
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }
  const sent = bodies.length;
  // Longer than the next two backoff steps (2 s + 4 s with jitter): nothing more goes out, nothing navigates.
  await page.waitForTimeout(8_000);
  expect(bodies).toHaveLength(sent);
  expect(page.url()).not.toContain('/room/');
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('yepwatch.v3.admission.') ?? 'null'));
  expect(stored?.request).toEqual(bodies[0]);
  await expect(page.getByText('Couldn’t reach YepWatch. Your request is saved. Try again.', { exact: true })).toHaveCount(0);
  if (leave === 'background') {
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // Back in front, the paused save goes again by itself (resend-resume.ts), the same request.
    await expect.poll(() => bodies.length, { timeout: 10_000 }).toBeGreaterThan(sent);
    expect(bodies[sent]).toEqual(bodies[0]);
    return;
  }
  await page.getByRole('button', { name: 'New couch', exact: true }).click();
  // New couch again sends the saved request with the same identity.
  await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(sent + 1);
  expect(bodies[sent]).toEqual(bodies[0]);
});
