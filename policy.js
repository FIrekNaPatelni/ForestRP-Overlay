const { normalizeShortcut } = require('./shortcuts');
const APPS = Object.freeze({
  mdt: Object.freeze({ id: 'mdt', name: 'MDT', url: 'https://mdt.forestrp.pl', shortcut: 'F6' }),
  phone: Object.freeze({ id: 'phone', name: 'Telefon', url: 'https://forestrp.pl', shortcut: 'F7' })
});
function allowedNavigation(value, id) {
  try {
    const url = new URL(value);
    return !!APPS[id] && !url.username && !url.password &&
      (url.origin === APPS[id].url || url.origin === 'https://discord.com');
  } catch { return false; }
}
function validBounds(value) {
  return value && ['x', 'y', 'width', 'height'].every(key => Number.isInteger(value[key]) && Math.abs(value[key]) <= 100000) && value.width >= 200 && value.height >= 200;
}
function readSettings(stored = {}) {
  if (!stored || typeof stored !== 'object') stored = {};
  const mdt = normalizeShortcut(stored.shortcuts?.mdt) || normalizeShortcut(stored.shortcut) || 'F6';
  let phone = normalizeShortcut(stored.shortcuts?.phone) || 'F7';
  if (phone === mdt) phone = mdt === 'F7' ? 'F8' : 'F7';
  const bounds = {};
  for (const id of Object.keys(APPS)) {
    if (validBounds(stored.bounds?.[id])) {
      const { x, y, width, height } = stored.bounds[id];
      bounds[id] = { x, y, width, height };
    }
  }
  return { shortcuts: { mdt, phone }, animations: stored.animations !== false, gameMode: stored.gameMode !== false, autoUpdates: stored.autoUpdates !== false, bounds };
}
function validateSettings(value) {
  const mdt = normalizeShortcut(value?.shortcuts?.mdt), phone = normalizeShortcut(value?.shortcuts?.phone);
  if (!value || typeof value.animations !== 'boolean' || typeof value.gameMode !== 'boolean' || !mdt || !phone) {
    throw new Error('Wybierz poprawny skrót. Esc, F5, Ctrl+R i skróty systemowe są zarezerwowane.');
  }
  if (mdt === phone) throw new Error('MDT i telefon muszą mieć różne skróty.');
  return { shortcuts: { mdt, phone }, animations: value.animations, gameMode: value.gameMode, autoUpdates: value.autoUpdates !== false };
}
function clampBounds(id, bounds, area) {
  const width = Math.min(area.width, Math.max(id === 'phone' ? 280 : 480, Math.round(bounds.width)));
  const height = Math.min(area.height, Math.max(id === 'phone' ? 420 : 360, Math.round(bounds.height)));
  return { x: Math.max(area.x, Math.min(Math.round(bounds.x), area.x + area.width - width)),
    y: Math.max(area.y, Math.min(Math.round(bounds.y), area.y + area.height - height)), width, height };
}
function panelBounds(id, area) {
  const gap = 16;
  const phoneWidth = Math.min(390, area.width - gap * 2);
  if (id === 'phone') {
    const height = Math.min(780, area.height - gap * 2);
    return { x: area.x + gap, y: area.y + area.height - height - gap, width: phoneWidth, height };
  }
  const available = area.width >= 1200 ? area.width - phoneWidth - gap * 3 : area.width - gap * 2;
  const width = Math.min(1250, available), height = Math.min(850, area.height - gap * 2);
  return { x: area.x + area.width - width - gap, y: area.y + Math.round((area.height - height) / 2), width, height };
}
module.exports = { APPS, allowedNavigation, readSettings, validateSettings, panelBounds, clampBounds };
