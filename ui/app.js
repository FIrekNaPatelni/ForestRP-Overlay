const panel = new URLSearchParams(location.search).get('panel');
const isPanel = panel === 'mdt' || panel === 'phone';
const status = document.querySelector(isPanel ? '#panel-status' : '#status');
let recording = null, recordingTimer, lastConfig, dirty = false;
const shortcutValues = { mdt: 'F6', phone: 'F7' };
async function call(action, value) {
  try {
    const result = await window.desktop.call(action, value);
    if (result?.error) status.textContent = result.error;
    return result;
  } catch { status.textContent = 'Operacja nie powiodła się. Spróbuj ponownie.'; }
}
window.desktop.onStatus(message => {
  status.textContent = typeof message === 'string' ? message : message.text;
  if (isPanel) document.querySelector('#panel-state').hidden = message?.ready === true;
});
if (isPanel) {
  document.documentElement.classList.add('panel-root');
  document.body.classList.add('panel', panel);
  document.querySelector('#hub').hidden = true;
  document.querySelector('#panel-state').hidden = false;
  document.querySelector('#device-bottom').hidden = false;
  document.querySelector('#quit').hidden = true;
  document.querySelector('#reload').hidden = false;
  document.querySelector('#settings').hidden = false;
  document.querySelector('#brand-sub').textContent = panel === 'phone' ? 'Telefon' : 'MDT';
  document.querySelector('#panel-title').textContent = panel === 'phone' ? 'Telefon ForestRP' : 'MDT ForestRP';
}
for (const action of ['settings', 'reload', 'hide', 'quit']) document.getElementById(action).addEventListener('click', () => call(action));
document.querySelector('#retry').addEventListener('click', () => call('reload'));
document.querySelector('#panel-settings').addEventListener('click', () => call('settings'));
document.querySelector('#both').addEventListener('click', () => call('both'));
for (const action of ['check-updates', 'open-releases']) document.getElementById(action).addEventListener('click', () => call(action));
document.querySelector('#reset-layout').addEventListener('click', async () => {
  const result = await call('reset-layout');
  if (result?.ok) status.textContent = 'Przywrócono domyślne położenie i rozmiary.';
});
document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => call('toggle', button.dataset.panel)));
function renderState(config) {
  if (!config?.shortcuts) return;
  lastConfig = config;
  if (!dirty && !recording) fillSettings(config);
  document.querySelector('#version').textContent = config.version;
  document.querySelector('#update-status').textContent = config.update?.text || 'Nie sprawdzono aktualizacji.';
  document.querySelector('#check-updates').disabled = !!config.update?.checking;
  document.querySelector('#open-releases').classList.toggle('primary', !!config.update?.available);
  for (const id of ['mdt', 'phone']) {
    document.getElementById('key-' + id).textContent = config.shortcuts[id].replaceAll('Control', 'Ctrl');
    const button = document.querySelector('[data-panel="' + id + '"]');
    button.textContent = (config.visible[id] ? 'Schowaj ' : 'Otwórz ') + (id === 'mdt' ? 'MDT' : 'telefon');
    button.classList.toggle('active', !!config.visible[id]);
  }
}
function fillSettings(config) {
  for (const id of ['mdt', 'phone']) {
    shortcutValues[id] = config.shortcuts[id];
    document.getElementById('shortcut-' + id).textContent = config.shortcuts[id].replaceAll('Control', 'Ctrl');
  }
  document.querySelector('#animations').checked = config.animations;
  document.querySelector('#game-mode').checked = config.gameMode;
  document.querySelector('#auto-updates').checked = config.autoUpdates !== false;
}
window.desktop.onState(renderState);
call('get').then(config => { if (config?.shortcuts) { fillSettings(config); renderState(config); } });
async function finishRecording(value) {
  if (!recording) return;
  const id = recording; recording = null; clearTimeout(recordingTimer);
  if (value) { shortcutValues[id] = value; dirty = true; }
  const button = document.getElementById('shortcut-' + id);
  button.textContent = shortcutValues[id].replaceAll('Control', 'Ctrl');
  button.classList.remove('recording');
  await call('capture-end');
}
document.querySelectorAll('[data-shortcut]').forEach(button => button.addEventListener('click', async () => {
  await finishRecording();
  const result = await call('capture-start');
  if (!result?.ok) return;
  recording = button.dataset.shortcut;
  button.textContent = 'Naciśnij klawisz…'; button.classList.add('recording');
  status.textContent = 'Naciśnij skrót. Esc anuluje. Potem wybierz Zapisz.';
  recordingTimer = setTimeout(() => finishRecording(), 30000);
}));
document.addEventListener('keydown', event => {
  if (!recording) return;
  event.preventDefault(); event.stopPropagation();
  if (event.key === 'Escape') { void finishRecording(); return; }
  if (event.repeat || ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
  const value = window.ForestShortcuts.shortcutFromEvent(event);
  if (value) { void finishRecording(value); status.textContent = 'Wybrano skrót. Kliknij Zapisz.'; }
  else status.textContent = 'Ten klawisz jest zarezerwowany lub nieobsługiwany. Wybierz inny.';
}, true);
window.addEventListener('blur', () => { void finishRecording(); });
document.querySelector('form').addEventListener('change', () => { dirty = true; });
document.querySelector('form').addEventListener('submit', async event => {
  event.preventDefault(); await finishRecording();
  const result = await call('save', { shortcuts: { ...shortcutValues },
    animations: document.querySelector('#animations').checked, gameMode: document.querySelector('#game-mode').checked,
    autoUpdates: document.querySelector('#auto-updates').checked });
  if (result?.ok) { dirty = false; status.textContent = 'Zapisano ustawienia.'; if (lastConfig) fillSettings(lastConfig); }
});
const grip = document.querySelector('#resize-grip');
grip.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  event.preventDefault(); grip.setPointerCapture(event.pointerId); void call('resize-start');
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) grip.addEventListener(name, () => call('resize-end'));
