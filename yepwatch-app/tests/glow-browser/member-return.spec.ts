import { test, expect } from '@playwright/test';
import { continuousFixture } from '../continuous-fixture';

/** OAuth itself is represented by a full-page round trip; room reads remain authoritative. */
test('GoodWatch return restores the member name and account state without replaying boot', async ({ page }) => {
  const room = continuousFixture(); room.shared.phase = 'setup';
  room.shared.participants[0].nickname = 'Guest';
  let admissions = 0; let links = 0;
  await page.addInitScript(() => {
    (window as unknown as {bootSeen:boolean}).bootSeen = false;
    new MutationObserver(() => { if(document.querySelector('[data-testid="yepwatch-boot"]')) (window as unknown as {bootSeen:boolean}).bootSeen = true; }).observe(document, {childList:true,subtree:true});
  });
  await page.route('**/api/yepwatch/v1/proposal/**', async route => {
    const p = new URL(route.request().url()).pathname;
    if(p.endsWith('/member/start')) { links++;return route.fulfill({json:{authorizeUrl:'http://127.0.0.1:8097/member-test-return',state:'test-state',expiresAt:Date.now()+600000}}); }
    if(p.endsWith('/realtime-ticket'))return route.fulfill({status:501,json:{error:{code:'not_implemented',message:'Isolated browser test',retryable:false}}});
    if(p.endsWith('/rooms') && route.request().method()==='POST') { admissions++;return route.fulfill({json:{credential:{roomId:'test-room',participantId:'host',token:'',expiresAt:room.shared.expiresAt},snapshot:room,invite:{code:'ABC234',path:'/r/ABC234'}}}); }
    if(p.endsWith('/rooms/test-room'))return route.fulfill({json:room});
    return route.fulfill({json:{countries:[{code:'DE',name:'Germany'}],services:[{id:8,name:'Netflix',logoUrl:null}],moods:[]}});
  });
  await page.route('**/member-test-return',async route=>{
    room.shared.participants[0].nickname='Alex';room.own.member={state:'linked',prefill:{country:'DE',serviceIds:[8],savedProgressAvailable:true}};room.shared.revision++;
    await route.fulfill({contentType:'text/html',body:'<!doctype html><script>sessionStorage.setItem("test-linked","1");location.replace("/room/test-room")</script>'});
  });
  await page.goto('/');await page.getByRole('button',{name:'Continue with GoodWatch',exact:true}).click();
  await expect.poll(()=>links).toBe(1);await page.waitForURL('**/room/test-room');
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('test-linked'))).toBe('1');
  await expect(page.getByRole('button',{name:'Back to Your rooms'})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {bootSeen:boolean}).bootSeen)).toBe(false);
  await page.getByRole('button',{name:'Back to Your rooms'}).click();
  await expect(page.getByText(/, Alex$/)).toBeVisible();
  await page.getByRole('button',{name:'Profile'}).click();
  await expect(page.getByText('Signed in with GoodWatch',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Continue with GoodWatch',exact:true})).toHaveCount(0);
  expect(admissions).toBe(1);
});

test('an interrupted sign-in remains reachable from Profile and retries in the existing room', async ({ page }) => {
  const room=continuousFixture();room.shared.phase='setup';room.shared.participants[0].nickname='Guest';let links=0;let admissions=0;
  await page.route('**/api/yepwatch/v1/proposal/**',async route=>{
    const p=new URL(route.request().url()).pathname;
    if(p.endsWith('/member/start')){links++;return route.fulfill({status:503,json:{error:{code:'busy',message:'GoodWatch is temporarily unavailable',retryable:true}}});}
    if(p.endsWith('/realtime-ticket'))return route.fulfill({status:501,json:{error:{code:'not_implemented',message:'Isolated browser test',retryable:false}}});
    if(p.endsWith('/rooms')&&route.request().method()==='POST'){admissions++;return route.fulfill({status:500,json:{error:{code:'busy',message:'Must reuse the existing room',retryable:true}}});}
    if(p.endsWith('/rooms/test-room'))return route.fulfill({json:room});
    return route.fulfill({json:{countries:[{code:'DE',name:'Germany'}],services:[{id:8,name:'Netflix',logoUrl:null}],moods:[]}});
  });
  await page.goto('/room/test-room');
  await page.getByRole('button',{name:'Back to Your rooms'}).click();
  for(let attempt=1;attempt<=2;attempt++){
    await page.getByRole('button',{name:'Profile',exact:true}).click();
    await expect(page.getByText('Signed in with GoodWatch',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Continue with GoodWatch',exact:true}).click();
    await expect.poll(()=>links).toBe(attempt);
    await expect(page.getByText('GoodWatch is temporarily unavailable',{exact:true})).toBeVisible();
    expect(new URL(page.url()).searchParams.has('signin')).toBe(false);
    await page.getByRole('button',{name:'Back to Your rooms'}).click();
  }
  expect(admissions).toBe(0);
});
