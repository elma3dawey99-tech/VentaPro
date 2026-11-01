// VentaPro desktop shell — opens the live VentaPro web app in its own window.
// The simulator itself lives online, so every update published to the web app reaches all lab PCs instantly.
// The shell itself updates from GitHub Releases (electron-updater): new versions download in the
// background and install when the app is closed.
const { app, BrowserWindow, shell, Menu, session, net, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

const APP_URL = 'https://script.google.com/macros/s/AKfycby3f0siT5loGswosCvbxI0ad2eFy072l1uju48f3XP1oB3BK3JuH0OJ0dNbjhbtgXI9sA/exec';
const ALLOWED = [/^https:\/\/script\.google\.com\//, /^https:\/\/[\w.-]*googleusercontent\.com\//, /^https:\/\/accounts\.google\.com\//, /^https:\/\/fonts\.(googleapis|gstatic)\.com\//];
const startUrl = APP_URL + (process.argv.includes('--instructor') ? '?view=instructor' : '');
// hides Google's "created by an Apps Script user" bar so the app fills the window
const HIDE_BAR = '#warning,#warning-bar-table tr:first-child{display:none!important} html,body{margin:0!important;overflow:hidden!important} #warning-bar-table{height:100vh!important;width:100vw!important} #sandboxFrame{height:100vh!important;width:100vw!important;display:block}';
let SPLASH_MIN_MS = 4200;

// ---- remote shell config: splash, extra CSS, timing and window mode come from the VentSim server ----
const CFG_URL = APP_URL + '?shell=1&app=' + encodeURIComponent(app.getVersion());
const cfgFile = () => path.join(app.getPath('userData'), 'shell.json');
const splashFile = () => path.join(app.getPath('userData'), 'splash.html');
let cfg = {};
function loadCachedCfg() {
  try { cfg = JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) || {}; } catch (e) { cfg = {}; }
  if (cfg.splashMs) SPLASH_MIN_MS = cfg.splashMs;
}
async function refreshCfg() {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await net.fetch(CFG_URL, { signal: ctrl.signal, cache: 'no-store' }); clearTimeout(t);
    if (!r.ok) return;
    const j = await r.json(); if (!j || typeof j !== 'object') return;
    cfg = j; fs.writeFileSync(cfgFile(), JSON.stringify(j));
    if (j.splash) fs.writeFileSync(splashFile(), j.splash);   // used from the next start
    applyCss();
  } catch (e) { /* offline: keep cached config */ }
}
function applyCss() {
  if (!win || win.isDestroyed()) return;
  const u = win.webContents.getURL();
  if (u.startsWith('https://script.google.com/')) win.webContents.insertCSS(HIDE_BAR + (cfg.css || ''));
}

let win, splash, shownAt = Date.now(), mainReady = false;
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function createSplash() {
  splash = new BrowserWindow({ width: 760, height: 440, frame: false, resizable: false, movable: true, center: true, show: false,
    backgroundColor: '#0B1528', alwaysOnTop: true, skipTaskbar: false, icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.js') } });
  const remote = fs.existsSync(splashFile()) ? splashFile() : path.join(__dirname, 'splash.html');
  splash.loadFile(remote, { query: { v: app.getVersion() } });
  splash.once('ready-to-show', () => { splash.show(); shownAt = Date.now(); });
  // window controls on the frameless splash (title used as a tiny command channel)
  splash.on('page-title-updated', (e, t) => {
    e.preventDefault();
    if (t === 'vpcmd:min') splash.minimize();
    else if (t === 'vpcmd:close') app.quit();
  });
}

function revealMain() {
  if (!mainReady || !win) return;
  const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - shownAt));
  setTimeout(() => {
    if (!win.isFullScreen()) win.maximize();
    win.show(); win.focus();
    if (splash && !splash.isDestroyed()) splash.destroy();
    // apply full screen after the window is on screen (on Windows a hidden window can ignore it until clicked)
    if (cfg.fullscreen !== false) setTimeout(() => { if (!win.isDestroyed()) { win.setFullScreen(true); win.focus(); fsState(); } }, 60);
  }, wait);
}

function createMain() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 680, show: false, fullscreen: cfg.fullscreen !== false,
    backgroundColor: '#EEF2F0', title: 'VentaPro', icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.on('page-title-updated', e => e.preventDefault());
  win.loadURL(startUrl);

  win.webContents.on('did-finish-load', () => {
    applyCss(); fsBar();
    if (!mainReady) { mainReady = true; revealMain(); }
  });
  win.webContents.on('dom-ready', () => {
    applyCss();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (ALLOWED.some(r => r.test(url))) { win.loadURL(url); return { action: 'deny' }; }
    shell.openExternal(url); return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:')) return;
    if (!ALLOWED.some(r => r.test(url))) { e.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (isMain && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'), { query: { u: startUrl } });
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) { win.webContents.reloadIgnoringCache(); e.preventDefault(); }
  });
  win.on('enter-full-screen', fsState); win.on('leave-full-screen', fsState);
  // safety: never keep the splash forever
  setTimeout(() => { if (!mainReady) { mainReady = true; revealMain(); } }, 20000);
}

// ---- window commands from the splash and the full-screen control bar ----
ipcMain.on('vp-cmd', (e, c) => {
  const fromSplash = splash && !splash.isDestroyed() && e.sender === splash.webContents;
  const fromMain = win && !win.isDestroyed() && e.sender === win.webContents && e.senderFrame === win.webContents.mainFrame;
  if (!fromSplash && !fromMain) return;
  const w = fromSplash ? splash : win;
  if (c === 'min') w.minimize();
  else if (c === 'close') { if (fromSplash) app.quit(); else win.close(); }
  else if (c === 'fs' && fromMain) win.setFullScreen(!win.isFullScreen());
});
// full screen hides the Windows taskbar; a slim VentaPro title strip (always visible) keeps minimise / window / close
const FSBAR = "(function(){if(window.__vpFs)return;var s=document.createElement('style');s.textContent='" +
  "#vpBar{position:fixed;left:0;right:0;top:0;height:32px;z-index:2147483647;display:none;align-items:center;background:#0E1A2C;border-bottom:1px solid rgba(228,185,74,.35);font:600 13px Segoe UI,sans-serif;color:#E8EEF8;-webkit-user-select:none;user-select:none}" +
  "#vpBar .t{padding-left:14px;letter-spacing:.3px}#vpBar .t b{color:#E4B94A;font-weight:600}#vpBar .sp{flex:1}" +
  "#vpBar button{all:unset;width:46px;height:32px;display:grid;place-items:center;color:#C9D4EC;cursor:pointer}" +
  "#vpBar button:hover{background:rgba(255,255,255,.12);color:#fff}#vpBar button.x:hover{background:#C42B1C;color:#fff}" +
  "#vpBar svg{width:11px;height:11px;stroke:currentColor;stroke-width:1.3;fill:none}" +
  "html.vpfs #sandboxFrame{position:fixed!important;top:32px!important;left:0!important;width:100vw!important;height:calc(100vh - 32px)!important}';" +
  "document.head.appendChild(s);var b=document.createElement('div');b.id='vpBar';" +
  "b.innerHTML='<span class=\"t\">Venta<b>Pro</b></span><span class=\"sp\"></span><button data-c=\"min\" title=\"Minimise\"><svg viewBox=\"0 0 11 11\"><path d=\"M1 5.5h9\"/></svg></button><button data-c=\"fs\" title=\"Exit full screen (F11)\"><svg viewBox=\"0 0 11 11\"><path d=\"M3 1h7v7M1 3h7v7H1z\"/></svg></button><button class=\"x\" data-c=\"close\" title=\"Close\"><svg viewBox=\"0 0 11 11\"><path d=\"M1 1l9 9M10 1l-9 9\"/></svg></button>';" +
  "document.body.appendChild(b);" +
  "b.onclick=function(e){var k=e.target.closest('button');if(k&&window.vpShell)window.vpShell.cmd(k.dataset.c)};" +
  "window.__vpFs=function(on){b.style.display=on?'flex':'none';document.documentElement.classList.toggle('vpfs',!!on);};})();";
function fsBar() {
  if (!win || win.isDestroyed() || !win.webContents.getURL().startsWith('https://script.google.com/')) return;
  win.webContents.executeJavaScript(FSBAR).then(fsState).catch(() => {});
}
function fsState() {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript('window.__vpFs&&window.__vpFs(' + win.isFullScreen() + ')').catch(() => {});
}

// ---- self-update of the desktop app itself (GitHub Releases) ----
let updateReady = false;
function updateNotice() {
  if (!updateReady || !win || win.isDestroyed()) return;
  const js = "(function(){if(document.getElementById('vp-upd'))return;var d=document.createElement('div');d.id='vp-upd';" +
    "d.textContent='A new VentaPro update is ready \u2014 it will install automatically when you close the app.';" +
    "d.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;background:#16264A;color:#EEF2FF;" +
    "border:1px solid #E4B94A;border-radius:10px;padding:10px 16px;font:13px Segoe UI,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)';" +
    "document.body.appendChild(d);setTimeout(function(){d.remove()},12000);})();";
  win.webContents.executeJavaScript(js).catch(() => {});
}
function setupUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', () => { updateReady = true; updateNotice(); });
  autoUpdater.on('error', () => { /* offline or GitHub unreachable: try again later */ });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 15000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  loadCachedCfg();
  createSplash();
  refreshCfg();
  session.defaultSession.clearCache().finally(createMain);
  setupUpdates();
});
app.on('window-all-closed', () => app.quit());
