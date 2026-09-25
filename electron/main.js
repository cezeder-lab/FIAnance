const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('node:path');
const { createStorage } = require('./storage');

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let storage;

function createWindow() {
  const win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'FIAnance',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d0d0d' : '#f4f4f1',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!DEV_SERVER_URL || !url.startsWith(DEV_SERVER_URL)) event.preventDefault();
  });

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function registerIpc() {
  ipcMain.handle('data:load', () => storage.loadAll());

  ipcMain.handle('data:save', (_event, name, data) => {
    storage.save(name, data);
  });

  // Synchronous variant, only used to flush pending edits while the window is closing.
  ipcMain.on('data:save-sync', (event, name, data) => {
    try {
      storage.save(name, data);
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });

  ipcMain.handle('data:backup', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const res = await dialog.showOpenDialog(win, {
      title: 'Choisir le dossier de sauvegarde',
      buttonLabel: 'Sauvegarder ici',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) return { ok: false, canceled: true };
    const files = storage.backupTo(res.filePaths[0]);
    return { ok: true, folder: res.filePaths[0], files };
  });

  ipcMain.handle('data:open-folder', () => shell.openPath(storage.dataDir));
}

app.whenReady().then(() => {
  storage = createStorage(path.join(app.getPath('userData'), 'data'));
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
