'use strict';
const el=id => document.getElementById(id);
let tabId=null, current=null, timer=null, starting=false;
async function command(action) {
  const [frame]=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},world:'MAIN',func:a => globalThis.GWS5Command?.(a) || {state:'idle'},args:[action]});
  return frame.result;
}
function render() {
  const busy=starting || current?.state==='collecting';
  el('start').hidden=busy || tabId===null;
  el('stop').hidden=el('cancel').hidden=!busy;
  el('state').textContent=starting ? 'Checking this page…' : busy ? `Reading My List (${current?.s5IssuedCalls || 0} S5-issued calls)…` : current?.report?.cleanupResult==='failed' ? 'Ended with a cleanup failure. Review the fixed code and remove the experiment.' : current?.report ? 'Finished. Private evidence released; counts and codes only.' : 'Open your own Netflix My List profile and start once.';
  el('report').hidden=el('copy').hidden=!current?.report;
  if(current?.report) el('report').textContent=JSON.stringify(current.report,null,2);
}
async function poll() {
  try {current=await command('status');} catch {current={state:'unavailable'};}
  render();
  if(current.state!=='collecting' && timer) {clearInterval(timer);timer=null;}
}
function watch() {if(!timer)timer=setInterval(poll,400);}
el('start').onclick=async () => {
  starting=true;render();
  try {
    await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},world:'MAIN',files:['adapter-config.js','provenance.js','adapter.js','runtime.js']});
    current=await command('start');
  } catch {current={state:'unavailable'};}
  starting=false;render();if(current.state==='collecting')watch();
};
for(const action of ['stop','cancel']) el(action).onclick=async () => {try{current=await command(action);}catch{current={state:'unavailable'};}render();};
el('copy').onclick=() => navigator.clipboard.writeText(JSON.stringify(current.report,null,2)).catch(()=>{});
window.addEventListener('unload',()=>clearInterval(timer));
(async () => {
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(tab?.id && /^https:\/\/www\.netflix\.com\/browse\/my-list\/?$/.test(tab.url || ''))tabId=tab.id;
    if(tabId!==null) {await poll();if(current.state==='collecting')watch();}
  } catch {tabId=null;}
  render();
})();
