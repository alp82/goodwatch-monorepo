const $ = id => document.getElementById(id);
let current;
const element = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
async function send(path, body = {}) {
  $('error').hidden = true;
  try {
    const response = await fetch(`/simulator/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Local action failed'); return data;
  } catch (error) { $('error').textContent = error.message; $('error').hidden = false; throw error; }
}
function render(state) {
  current = state; $('session').hidden = !state.room; $('create').disabled = state.starting || state.adding;
  $('notice').textContent = state.notice; $('phase').textContent = `Room · ${state.shared?.phase || 'none'}`;
  $('auto').textContent = state.automatic ? 'Pause automatic guests' : 'Run automatically';
  $('transport').textContent = `${state.frames} real shared frames · ${state.privacyFailures} privacy failures`;
  $('host-link').href = state.hostAppUrl || '#'; $('add').disabled = state.starting || state.adding || state.actors.filter(a => !a.host).length >= 3 || state.shared?.phase === 'decided';
  $('actors').replaceChildren();
  for (const actor of state.actors.filter(a => !a.host)) {
    const card = element('article', undefined, 'actor'); card.dataset.actorId = actor.id;
    card.append(element('h3', actor.name), element('p', `${actor.live ? 'Live' : 'Disconnected / reconnecting · still required'}${actor.paused ? ' · Paused' : ''}${actor.privateCaughtUp ? '' : ' · Refreshing own private view'}`));
    card.append(element('span', 'ARTIFICIAL PERSON’S OWN PRIVATE CARD', 'tag'), element('h3', actor.privateCard?.title || 'No unanswered retained card'));
    const ownPick = state.shared?.candidates.find(c => c.id === actor.privatePick)?.title;
    card.append(element('p', `Private answers: ${actor.privateAnswered} · Own pick: ${ownPick || 'none'} · Own simulated view: ${actor.view}`, 'muted'));
    const actions = element('div', undefined, 'actions');
    const button = (text, action, extra = {}, disabled = false) => { const b = element('button', text, 'secondary'); b.dataset.action = action; b.disabled = actor.busy || disabled; b.onclick = () => void send('action', { actorId: actor.id, action, ...extra }).catch(() => {}); actions.append(b); };
    for (const [action, label] of [['step', 'Step'], ['watch', 'Yep'], ['pass', 'Nope'], ['undo', 'Undo'], ['unpick', 'Clear own pick'], ['refill', 'Ask for more']]) button(label, action, {}, !actor.live || !!actor.pending || state.shared?.phase === 'decided');
    for (const match of state.shared?.matches || []) button(`Artificial pick: ${state.shared.candidates.find(c => c.id === match.candidateId)?.title || 'Match'}`, 'pick', { candidateId: match.candidateId }, !actor.live || !!actor.pending || state.shared.phase === 'decided');
    button(actor.paused ? 'Resume person' : 'Pause person', actor.paused ? 'resume' : 'pause');
    button(actor.live ? 'Disconnect' : 'Reconnect', actor.live ? 'disconnect' : 'reconnect');
    button('Recover / retry retained command', 'retry');
    for (const view of ['voting', 'matches', 'trailer', 'away']) button(`Simulate ${view}`, 'view', { view }, !actor.live);
    for (const gesture of ['reach', 'handle', 'release']) button(`Neutral ${gesture}`, 'gesture', { gesture }, !actor.live || actor.view === 'away');
    card.append(actions); if (actor.error) card.append(element('p', actor.error, 'actor-error')); $('actors').append(card);
  }
}
$('new-demo').onsubmit = async event => { event.preventDefault(); try {
  const result = await send('new', { count: Number($('count').value), scenario: $('scenario').value, paceMs: Number($('pace').value) });
  $('host').src = result.hostAppUrl; $('host').hidden = false; $('host-empty').hidden = true;
} catch {} };
$('auto').onclick = () => void send('controls', { automatic: !current?.automatic }).catch(() => {});
$('step').onclick = () => void send('step').catch(() => {});
$('add').onclick = () => void send('add').catch(() => {});
for (const id of ['pace', 'scenario']) $(id).onchange = () => void send('controls', { paceMs: Number($('pace').value), scenario: $('scenario').value }).catch(() => {});
const events = new EventSource('/simulator/events'); events.onmessage = event => render(JSON.parse(event.data));
events.onerror = () => { $('notice').textContent = 'Controller disconnected. No fabricated peer activity. Reopen this local page.'; };
