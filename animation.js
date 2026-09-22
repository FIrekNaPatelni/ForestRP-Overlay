function cancelAnimation(panel) {
  if (!panel.animation) return;
  clearInterval(panel.animation.timer); panel.animation.resolve(); panel.animation = null; panel.positioning = false;
}
function animate(panel, visible, enabled, focus = true) {
  cancelAnimation(panel);
  if (panel.win.isDestroyed()) return Promise.resolve();
  panel.targetVisible = visible;
  const win = panel.win, target = panel.restBounds;
  const distance = panel.id === 'phone' ? 50 : 24;
  const endY = target.y + (visible ? 0 : distance);
  let startY = win.getBounds().y, startOpacity = win.getOpacity();
  panel.positioning = true;
  if (visible && !win.isVisible()) {
    startY = target.y + distance; startOpacity = 0;
    win.setOpacity(0); win.setBounds({ ...target, y: startY }); win.showInactive();
  }
  const finish = () => {
    if (visible) {
      win.setBounds(target); win.setOpacity(1);
      if (focus) { win.focus(); panel.view.webContents.focus(); }
    } else { win.hide(); win.setBounds(target); win.setOpacity(1); }
    panel.positioning = false;
  };
  if (!enabled) { finish(); return Promise.resolve(); }
  if (!visible) win.blur();
  const started = Date.now();
  return new Promise(resolve => {
    const timer = setInterval(() => {
      if (win.isDestroyed()) { cancelAnimation(panel); panel.positioning = false; return; }
      const t = Math.min(1, (Date.now() - started) / 230), eased = 1 - Math.pow(1 - t, 3);
      win.setBounds({ ...target, y: Math.round(startY + (endY - startY) * eased) });
      win.setOpacity(startOpacity + ((visible ? 1 : 0) - startOpacity) * eased);
      if (t === 1) { clearInterval(timer); finish(); panel.animation = null; resolve(); }
    }, 16);
    panel.animation = { timer, resolve };
  });
}
module.exports = { animate, cancelAnimation };
