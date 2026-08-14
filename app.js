const STORAGE_KEY = 'any-game-pointer-state';
const app = document.querySelector('#app');
const keypad = document.querySelector('#keypad');
const keypadValue = document.querySelector('#keypad-value');

const blankState = () => ({ players: [], game: null });
let state = loadState();
let selectedIds = [];
let keypadTarget = null;
let keypadDraft = '';

function loadState() {
  try { return { ...blankState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }; }
  catch { return blankState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function orderedPlayers() { return [...state.players].sort((a, b) => b.lastUsed - a.lastUsed || b.createdAt - a.createdAt); }
function showSelection() {
  const players = orderedPlayers();
  app.innerHTML = `<section class="screen selection-screen">
    <header class="screen-header"><div><h1>Wybierz graczy</h1><p class="subtitle">Zaznacz osoby biorące udział w grze.</p></div></header>
    <div class="card">
      <form class="add-player" data-action="add-player"><input name="name" type="text" autocomplete="off" placeholder="Imię gracza" aria-label="Imię gracza"><button class="add-button" type="submit">Dodaj</button></form>
      <div class="player-list">${players.length ? players.map(player => `<button class="player-choice ${selectedIds.includes(player.id) ? 'selected' : ''}" data-action="toggle-player" data-id="${player.id}"><span>${escapeHtml(player.name)}</span><span class="check">${selectedIds.includes(player.id) ? '✓' : ''}</span></button>`).join('') : '<p class="empty">Dodaj pierwszego gracza.</p>'}</div>
      <div class="bottom-actions"><button class="primary" data-action="start-game" ${selectedIds.length ? '' : 'disabled'}>Rozpocznij grę</button></div>
    </div>
  </section>`;
}
function scoreFor(round, id) {
  const value = Number(round.scores?.[id] ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
function showGame() {
  const players = state.game.playerIds.map(id => state.players.find(player => player.id === id)).filter(Boolean);
  const totals = Object.fromEntries(players.map(player => [player.id, state.game.rounds.reduce((sum, round) => sum + scoreFor(round, player.id), 0)]));
  const selected = state.game.selectedRound;
  app.innerHTML = `<section class="screen game-screen">
    <div class="table-wrap"><table class="score-table" style="--player-count: ${players.length}"><thead><tr><th>#</th>${players.map(player => `<th><span class="player-name">${escapeHtml(player.name)}</span><strong class="total">${totals[player.id]}</strong></th>`).join('')}</tr></thead><tbody>
      ${state.game.rounds.map((round, index) => `<tr class="round-row ${selected === index ? 'selected' : ''}"><td rowspan="${selected === index ? 2 : 1}"><div class="round-number"><button data-action="select-round" data-round="${index}">${index + 1}</button>${index === state.game.rounds.length - 1 ? '<button data-action="add-round" aria-label="Dodaj rundę">+</button>' : ''}</div></td>${players.map(player => `<td data-action="open-keypad" data-player="${player.id}" aria-label="Zmień wynik gracza ${escapeHtml(player.name)} w rundzie ${index + 1}"><span class="round-score">${scoreFor(round, player.id)}</span></td>`).join('')}</tr>${selected === index ? `<tr class="controls-row">${players.map(player => `<td><div class="score-buttons">${[1,2,3,4,5,6,7].map(value => `<button data-action="set-score" data-player="${player.id}" data-score="${value}">${value}</button>`).join('')}</div></td>`).join('')}</tr>` : ''}`).join('')}
    </tbody></table></div>
    <div class="bottom-actions game-actions"><button class="secondary" data-action="new-game">Nowa gra</button></div>
  </section>`;
}
function render() { state.game ? showGame() : showSelection(); }
function newGame() { state.game = { playerIds: [...selectedIds], selectedRound: 0, rounds: [{ scores: Object.fromEntries(selectedIds.map(id => [id, 0])) }] }; saveState(); render(); }
function updateScore(playerId, score) {
  const round = state.game.rounds[state.game.selectedRound];
  round.scores[playerId] = Number(score);
  const player = state.players.find(item => item.id === playerId);
  if (player) player.lastUsed = Date.now();
  saveState();
  render();
}
app.addEventListener('click', event => {
  const target = event.target.closest('[data-action]'); if (!target) return;
  const action = target.dataset.action;
  if (action === 'toggle-player') { const id = target.dataset.id; selectedIds = selectedIds.includes(id) ? selectedIds.filter(item => item !== id) : [...selectedIds, id]; render(); }
  if (action === 'start-game') newGame();
  if (action === 'select-round') { state.game.selectedRound = Number(target.dataset.round); saveState(); render(); }
  if (action === 'add-round') { state.game.rounds.push({ scores: Object.fromEntries(state.game.playerIds.map(id => [id, 0])) }); state.game.selectedRound = state.game.rounds.length - 1; saveState(); render(); }
  if (action === 'set-score') updateScore(target.dataset.player, target.dataset.score);
  if (action === 'new-game' && confirm('Rozpocząć nową grę? Aktualne wyniki zostaną zastąpione.')) { state.game = null; selectedIds = []; saveState(); render(); }
  if (action === 'open-keypad') openKeypad(target.dataset.player);
  if (action === 'close-keypad') closeKeypad();
});
app.addEventListener('submit', event => { if (!event.target.matches('[data-action="add-player"]')) return; event.preventDefault(); const input = event.target.elements.name; const name = input.value.trim(); if (!name) return; const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; state.players.push({ id, name, lastUsed: 0, createdAt: Date.now() }); selectedIds.push(id); saveState(); render(); });
keypad.addEventListener('click', event => { if (event.target === keypad) return closeKeypad(); if (event.target.closest('[data-action="close-keypad"]')) return closeKeypad(); const key = event.target.closest('[data-key]')?.dataset.key; if (!key) return; if (key === 'backspace') keypadDraft = keypadDraft.slice(0, -1); else if (key === 'ok') { updateScore(keypadTarget, keypadDraft === '' ? 0 : Number(keypadDraft)); return closeKeypad(); } else keypadDraft += key; keypadValue.textContent = keypadDraft || '0'; });
function openKeypad(playerId) { keypadTarget = playerId; keypadDraft = ''; keypadValue.textContent = '0'; keypad.hidden = false; }
function closeKeypad() { keypad.hidden = true; keypadTarget = null; keypadDraft = ''; }
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
render();
