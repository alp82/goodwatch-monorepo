import { test, expect, type Page } from '@playwright/test';
import type { CommandEnvelope, GuestAdmissionRequest } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousFixture } from '../continuous-fixture';
const CREATE = /^(Create room|Retry room request|Retry in \d+s|Connecting…)$/;
const JOIN = /^(Join|Retry joining|Retry in \d+s|Connecting…)$/;
/** Opens Create (name) or Join (code + name) the way a first visit does. */
async function open(page: Page, mode: 'create' | 'join', name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: mode === 'create' ? 'Create a room' : 'Join a room', exact: true }).click();
  if (mode === 'join') await page.getByLabel('Room code or invitation').fill('fixture-invite');
  await page.getByLabel('Your name').fill(name);
  return page.getByRole('button', { name: mode === 'create' ? CREATE : JOIN });
}
async function common(page: Page) {
  const room = continuousFixture();
  room.shared.stream = { state: 'exhausted', version: 1, reason: 'catalog_end' };
  await page.route('**/api/yepwatch/v1/proposal/**', async route => {
    const url = route.request().url();
    if (url.endsWith('/realtime-ticket')) return route.fulfill({status:501,json:{error:{code:'not_implemented',message:'Isolated test has no WS',retryable:false}}});
    if (url.endsWith('/guest/resolve-invite')) return route.fulfill({json:{roomId:'test-room'}});
    if (url.endsWith('/rooms/test-room')) return route.fulfill({json:room});
    return route.fulfill({json:{countries:[{code:'DE',name:'Germany'}],services:[{id:8,name:'Netflix',logoUrl:null}],moods:[]}});
  });
  return room;
}
for (const mode of ['create','join'] as const) test(`429 ${mode} retains the same bootstrap through reload/cooldown; retries only on manual press`,async({page})=>{
  const room = await common(page);
  let admitted = false;
  if (mode === 'join') await page.route('**/proposal/rooms/test-room', route => admitted ? route.fulfill({json:room}) : route.fulfill({status:401,json:{error:{code:'unauthorized',message:'No existing membership in this isolated guest context',retryable:false}}}));
  const bodies: GuestAdmissionRequest[]=[];
  await page.route(mode==='create'?'**/proposal/rooms':'**/proposal/rooms/test-room/join',async route=>{
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 2) { admitted = true; return route.fulfill({json:{credential:{roomId:'test-room',participantId:'host',token:'',expiresAt:room.shared.expiresAt},snapshot:room,invite:{code:'fixture-invite',path:'/r/fixture-invite'}}}); }
    return route.fulfill({status:429,headers:{'Retry-After':'2'},json:{error:{code:'limit_reached',message:'Please wait before retrying.',retryable:true}}});
  });
  const action = await open(page, mode, 'Guest');
  await action.click(); await expect(action).toBeDisabled();
  await expect(page.getByText(/Your room request is saved/)).toBeVisible();
  expect(bodies).toHaveLength(1); const first=structuredClone(bodies[0]);
  await page.reload(); await expect(action).toBeDisabled();
  if (mode === 'create') await expect(page.getByLabel('Your name')).toHaveValue('Guest');
  else await expect(page.getByText('Joining as Guest', { exact: true })).toBeVisible();
  if(mode==='join') await expect(page.getByLabel('Room code or invitation')).toHaveValue('fixture-invite');
  await expect(action).toBeEnabled(); expect(bodies).toHaveLength(1);
  await page.waitForTimeout(150); expect(bodies).toHaveLength(1);
  await action.click(); await expect.poll(()=>bodies.length).toBe(2); expect(bodies[1]).toEqual(first);
  await page.waitForURL('**/room/test-room');
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('yepwatch.v3.admission.'))).toBeNull();
});

test('retryable command retains exact envelope + cooldown across reload; expiry is manual and no proposal agreement is invented',async({page})=>{
  const room=await common(page); const commands:CommandEnvelope[]=[];
  await page.route('**/proposal/rooms/test-room/commands',async route=>{
    const body=route.request().postDataJSON() as CommandEnvelope;commands.push(body);
    if(commands.length===1)return route.fulfill({status:429,headers:{'Retry-After':'2'},json:{error:{code:'limit_reached',message:'Please wait.',retryable:true}}});
    room.own.nextSequence++;room.shared.revision++;
    room.own.votes=[{candidateId:'c1',value:'watch',revision:1,activeExposureMs:null,timingSource:'unavailable'}];room.own.nextCandidateId='c2';
    return route.fulfill({json:{receipt:{},snapshot:room}});
  });
  await page.goto('/room/test-room'); await page.getByRole('button',{name:'Yep',exact:true}).click();
  const retry=page.getByRole('button',{name:'Retry pending action',exact:true}); await expect(retry).toBeDisabled();
  await expect(page.getByText(/Try again in .*Your action is saved/)).toBeVisible();
  const first=structuredClone(commands[0]); await page.reload(); await expect(retry).toBeDisabled();
  await expect(retry).toBeEnabled(); await page.waitForTimeout(150);expect(commands).toHaveLength(1);
  await retry.click(); await expect.poll(()=>commands.length).toBe(2);expect(commands[1]).toEqual(first);
  expect(commands.every(c=>c.command.type==='vote')).toBe(true);
  await expect(page.getByRole('button',{name:'Undo last choice',exact:true})).toBeEnabled();
});

test('definitive admission failure clears bootstrap so corrected input gets a new request; malformed Retry-After is bounded',async({page})=>{
  await common(page);const bodies:GuestAdmissionRequest[]=[];
  await page.route('**/proposal/rooms',async route=>{bodies.push(route.request().postDataJSON());return route.fulfill({status:400,headers:{'Retry-After':'999999999999999'},json:{error:{code:'invalid_request',message:'Please correct your nickname.',retryable:false}}});});
  const action = await open(page, 'create', 'First'); await action.click();
  await expect(page.getByText('Please correct your nickname.',{exact:true})).toBeVisible();
  await page.getByLabel('Your name').fill('Corrected');await action.click();
  await expect.poll(()=>bodies.length).toBe(2);expect(bodies[1].commandId).not.toBe(bodies[0].commandId);expect(bodies[1].nickname).toBe('Corrected');
});

test('terminal HTTP status takes precedence over retryable busy and never offers a pending action',async({page})=>{
  await common(page);let commands=0;
  await page.route('**/proposal/rooms/test-room/commands',async route=>{commands++;return route.fulfill({status:410,headers:{'Retry-After':'60'},json:{error:{code:'expired',message:'Expired',retryable:true}}});});
  await page.goto('/room/test-room');await page.getByRole('button',{name:'Yep',exact:true}).click();
  await expect(page.getByText('This room has expired',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Retry pending action',exact:true})).toHaveCount(0);expect(commands).toBe(1);
});

for (const mode of ['create', 'join'] as const) test(`${mode} must persist the exact bootstrap before every submit after repeated storage failures`, async ({page}) => {
  await common(page);
  if (mode === 'join') await page.route('**/proposal/rooms/test-room', route => route.fulfill({status:401,json:{error:{code:'unauthorized',message:'No existing membership',retryable:false}}}));
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
  await page.route(mode === 'create' ? '**/proposal/rooms' : '**/proposal/rooms/test-room/join', route => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({status:429,headers:{'Retry-After':'1'},json:{error:{code:'limit_reached',message:'Manual retry only',retryable:true}}});
  });
  const action = await open(page, mode, 'Persist first');
  await action.click();await expect(page.getByText(/storage is unavailable/)).toBeVisible();expect(bodies).toHaveLength(0);
  await expect(action).toBeEnabled();await action.click();await expect(action).toBeDisabled();await expect(action).toHaveText(/Retry in/);
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

test('GoodWatch sign-in intent survives admission cooldown and reload without changing the request', async ({ page }) => {
  const room = await common(page); const requests: GuestAdmissionRequest[] = []; let signIns = 0;
  await page.route('**/proposal/rooms', async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) return route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, json: { error: { code: 'limit_reached', message: 'Wait then retry', retryable: true } } });
    return route.fulfill({ json: { credential: { roomId: 'test-room', participantId: 'host', token: '', expiresAt: room.shared.expiresAt }, snapshot: room, invite: { code: 'fixture-invite', path: '/r/fixture-invite' } } });
  });
  await page.route('**/proposal/member/start', async route => {
    signIns++;
    await route.fulfill({ status: 501, json: { error: { code: 'not_implemented', message: 'No external issuer in this test', retryable: false } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with GoodWatch', exact: true }).click();
  await expect(page.getByRole('button', { name: CREATE })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: CREATE })).toBeEnabled();
  expect(requests).toHaveLength(1); expect(signIns).toBe(0);
  await page.getByRole('button', { name: CREATE }).click();
  await expect.poll(() => signIns).toBe(1);
  expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]);
});

test('covered entrance controls are inert until the panel closes', async ({ page }) => {
  await common(page); await page.goto('/');
  await page.getByRole('button', { name: 'Join a room', exact: true }).click();
  const body = page.getByTestId('covered-body'); await expect(body).toHaveAttribute('inert', '');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[inert]')))).toBe(false);
  }
  await page.getByRole('button', { name: 'Back to Start', exact: true }).click();
  await expect(body).not.toHaveAttribute('inert');
});

for (const mode of ['create', 'join'] as const) test(`Back escapes an unconfirmed ${mode} without forgetting its exact retry`, async ({ page }) => {
  await common(page); const bodies: GuestAdmissionRequest[]=[];
  if(mode==='join') await page.route('**/proposal/rooms/test-room', route => route.fulfill({status:401,json:{error:{code:'unauthorized',message:'No existing membership',retryable:false}}}));
  await page.route(mode==='create'?'**/proposal/rooms':'**/proposal/rooms/test-room/join', route => { bodies.push(route.request().postDataJSON()); return route.abort('failed'); });
  const action=await open(page,mode,'Connection check');
  await action.click();
  await expect(page.getByText('Your action has not been confirmed. Retry the same action to reconcile it.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Connection details',exact:true}).click();
  await expect(page.getByText(/web · network · request/)).toBeVisible();
  await expect(page.getByText(/No HTTP response/)).toBeVisible();
  await expect(action).toBeEnabled();
  await action.click();await expect.poll(()=>bodies.length).toBe(2);expect(bodies[1]).toEqual(bodies[0]);
  // Reload restores the pending form, but still allows Back.
  await page.reload();
  await expect(action).toBeEnabled();
  await page.getByRole('button',{name:'Back to Start',exact:true}).click();
  await expect(page.getByRole('button',{name:'Create a room',exact:true})).toBeVisible();
  await expect(page.getByLabel('Your name')).toHaveCount(0);
  expect(bodies).toHaveLength(2);
  // Even the other entry action resumes the original operation, without replacing its identity.
  await page.getByRole('button',{name:mode==='create'?'Join a room':'Create a room',exact:true}).click();
  await expect(action).toBeEnabled();await action.click();
  await expect.poll(()=>bodies.length).toBe(3);expect(bodies[2]).toEqual(bodies[0]);
});

test('Back during admission cooldown allows reopening the saved request without a new POST',async({page})=>{
  await common(page);let posts=0;
  await page.route('**/proposal/rooms',route=>{posts++;return route.fulfill({status:429,headers:{'Retry-After':'60'},json:{error:{code:'limit_reached',message:'Wait before retrying',retryable:true}}});});
  const action=await open(page,'create','Connection check');await action.click();await expect(action).toBeDisabled();
  await page.getByRole('button',{name:'Back to Start',exact:true}).click();
  await page.getByRole('button',{name:'Create a room',exact:true}).click();
  await expect(action).toBeDisabled();await expect(action).toHaveText(/Retry in/);expect(posts).toBe(1);
});
