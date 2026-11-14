import {expect,test} from '@playwright/test';
import {nativeIntroHtml} from '../../src/features/home/native-intro-html';
// The app mounts this page only when motion isn't reduced.
test.use({reducedMotion:'no-preference'});
test('bundled native intro plays once locally, tells the app painted/ended, pauses on touch and in background',async({page})=>{
  const requests:string[]=[];page.on('request',req=>requests.push(req.url()));
  await page.addInitScript(()=>{(window as any).said=[];(window as any).ReactNativeWebView={postMessage:(m:string)=>(window as any).said.push(m)};});
  await page.route('http://intro.test/',route=>route.fulfill({contentType:'text/html',body:nativeIntroHtml}));
  await page.goto('http://intro.test/');
  const film=page.locator('.mini-film');
  await expect(film).toHaveClass(/mini-paused/);
  await expect.poll(()=>page.evaluate(()=>(window as any).said)).toEqual(['painted']);
  // No fade in or out of the whole film, and every part plays exactly once.
  await expect(film).toHaveCSS('animation-name','none');
  await expect(page.locator('.mini-tv')).toHaveCSS('animation-iteration-count','1');
  await expect(page.locator('.mini-yep').first()).toHaveCSS('animation-iteration-count','1');
  await page.evaluate(()=>(window as any).yepIntroState({blocked:false}));
  await expect(page.locator('.mini-tv')).toHaveCSS('animation-play-state','running');
  await page.locator('.mini-intro').dispatchEvent('pointerdown',{pointerType:'touch'});
  await page.getByRole('button',{name:'Pause intro'}).click();
  await expect(page.locator('.mini-tv')).toHaveCSS('animation-play-state','paused');
  await page.getByRole('button',{name:'Play intro'}).click();
  await page.evaluate(()=>(window as any).yepIntroState({blocked:true}));
  await expect(page.locator('.mini-tv')).toHaveCSS('animation-play-state','paused');
  expect(await page.evaluate(()=>(window as any).said)).toEqual(['painted']);
  // Played to its end, it says so once and rests on its last keyframes.
  await page.evaluate(()=>document.getAnimations().forEach(a=>a.finish()));
  await expect.poll(()=>page.evaluate(()=>(window as any).said)).toEqual(['painted','ended']);
  await expect(page.locator('.mini-tv')).toHaveCSS('opacity','1');
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  expect(requests).toEqual(['http://intro.test/']);
});
