const $ = id => document.getElementById(id);
let current;
const element = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
async function send(path, body = {}) {
  $('error').hidden = true;
  try {
    const r = await fetch(`/simulator/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Local action failed'); return data;
  } catch (e) { $('error').textContent = e.message; $('error').hidden = false; throw e; }
}
function render(state) {
  current = state; $('session').hidden = !state.room; $('create').disabled = state.starting || state.adding;
  $('notice').textContent = state.notice; $('phase').textContent = `Room · ${state.phase || 'none'}`;
  $('invite').value = state.inviteCode || ''; $('join-link').href = state.joinUrl || '#';
  $('auto').textContent = state.automatic ? 'Pause automatic peers' : 'Run automatically';
  $('transport').textContent = `${state.frames} real shared frames · ${state.privacyFailures} privacy failures · ${state.people || 0} required people`;
  $('start').disabled = state.starting || state.adding || state.phase !== 'setup';
  $('add').disabled = state.starting || state.adding || state.actors.length >= 3 || state.phase === 'decided';
  $('summary').textContent = state.proposal ? `Confirmed proposal: ${state.proposal.title} · version ${state.proposal.version} · ${state.proposal.agreeCount} anonymous agreements` : 'No confirmed shared proposal';
  $('matches').replaceChildren();
  for (const match of state.matches || []) $('matches').append(element('p', `${match.title} · Quickest: ${match.averageYepMs == null ? 'timing unavailable' : `${Math.round(match.averageYepMs)} ms complete-roster average`}`));
  $('actors').replaceChildren();
  for (const actor of state.actors) {
    const card = element('article', undefined, 'actor'); card.dataset.actorId = actor.id;
    card.append(element('h3', `${actor.name}${actor.host ? ' · HOST' : ''}`), element('p', `${actor.live ? 'Live' : 'Disconnected · still required'}${actor.paused ? ' · Paused' : ''}${actor.privateCaughtUp ? '' : ' · Repairing private view'}`));
    card.append(element('span', 'ARTIFICIAL PERSON · PRIVATE OPERATOR DIAGNOSTICS', 'tag'), element('h3', actor.privateCard?.title || 'No unanswered retained card'));
    card.append(element('p', `Own agreement: ${actor.privateAgreement || 'none'} · Simulated view: ${actor.view}`, 'muted'));
    const actions = element('div', undefined, 'actions');
    const button = (label, action, extra = {}, disabled = false) => { const b = element('button', label, 'secondary'); b.dataset.action = action; b.disabled = actor.busy || disabled; b.onclick = () => void send('action', { actorId: actor.id, action, ...extra }).catch(() => {}); actions.append(b); };
    const inactive = !actor.live || actor.pending || state.phase === 'decided';
    for (const [action, label] of [['step', 'Step'], ['watch', 'Yep'], ['pass', 'Nope'], ['undo', 'Undo'], ['agree', 'Agree to confirmed proposal'], ['withdraw', 'Withdraw own agreement'], ['refill', 'Ask for more']]) button(label, action, {}, inactive);
    for (const match of state.matches || []) {
      button(`Propose / replace: ${match.title}`, 'propose', { candidateId: match.candidateId }, inactive);
      button(`Inspect shared poster: ${match.title}`, 'inspect', { inspection: { kind: 'poster', candidateId: match.candidateId } }, inactive);
    }
    for (const kind of ['lens', 'dice']) button(`Actual simulated ${kind} interaction`, 'inspect', { inspection: { kind } }, inactive);
    button(actor.paused ? 'Resume person' : 'Pause person', actor.paused ? 'resume' : 'pause');
    button(actor.live ? 'Disconnect' : 'Reconnect', actor.live ? 'disconnect' : 'reconnect'); button('Recover exact pending command', 'retry');
    for (const view of ['voting', 'matches', 'trailer', 'away']) button(`Simulate ${view}`, 'view', { view }, !actor.live);
    for (const gesture of ['reach', 'handle', 'release']) button(`Neutral ${gesture}`, 'gesture', { gesture }, !actor.live || actor.view === 'away');
    card.append(actions); if (actor.error) card.append(element('p', actor.error, 'actor-error')); $('actors').append(card);
  }
}
$('new-demo').onsubmit = async e => { e.preventDefault(); try { await send('new', { count: Number($('count').value), scenario: $('scenario').value, paceMs: Number($('pace').value) }); } catch {} };
$('start').onclick = () => void send('start').catch(() => {});
$('auto').onclick = () => void send('controls', { automatic: !current?.automatic }).catch(() => {});
$('step').onclick = () => void send('step').catch(() => {}); $('add').onclick = () => void send('add').catch(() => {});
for (const id of ['pace', 'scenario']) $(id).onchange = () => void send('controls', { paceMs: Number($('pace').value), scenario: $('scenario').value }).catch(() => {});
const events = new EventSource('/simulator/events'); events.onmessage = e => render(JSON.parse(e.data));
events.onerror = () => { $('notice').textContent = 'Controller disconnected. No invented peer actions. Reopen this local page.'; };
