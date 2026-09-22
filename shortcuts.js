const MODIFIERS = ['Control', 'Alt', 'Shift', 'Super'];
function normalizeShortcut(value) {
  if (typeof value !== 'string' || value.length > 80) return null;
  const aliases = { ctrl: 'Control', control: 'Control', alt: 'Alt', shift: 'Shift', win: 'Super', meta: 'Super', super: 'Super' };
  const parts = value.trim().split('+').map(part => part.trim());
  const key = parts.pop();
  const modifiers = parts.map(part => aliases[part.toLowerCase()]);
  if (modifiers.some(part => !part) || new Set(modifiers).size !== modifiers.length) return null;
  const names = ['Tab', 'Space', 'Enter', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'Up', 'Down', 'Left', 'Right', 'Plus', 'Minus', 'Comma', 'Period', 'Slash', 'Semicolon', 'Quote', 'Backslash', 'BracketLeft', 'BracketRight'];
  const punctuation = { Minus: '-', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", Backslash: '\\', BracketLeft: '[', BracketRight: ']' };
  let normalized = names.find(name => name.toLowerCase() === key?.toLowerCase());
  normalized = punctuation[normalized] || normalized;
  if (!normalized && /^(?:[a-z0-9]|F(?:[1-9]|1\d|2[0-4])|num[0-9])$/i.test(key)) normalized = /^num/i.test(key) ? key.toLowerCase() : key.toUpperCase();
  if (!normalized && Object.values(punctuation).includes(key)) normalized = key;
  if (!normalized) return null;
  const result = [...MODIFIERS.filter(mod => modifiers.includes(mod)), normalized].join('+');
  if (['F5', 'Control+R', 'Alt+F4', 'Control+Alt+Delete', 'Super+L'].includes(result)) return null;
  return result;
}
function shortcutFromEvent(event) {
  if (['Control', 'Alt', 'Shift', 'Meta', 'Escape'].includes(event.key)) return null;
  const names = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', ' ': 'Space', '+': 'Plus' };
  let key = names[event.key] || event.key;
  if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
  if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
  if (/^Numpad[0-9]$/.test(event.code)) key = 'num' + event.code.slice(6);
  return normalizeShortcut([event.ctrlKey && 'Control', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Super', key].filter(Boolean).join('+'));
}
if (typeof module !== 'undefined') module.exports = { normalizeShortcut, shortcutFromEvent };
else window.ForestShortcuts = { normalizeShortcut, shortcutFromEvent };
