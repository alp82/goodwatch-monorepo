import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roomWatchLinks, goodwatchTitleUrl } from '../src/features/glow/watch-links';
import { continuousFixture } from './continuous-fixture';

test('watch links require checked room-selected offers, preserve destinations and prefer direct family links', () => {
 const screens = continuousFixture().shared.screens;
 screens[0].serviceIds = [119];
 const offer = { serviceId: 9, name: 'Amazon', url: 'https://example.com/watch', kind: 'where_to_watch' as const, offerType: 'flatrate' as const };
 const metadata = { countries: [], moods: [], services: [], providerGroups: [{ id:9,name:'Prime Video',logoUrl:'https://example.com/logo.png',selectionIds:[9,10,119] }] };
 const availability = [{ screenId:'tv',state:'watchable' as const,scope:'title' as const,checkedAt:1,offers:[offer,{...offer,serviceId:119,kind:'provider' as const,url:'https://primevideo.com/detail/title'}, {...offer,serviceId:8}, {...offer,serviceId:20,url:'javascript:alert(1)'}] }];
 const links = roomWatchLinks(availability,screens,metadata);
 assert.equal(links.length,1);assert.equal(links[0].url,'https://primevideo.com/detail/title');assert.equal(links[0].logoUrl,'https://example.com/logo.png');assert.equal(links[0].name,'Prime Video');
 assert.deepEqual(roomWatchLinks([{...availability[0],state:'unknown'}],screens,metadata),[]);
 assert.deepEqual(roomWatchLinks([{...availability[0],screenId:'other'}],screens,metadata),[]);
});
test('fallback links stay honest and GoodWatch details use the title identity, not episode id', () => {
 const screens=continuousFixture().shared.screens;
 const links=roomWatchLinks([{screenId:'tv',state:'watchable',scope:'title',checkedAt:1,offers:[{serviceId:8,name:'Netflix',url:'https://www.themoviedb.org/tv/1411/watch?locale=DE',kind:'where_to_watch',offerType:'flatrate'}]}],screens);
 assert.equal(links[0].action,'Find on');assert.equal(links[0].note,'Availability page');
 assert.equal(goodwatchTitleUrl({kind:'show_start',tmdbId:1411,episode:{tmdbId:123,season:1,number:1}}),'https://goodwatch.app/show/1411');
});
