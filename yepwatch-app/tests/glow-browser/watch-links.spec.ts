import { expect,test } from '@playwright/test';
import { continuousFixture } from '../continuous-fixture';

for (const [width,height] of [[320,568],[375,667],[390,844],[844,390],[1440,900]]) {
 test(`Tonight watch button fits ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height});const room=continuousFixture();const writes:string[]=[];
  room.shared.phase='decided';room.shared.screens[0].serviceIds=[8,9,337,350];
  room.shared.candidates[0].title='Person of Interest';room.shared.candidates[0].year=2011;
  room.shared.candidates[0].identity={kind:'show_start',tmdbId:1411,episode:{tmdbId:1,season:1,number:1}};
  room.shared.decision={candidateId:'c1',proposalVersion:1,decidedAt:Date.now(),availability:[{screenId:'tv',state:'watchable',scope:'title',checkedAt:Date.now(),offers:[
   {serviceId:8,name:'Netflix',url:'https://www.netflix.com/title/70197057',kind:'provider',offerType:'flatrate'},
   {serviceId:9,name:'Prime Video',url:'https://www.primevideo.com/detail/example',kind:'provider',offerType:'flatrate'},
   {serviceId:337,name:'Disney+',url:'https://www.themoviedb.org/tv/1411/watch?locale=DE',kind:'where_to_watch',offerType:'flatrate'},
   {serviceId:350,name:'Apple TV',url:'https://tv.apple.com/example',kind:'provider',offerType:'flatrate'},
   {serviceId:99,name:'Unselected service',url:'https://example.com',kind:'provider',offerType:'flatrate'}]}]};
  await page.route('**/api/yepwatch/v1/proposal/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path.endsWith('/catalog/metadata'))return route.fulfill({json:{countries:[{code:'DE',name:'Germany'}],moods:[],services:[{id:8,name:'Netflix',logoUrl:'https://image.tmdb.org/t/p/w92/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg'}]}});
   if(path.endsWith('/realtime-ticket'))return route.fulfill({status:501,json:{error:{code:'not_implemented',message:'Fixture',retryable:false}}});
   if(path.endsWith('/commands'))writes.push(route.request().postData()!);
   return route.fulfill({json:room});
  });
  await page.goto('/room/test-room');
  // One watch button: the first switched-on service that has the title.
  const netflix=page.getByRole('link',{name:'Watch on Netflix'});
  await expect(netflix).toHaveAttribute('href','https://www.netflix.com/title/70197057');await netflix.click({trial:true});
  await expect(page.getByRole('link',{name:/^(Watch on|Find on) (Prime Video|Apple TV|Disney\+|Unselected service)/})).toHaveCount(0);
  await page.getByRole('button',{name:'Start again',exact:true}).click({trial:true});
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await page.screenshot({path:`.expo/tonight-links-${width}.png`});
  if (width === 390) {
   await page.context().route('https://www.netflix.com/**', route => route.fulfill({body:'Provider destination'}));
   const providerOpened=page.waitForEvent('popup');await netflix.click();const provider=await providerOpened;
   await expect(provider).toHaveURL('https://www.netflix.com/title/70197057');await provider.close();
   await expect(page.getByTestId('tonight')).toBeVisible();
  }
  expect(writes).toEqual([]);
 });
}
