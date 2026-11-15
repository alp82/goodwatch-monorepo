import {expect,test} from '@playwright/test';
import {nativeIntroHtml} from '../../src/features/home/native-intro-html';
// The app mounts this page only when motion isn't reduced.
test.use({reducedMotion:'no-preference'});
test('bundled native intro loops locally, tells the app painted, pauses on touch and in background',async({page})=>{
  const requests:string[]=[];page.on('request',req=>requests.push(req.url()));
  await page.addInitScript(()=>{(window as any).said=[];(window as any).ReactNativeWebView={postMessage:(m:string)=>(window as any).said.push(m)};});
  await page.route('http://intro.test/',route=>route.fulfill({contentType:'text/html',body:nativeIntroHtml}));
  await page.goto('http://intro.test/');
  const film=page.locator('.mini-film');
  await expect(film).toHaveClass(/mini-paused/);
  await expect.poll(()=>page.evaluate(()=>(window as any).said)).toEqual(['painted']);
  // The first play starts on the first frame the app drew (no fade in); later plays fade in and out.
  await expect(film).toHaveCSS('animation-name','native-clock-first, mini-clock');
  await expect(film).toHaveCSS('opacity','1');
  await expect(page.locator('.mini-tv')).toHaveCSS('animation-iteration-count','infinite');
  await expect(page.locator('.mini-yep').first()).toHaveCSS('animation-iteration-count','infinite');
  await page.evaluate(()=>(window as any).yepIntroState({blocked:false}));
  await expect(page.locator('.mini-tv')).toHaveCSS('animation-play-state','running');
  await page.locator('.mini-intro').dispatchEvent('pointerdown',{pointerType:'touch'});
  await page.getByRole('button',{name:'Pause intro'}).click();
  await expect(page.locator('.mini-tv')).toHaveCSS('animation-play-state','paused');
  await page.getByRole('button',{name:'Play intro'}).click();
  await page.evaluate(()=>(window as any).yepIntroState({blocked:true}));
  await expect(page.locator('.mini-tv')).toHaveCSS('animation-play-state','paused');
  // Past the end of its first play it plays again from the start: nothing holds the last frame.
  await page.evaluate(()=>(window as any).yepIntroState({blocked:false}));
  await page.evaluate(()=>document.getAnimations().forEach(a=>{a.currentTime=18000+9000;}));
  await expect(film).toHaveCSS('opacity','1');
  expect(await page.evaluate(()=>document.querySelector('.mini-film')!.getAnimations({subtree:true}).filter(a=>a.playState!=='running').length)).toBe(1);
  await page.evaluate(()=>document.getAnimations().forEach(a=>{a.currentTime=18000*3+200;}));
  // Early in a later play the film is fading in again, its first caption on its way.
  expect(Number(await film.evaluate(el=>getComputedStyle(el).opacity))).toBeLessThan(1);
  expect(await page.evaluate(()=>(window as any).said)).toEqual(['painted']);
  expect(requests).toEqual(['http://intro.test/']);
});
