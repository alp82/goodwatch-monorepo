const $ = id => document.getElementById(id);
let current;
let hostOpened = '';
async function send(path, body) {
  $('error').hidden = true;
  try {
    const response = await fetch(`/simulator/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Local simulator request failed');
    return data;
  } catch (error) { $('error').textContent = error.message; $('error').hidden = false; throw error; }
}
function host(url) {
  if (!url) return;
  const value = new URL(url);
  if (value.hostname !== '127.0.0.1' || value.protocol !== 'http:') return;
  $('host').src = value.href; $('host').hidden = false; $('host-empty').hidden = true;
  $('host-link').href = value.href; hostOpened = value.href;
}
function node(tag, text, className) { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; }
function render(state) {
  current = state;
  $('create').disabled = state.starting;
  $('notice').textContent = state.notice;
  $('session').hidden = !state.room;
  $('phase').textContent = `Room · ${state.phase}`;
  $('transport').textContent = `${state.sharedFrames} real shared frames · ${state.privacyFailures} privacy failures`;
  $('auto').textContent = state.automatic ? 'Pause automatic guests' : 'Run automatically';
  $('mode').textContent = state.automatic ? 'Artificial actions run at the selected pace. Host choices stay manual in the real app.' : 'Automatic actions paused. Use one step, a private vote or explicit consent below.';
  $('host-link').href = state.hostAppUrl || '#';
  if (state.room && document.activeElement !== $('scenario')) $('scenario').value = state.scenario;
  if (state.room && document.activeElement !== $('pace')) $('pace').value = String(state.paceMs);
  const container = $('actors'); container.replaceChildren();
  for (const actor of state.actors.filter(a => !a.host)) {
    const card = node('article', undefined, 'actor'); card.dataset.actorId = actor.id;
    const heading = node('div', undefined, 'actor-head'); heading.append(node('h3', actor.name), node('span', actor.status + (actor.paused ? ' · Paused' : ''), actor.connected ? 'status' : 'status offline')); card.append(heading);
    const privateCard = node('div', undefined, 'private-card'); privateCard.append(node('span', 'ARTIFICIAL PERSON’S OWN PRIVATE CARD'), node('strong', actor.privateCard?.title || (actor.privateFinished ? 'Finished · waiting for everyone' : 'No active card')), node('div', actor.privateCard?.kind?.replace('_', ' ') || '')); card.append(privateCard);
    const choices = node('p', `Private controls: ${actor.privateAnswered} answers · Finished: ${actor.privateFinished ? 'yes' : 'no'} · Own consent: ${actor.privateConsent === null ? 'not sent' : actor.privateConsent ? 'accept' : 'decline'}`, 'muted'); card.append(choices);
    const actions = node('div', undefined, 'actions');
    const buttons = [['step', 'Step'], ['watch', 'Watch'], ['pass', 'No'], ['undo', 'Undo last'], ['finish', 'Finish'], ['accept', 'Accept proposal'], ['decline', 'Decline proposal'], [actor.paused ? 'resume' : 'pause', actor.paused ? 'Resume person' : 'Pause person'], [actor.connected ? 'disconnect' : 'reconnect', actor.connected ? 'Disconnect' : 'Reconnect'], ['retry', 'Recover / retry']];
    for (const [action, title] of buttons) {
      const button = node('button', title, action === 'decline' || action === 'disconnect' ? 'danger' : 'secondary');
      button.dataset.action = action;
      let allowed = true;
      if (['watch', 'pass'].includes(action)) allowed = state.phase === 'voting' && !!actor.privateCard && !actor.privateFinished && !actor.needsRecovery;
      if (action === 'finish') allowed = state.phase === 'voting' && !actor.privateCard && actor.privateAnswered > 0 && !actor.privateFinished && !actor.needsRecovery;
      if (action === 'undo') allowed = state.phase === 'voting' && actor.privateAnswered > 0 && !actor.privateFinished && !actor.needsRecovery;
      if (['accept', 'decline'].includes(action)) allowed = state.phase === 'shortlist' && !!state.shared?.shortlist?.proposedCandidateId && !actor.needsRecovery;
      if (action === 'step') allowed = !actor.needsRecovery && state.phase !== 'decided' && !(state.phase === 'voting' && actor.privateFinished);
      if (action === 'retry') allowed = actor.needsRecovery || !!actor.error;
      button.disabled = !allowed || actor.busy || (!actor.connected && !['reconnect', 'pause', 'resume'].includes(action));
      button.onclick = () => { void send('action', { actorId: actor.id, action }).catch(() => {}); };
      actions.append(button);
    }
    card.append(actions, node('p', actor.lastAction, 'last'));
    if (actor.error) card.append(node('div', actor.error, 'actor-error'));
    container.append(card);
  }
}
$('new-demo').onsubmit = async event => {
  event.preventDefault(); $('create').disabled = true;
  try {
    const result = await send('new', { count: Number($('count').value), scenario: $('scenario').value, paceMs: Number($('pace').value) });
    host(result.hostAppUrl);
  } catch {} finally { $('create').disabled = false; }
};
$('auto').onclick = () => { void send('controls', { automatic: !current?.automatic }).catch(() => {}); };
$('step').onclick = () => { void send('step', {}).catch(() => {}); };
$('open-host').onclick = () => host(current?.hostAppUrl || hostOpened);
for (const id of ['scenario', 'pace']) $(id).onchange = () => { if (current?.room) void send('controls', { scenario: $('scenario').value, paceMs: Number($('pace').value) }).catch(() => {}); };
const events = new EventSource('/simulator/events');
events.onmessage = message => render(JSON.parse(message.data));
events.onerror = () => { $('notice').textContent = 'Controller connection interrupted. No fake activity is generated; reopen this local page to reconnect.'; };
