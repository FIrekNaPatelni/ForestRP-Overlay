const { app, BrowserWindow, WebContentsView, globalShortcut, ipcMain, dialog, screen, Tray, Menu, nativeImage, shell, Notification } = require('electron');
const { RELEASES_URL, checkRelease } = require('./updates');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { APPS, allowedNavigation, readSettings, validateSettings, panelBounds, clampBounds } = require('./policy');
const { animate, cancelAnimation } = require('./animation');
const uiPath = path.join(__dirname, 'ui', 'index.html');
const uiUrl = pathToFileURL(uiPath).href;
const iconPath = path.join(__dirname, 'assets', 'icon.ico');
const phoneCSS = fs.readFileSync(path.join(__dirname, 'ui', 'phone.css'), 'utf8');
const { version } = require('./package.json');
const panels = new Map();
const registered = new Set();
const securePreferences = { sandbox: true, contextIsolation: true, nodeIntegration: false };
const shellPreferences = { ...securePreferences, preload: path.join(__dirname, 'preload.js') };
let hub, tray, settings, configPath, quitting = false, persistTimer, topTimer, captureTimer;
let updateState = { text: 'Nie sprawdzono aktualizacji.', available: false }, checkingUpdate = false, updateTimer, storageTimer, storageFlushed = false;
const persistentSessions = new Set();
let notifiedVersion;
async function flushSessions() {
  await Promise.all([...persistentSessions].map(async ses => { ses.flushStorageData(); await ses.cookies.flushStore(); }));
}
async function checkUpdates() {
  if (checkingUpdate) return;
  checkingUpdate = true;
  updateState = { ...updateState, text: 'Sprawdzanie aktualizacji…', checking: true }; emitState();
  try {
    const result = await checkRelease(version);
    updateState = { ...result, text: result.available ? 'Dostępna nowa wersja: ' + result.version : 'Masz aktualną wersję.' };
    if (result.available && notifiedVersion !== result.version && Notification.isSupported()) {
      const notice = new Notification({ title: 'Aktualizacja ForestRP Overlay', body: 'Dostępna wersja ' + result.version + '. Kliknij, aby otworzyć wydania.', icon: iconPath });
      notice.on('click', () => void shell.openExternal(RELEASES_URL).catch(report)); notice.show(); notifiedVersion = result.version;
    }
  } catch (error) { updateState = { ...updateState, checking: false, text: error.message }; }
  finally { checkingUpdate = false; emitState(); }
}
app.setName('ForestRP Overlay');
function emit(win, message) { if (win && !win.isDestroyed()) win.webContents.send('status', message); }
function report(error) { emit(hub, error.message); }
function snapshot() {
  return { ...settings, version, update: updateState, apps: Object.values(APPS),
    visible: Object.fromEntries([...panels].map(([id, panel]) => [id, panel.targetVisible])) };
}
function emitState() { if (hub && !hub.isDestroyed()) hub.webContents.send('state', snapshot()); }
function showHub() { hub.show(); hub.restore(); hub.focus(); emitState(); }
function writeSettings(next = settings) {
  fs.writeFileSync(configPath + '.tmp', JSON.stringify(next, null, 2));
  fs.renameSync(configPath + '.tmp', configPath);
}
function flushSettings() {
  clearTimeout(persistTimer); persistTimer = null;
  try { writeSettings(); } catch (error) { report(error); }
}
function rememberBounds(panel) {
  if (panel.animation || panel.positioning || !panel.targetVisible || panel.win.isDestroyed()) return;
  panel.restBounds = panel.win.getBounds();
  settings.bounds[panel.id] = { ...panel.restBounds };
  clearTimeout(persistTimer);
  persistTimer = setTimeout(flushSettings, 350);
}
function bindShortcuts(next) {
  const desired = new Set(Object.values(next.shortcuts)), added = [];
  try {
    for (const key of desired) {
      if (registered.has(key)) continue;
      if (!globalShortcut.register(key, () => {
        const id = Object.keys(APPS).find(id => settings.shortcuts[id] === key);
        if (id) void toggle(id).catch(report);
      })) throw new Error('Skrót ' + key + ' jest zajęty. Wybierz inny.');
      added.push(key);
    }
  } catch (error) {
    for (const key of added) globalShortcut.unregister(key);
    throw error;
  }
  for (const key of registered) if (!desired.has(key)) globalShortcut.unregister(key);
  registered.clear();
  for (const key of desired) registered.add(key);
}
function stopCapture() {
  if (!captureTimer) return;
  clearTimeout(captureTimer); captureTimer = null;
  try { bindShortcuts(settings); } catch (error) { report(error); }
}
function startCapture() {
  stopCapture();
  for (const key of registered) globalShortcut.unregister(key);
  registered.clear();
  captureTimer = setTimeout(() => { stopCapture(); emit(hub, 'Przypisywanie skrótu zakończone.'); }, 30000);
}
async function saveSettings(value) {
  stopCapture();
  const next = { ...validateSettings(value), bounds: settings.bounds }, previous = settings;
  bindShortcuts(next);
  try { writeSettings(next); settings = next; }
  catch (error) { bindShortcuts(previous); throw error; }
  updateTopmost(); updateTray(); emitState();
}
function updateTopmost() {
  clearInterval(topTimer); topTimer = null;
  for (const panel of panels.values()) panel.win.setAlwaysOnTop(true, settings.gameMode ? 'screen-saver' : 'floating');
  if (quitting || !settings.gameMode || ![...panels.values()].some(panel => panel.targetVisible)) return;
  topTimer = setInterval(() => {
    for (const panel of panels.values()) {
      if (panel.targetVisible && !panel.win.isDestroyed() && !panel.win.isFocused()) panel.win.moveTop();
    }
  }, 1000);
  topTimer.unref();
}
function updateTray() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'MDT · ' + settings.shortcuts.mdt, click: () => void toggle('mdt').catch(report) },
    { label: 'Telefon · ' + settings.shortcuts.phone, click: () => void toggle('phone').catch(report) },
    { label: 'Pokaż oba', click: () => void showBoth().catch(report) },
    { label: 'Schowaj oba', click: () => { for (const id of panels.keys()) void setVisible(id, false).catch(report); } },
    { label: 'Przywróć domyślny układ', click: () => resetLayout() },
    { type: 'separator' }, { label: 'Ustawienia', click: showHub },
    { label: 'Zakończ ForestRP Overlay', click: () => app.quit() }
  ]));
}
function shellLock(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
}
function layout(panel) {
  const [width, height] = panel.win.getContentSize();
  panel.view.setBounds({ x: 8, y: 40, width: Math.max(1, width - 16), height: Math.max(1, height - 62) });
  panel.view.setBorderRadius(panel.id === 'phone' ? 22 : 16);
  if (process.platform === 'win32' && panel.shapeSize !== `${width}:${height}`) {
    const radius = panel.id === 'phone' ? 30 : 24;
    const rects = [{ x: 0, y: radius, width, height: height - 2 * radius }];
    for (let y = 0; y < radius; y++) {
      const x = Math.ceil(radius - Math.sqrt(radius * radius - (radius - y - 0.5) ** 2));
      rects.push({ x, y, width: width - 2 * x, height: 1 }, { x, y: height - y - 1, width: width - 2 * x, height: 1 });
    }
    panel.win.setShape(rects);
    panel.shapeSize = `${width}:${height}`;
  }
}
function restoredBounds(id) {
  const saved = settings.bounds[id];
  const area = (saved ? screen.getDisplayMatching(saved) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint())).workArea;
  return clampBounds(id, saved || panelBounds(id, area), area);
}
function stopResize(panel) {
  if (!panel.resizeTimer) return;
  clearInterval(panel.resizeTimer); panel.resizeTimer = null;
  rememberBounds(panel);
}
function startResize(panel) {
  stopResize(panel); cancelAnimation(panel);
  const start = screen.getCursorScreenPoint(), bounds = panel.win.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const started = Date.now();
  panel.resizeTimer = setInterval(() => {
    if (panel.win.isDestroyed() || Date.now() - started > 30000) { stopResize(panel); return; }
    const cursor = screen.getCursorScreenPoint();
    const next = clampBounds(panel.id, { ...bounds, width: bounds.width + cursor.x - start.x, height: bounds.height + cursor.y - start.y }, area);
    next.x = bounds.x; next.y = bounds.y;
    next.width = Math.min(next.width, area.x + area.width - bounds.x);
    next.height = Math.min(next.height, area.y + area.height - bounds.y);
    panel.win.setBounds(next);
  }, 16);
}
function resetLayout() {
  settings.bounds = {};
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  for (const panel of panels.values()) {
    stopResize(panel); cancelAnimation(panel); panel.positioning = true;
    panel.restBounds = clampBounds(panel.id, panelBounds(panel.id, area), area);
    panel.win.setBounds(panel.restBounds); panel.win.setOpacity(1);
    if (!panel.targetVisible) panel.win.hide();
    panel.positioning = false;
    settings.bounds[panel.id] = { ...panel.restBounds };
  }
  flushSettings(); emitState();
}
async function loadPanel(panel) {
  if (panel.loading || panel.win.isDestroyed()) return;
  panel.loading = true; panel.failed = false; panel.view.setVisible(false);
  emit(panel.win, 'Łączenie z ' + APPS[panel.id].name + '…');
  try {
    await panel.view.webContents.loadURL(APPS[panel.id].url);
    if (!panel.win.isDestroyed()) panel.view.setVisible(true);
  } catch {
    panel.failed = true; emit(panel.win, 'Brak połączenia. Sprawdź internet i wybierz Ponów.');
  } finally { panel.loading = false; }
}
async function refresh(panel) {
  if (panel.failed || !panel.loaded) { await loadPanel(panel); return; }
  const answer = await dialog.showMessageBox(panel.win, {
    type: 'question', buttons: ['Anuluj', 'Odśwież'], defaultId: 0, cancelId: 0,
    message: 'Odświeżyć ' + APPS[panel.id].name + '?', detail: 'Niezapisane dane w formularzach mogą zostać utracone.'
  });
  if (answer.response === 1 && !panel.win.isDestroyed()) panel.view.webContents.reloadIgnoringCache();
}
function createPanel(id) {
  const bounds = restoredBounds(id);
  const win = new BrowserWindow({ ...bounds, show: false, frame: false, skipTaskbar: true, resizable: true,
    minWidth: Math.min(bounds.width, id === 'mdt' ? 480 : 280), minHeight: Math.min(bounds.height, id === 'phone' ? 420 : 360),
    maximizable: false, fullscreenable: false, title: 'ForestRP Overlay · ' + APPS[id].name,
    icon: iconPath, backgroundColor: '#00000000', transparent: true, hasShadow: false, webPreferences: shellPreferences });
  win.setAlwaysOnTop(true, settings.gameMode ? 'screen-saver' : 'floating'); win.setMenu(null); shellLock(win);
  const view = new WebContentsView({ webPreferences: { ...securePreferences,
    partition: id === 'mdt' ? 'persist:forest-mdt' : 'persist:forest-phone' } });
  win.contentView.addChildView(view); view.setVisible(false); view.setBackgroundColor('#0c1822');
  const panel = { id, win, view, restBounds: bounds, targetVisible: false, animation: null, loading: false, loaded: false, failed: false };
  panels.set(id, panel); layout(panel);
  const remote = view.webContents, remoteSession = remote.session;
  persistentSessions.add(remoteSession);
  remote.on('dom-ready', () => { void flushSessions().catch(report); });
  win.on('hide', () => { void flushSessions().catch(report); });
  win.on('session-end', () => { flushSettings(); void flushSessions().catch(report); });
  remoteSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  remoteSession.setPermissionCheckHandler(() => false);
  const preventDownload = event => event.preventDefault();
  remoteSession.on('will-download', preventDownload);
  for (const eventName of ['will-navigate', 'will-redirect', 'will-frame-navigate']) {
    remote.on(eventName, (event, url) => {
      const destination = typeof url === 'string' ? url : event.url;
      if (eventName === 'will-frame-navigate' && !event.isMainFrame) return;
      if (!allowedNavigation(destination, id)) { event.preventDefault(); emit(hub, 'Dostępne są wyłącznie MDT, Telefon i logowanie Discord.'); }
    });
  }
  remote.setWindowOpenHandler(({ url }) => { if (allowedNavigation(url, id)) void remote.loadURL(url).catch(() => {}); return { action: 'deny' }; });
  remote.on('dom-ready', () => {
    if (id === 'phone' && new URL(remote.getURL()).origin === APPS.phone.url) void remote.insertCSS(phoneCSS).catch(() => {});
  });
  remote.on('did-finish-load', () => { panel.failed = false; panel.loaded = true; view.setVisible(true); emit(win, { text: 'Połączono', ready: true }); });
  remote.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
    if (mainFrame && code !== -3) { panel.failed = true; view.setVisible(false); emit(win, 'Brak połączenia. Sprawdź internet i wybierz Ponów.'); }
  });
  remote.on('render-process-gone', () => { panel.failed = true; view.setVisible(false); emit(win, 'Panel został zamknięty. Wybierz Ponów.'); });
  for (const contents of [win.webContents, remote]) {
    contents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'Escape') { event.preventDefault(); void setVisible(id, false).catch(report); }
      if (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r')) { event.preventDefault(); void refresh(panel).catch(report); }
    });
  }
  win.on('resize', () => { layout(panel); rememberBounds(panel); });
  win.on('moved', () => rememberBounds(panel));
  win.on('blur', () => { stopResize(panel); if (settings.gameMode && panel.targetVisible) win.moveTop(); });
  win.on('close', event => { if (!quitting) { event.preventDefault(); void setVisible(id, false).catch(report); } });
  win.on('closed', () => {
    cancelAnimation(panel); clearInterval(panel.resizeTimer);
    remoteSession.removeListener('will-download', preventDownload);
    if (!remote.isDestroyed()) remote.close();
    panels.delete(id); updateTopmost();
  });
  panel.ready = win.loadFile(uiPath, { query: { panel: id } });
  return panel;
}
async function setVisible(id, visible) {
  if (!APPS[id]) throw new Error('Nieznany panel.');
  if (!visible && !panels.has(id)) return;
  const panel = panels.get(id) || createPanel(id);
  await panel.ready;
  if (quitting || panel.win.isDestroyed()) return;
  stopResize(panel);
  if (!panel.animation && !panel.targetVisible && visible) panel.restBounds = restoredBounds(id);
  if (visible && (!panel.loaded || panel.failed)) void loadPanel(panel);
  const motion = animate(panel, visible, settings.animations, !settings.gameMode);
  updateTopmost(); emitState(); await motion;
}
async function toggle(id) { return setVisible(id, !panels.get(id)?.targetVisible); }
async function showBoth() { await Promise.all(Object.keys(APPS).map(id => setVisible(id, true))); }
function trustedSender(event) {
  return [hub, ...[...panels.values()].map(panel => panel.win)].some(win => win && !win.isDestroyed() && event.sender === win.webContents &&
    event.senderFrame === win.webContents.mainFrame && event.senderFrame.url.split('?')[0] === uiUrl);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (hub) showHub(); });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    app.setAppUserModelId('pl.forestrp.mdt');
    const profile = app.getPath('userData');
    configPath = path.join(profile, 'settings.json');
    if (!fs.existsSync(configPath)) {
      for (const name of ['forest-mdt-desktop', 'Forest MDT']) {
        const legacy = path.join(app.getPath('appData'), name);
        if (legacy !== profile && fs.existsSync(path.join(legacy, 'settings.json'))) {
          app.setPath('userData', legacy); app.setPath('sessionData', legacy); configPath = path.join(legacy, 'settings.json'); break;
        }
      }
    }
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    let stored = {};
    try { stored = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
    settings = readSettings(stored); writeSettings();
    hub = new BrowserWindow({ width: 800, height: 720, minWidth: 700, minHeight: 660, show: false, frame: false,
      icon: iconPath, backgroundColor: '#0c141c', title: 'ForestRP Overlay', webPreferences: shellPreferences });
    shellLock(hub);
    hub.on('blur', stopCapture);
    hub.on('close', event => { if (!quitting) { event.preventDefault(); stopCapture(); hub.hide(); } });
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'logo.png')).resize({ width: 24, height: 24 }));
    tray.setToolTip('ForestRP Overlay'); tray.on('double-click', showHub); updateTray();
    ipcMain.handle('desktop', async (event, action, value) => {
      if (!trustedSender(event)) throw new Error('Unauthorized');
      const owner = [...panels.values()].find(panel => panel.win.webContents === event.sender);
      try {
        if (action === 'get') return snapshot();
        if (action === 'toggle') await toggle(value);
        else if (action === 'both') await showBoth();
        else if (action === 'hide') { if (owner) await setVisible(owner.id, false); else { stopCapture(); hub.hide(); } }
        else if (action === 'reload' && owner) await refresh(owner);
        else if (action === 'settings') showHub();
        else if (action === 'save' && !owner) await saveSettings(value);
        else if (action === 'check-updates' && !owner) await checkUpdates();
        else if (action === 'open-releases' && !owner) await shell.openExternal(RELEASES_URL);
        else if (action === 'capture-start' && !owner) startCapture();
        else if (action === 'capture-end' && !owner) stopCapture();
        else if (action === 'reset-layout' && !owner) resetLayout();
        else if (action === 'resize-start' && owner) startResize(owner);
        else if (action === 'resize-end' && owner) stopResize(owner);
        else if (action === 'quit') app.quit();
        return { ok: true };
      } catch (error) { return { error: error.message }; }
    });
    await hub.loadFile(uiPath); showHub();
    if (settings.autoUpdates) void checkUpdates();
    updateTimer = setInterval(() => { if (settings.autoUpdates) void checkUpdates(); }, 6 * 60 * 60 * 1000);
    updateTimer.unref();
    storageTimer = setInterval(() => { void flushSessions().catch(report); }, 5000);
    storageTimer.unref();
    try { bindShortcuts(settings); } catch (error) { report(error); }
    const fitDisplays = () => {
      for (const panel of panels.values()) {
        stopResize(panel); cancelAnimation(panel); panel.positioning = true;
        panel.restBounds = restoredBounds(panel.id); panel.win.setBounds(panel.restBounds); panel.win.setOpacity(1);
        if (!panel.targetVisible) panel.win.hide();
        panel.positioning = false; settings.bounds[panel.id] = { ...panel.restBounds };
      }
      flushSettings();
    };
    screen.on('display-removed', fitDisplays); screen.on('display-metrics-changed', fitDisplays);
  }).catch(error => { dialog.showErrorBox('ForestRP Overlay', error.message); app.quit(); });
}
app.on('before-quit', event => {
  if (!storageFlushed && persistentSessions.size) {
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    void flushSessions().catch(report).finally(() => { storageFlushed = true; app.quit(); });
  }
  clearInterval(storageTimer); clearInterval(updateTimer);
  quitting = true; clearTimeout(captureTimer); captureTimer = null; clearInterval(topTimer);
  if (settings && configPath) flushSettings();
  for (const panel of panels.values()) { cancelAnimation(panel); clearInterval(panel.resizeTimer); }
  globalShortcut.unregisterAll();
});
app.on('will-quit', () => { clearInterval(topTimer); tray?.destroy(); globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => app.quit());
