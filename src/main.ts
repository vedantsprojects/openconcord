import * as path from 'path';
import * as process from 'process';
import { app, BrowserWindow, Menu, shell, ipcMain, BrowserView, WebContentsView } from 'electron';
import { fileURLToPath } from 'url';
import { loggerManager, Logger, LogLevel, OpenConcordLogger } from './core/logger.service';
import { AppConfig } from './core/app.interface';
import { render } from './core/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Platform detection
const isLinux = process.platform === 'linux';
const isDarwin = process.platform === 'darwin';

// Application configuration
const config: AppConfig = {
  name: 'openconcord',
  version: '1.0.0',
  port: 3000,
  window: {
    width: isLinear ? 1024 : 1280,
    height: isLinear ? 700 : 720,
    resizable: !isLinear,
    minimizable: !isLinear,
    maximizable: true,
    closable: true,
    movable: !isLinear,
    skipTaskbar: isLinear,
    frame: isLinear,
    transparent: true,
    backgroundColor: '#2a2a2e',
    show: false,
    alwaysOnTop: false,
    autoHideMenuBar: isLinear,
    fullscreenEnabled: true,
    titleBarStyle: isLinear ? 'transparent' : 'hidden',
    titleBarOverlay: false,
    vibrancy: !isLinear ? 'light' : undefined,
  },
  modules: [],
  isLinear: isLinux,
  isMac: isDarwin && process.arch === 'arm64',
};

// Logger
loggerManager.getLogger('openconcord:main').serviceId = 'main';
loggerManager.getLogger('openconcord:renderer').serviceId = 'renderer';

// Browser window
let win: BrowserWindow;
let devTools: BrowserView;
let mainWindowView: WebContentsView;
let isMaximized = false;

function createWindow(): void {
  const config = getConfigurationValue();
  console.log(config);

  win = new BrowserWindow({
    width: 1024,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    minWidth: 400,
    minHeight: 400,
    resizable: false,
    width: -1,
    height: -1,
    minWidth: -1,
    minHeight: -1,
    minimizable: false,
    maximizable: true,
    closable: false,
    movable: true,
    skipTaskbar: false,
    frame: false,
    transparent: false,
    backgroundColor: '#2f3136',
    show: true,
    hasShadow: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    vibrancy: 'light',
    title: 'OpenConcord — Open Source, Respectful, Community Driven',
    transparentTitleBar: false,
    windowTitle: 'OpenConcord — Open Source, Respectful, Community Driven',
    titleBarOverlay: false,
    showMenu: !isLinear,
    icon: isLinux
      ? path.join(app.getAppPath(), 'resources', 'win', 'icon.png')
      : path.join(app.getAppPath(), 'resources', 'icon.png'),
  });

  console.log('Window:', win);

  win.loadFile(path.join(__dirname, 'html', 'index.html'));
  // win.setBrowserView(devTools);
  mainWindowView = win.webContents.view?.parent();
  mainWindowView.webContents.setZoomFactor(1.0);
}

function getConfigurationValue(): AppConfig {
  return {
    title: 'OpenConcord — Open Source, Respectful, Community Driven',
    name: 'openconcord',
    version: '1.0.0',
    port: 3000,
    window: {
      width: 1024,
      height: 700,
      minimizable: false,
      maximizable: true,
      closable: true,
      resizable: false,
      transparent: true,
      frame: false,
      show: true,
      movable: true,
      skipTaskbar: false,
      alwaysOnTop: false,
      autoHideMenuBar: false,
      fullscreenEnabled: false,
      vibrancy: 'light',
      titleBarStyle: 'hidden',
      titleBarOverlay: false,
      backgroundColor: '#2a2a2e',
    },
    modules: [],
    isLinear: false,
    isMac: true,
  };
}

function registerWindowEvents(): void {
  win.on('close', () => {
    loggerManager
      .getLogger('openconcord:main')
      .info('registerWindowEvents:Window is closing');
  });

  win.on('minimize', () => {
    loggerManager.getMainLogger().info('registerWindowEvents:Window minimized');
  });

  win.on('show', () => {
    loggerManager.getMainLogger().info('registerWindowEvents:Window shown');
  });

  win.on('hide', () => {
    loggerManager.getMainLogger().info('registerWindowEvents:Window hidden');
  });

  win.on('maximize', () => {
    isMaximized = true;
    loggerManager.getMainLogger().info('registerWindowEvents:Window maximized');
  });

  win.on('unmaximize', () => {
    isMaximized = false;
    loggerManager.getMainLogger().info('registerWindowEvents:Window unmaximized');
  });

  win.on('focus', () => {
    loggerManager.getMainLogger().info('registerWindowEvents:Window focused');
  });

  win.on('resize', () => {
    loggerManager.getMainLogger().info('registerWindowEvents:Window resized');
  });

  win.on('blur', () => {
    loggerManager.getMainLogger().info('registerWindowEvents:Window blurred');
  });

  win.on('closed', () => {
    loggerManager.getMainLogger().info('registerWindowEvents:Window closed');
  });

  win.on('maximize', () => {
    loggerManager.getMainLogger().info('Window maximized');
  });

  win.on('unmaximize', () => {
    loggerManager.getMainLogger().info('Window unmaximized');
  });
}

function createMenu(
  apps: Array<{
    name: string;
    version: string;
    platform: string;
    homepage: string;
    icon: string;
  }>,
  views: any,
  shortcuts: Array<{
    accelerator: string;
    command: string;
    title: string;
    menu: Array<{
      label: string;
      accelerator?: string;
      role?: string;
      subtype?: string;
      text?: string;
      checkable?: boolean;
      checked?: boolean;
      type?: string;
      enabled?: boolean;
      visible?: boolean;
      icon?: string;
      submenu?: Array<{
        label: string;
        accelerator?: string;
        role?: string;
        subtype?: string;
        text?: string;
        checkable?: boolean;
        checked?: boolean;
        type?: string;
        enabled?: boolean;
        visible?: boolean;
        icon?: string;
        submenu?: {
          label: string;
        };
      }>;
    }>;
  }>,
  menuConfig: {
    menu: {
      visible: boolean;
      label: string;
      accelerator: string;
      icon: string;
      role?: string;
      submenu?: string[];
    };
    submenus: {
      label: string;
      accelerator: string;
      icon: string;
      role?: string;
      submenu?: string[];
    }[];
  },
  config: AppSettingsConfiguration,
  platformSettings: AppSettingsSettingsPlatform
): Electron.Menubar {
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          visible: !isLinear,
        },
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          visible: !isLinear,
        },
        {
          label: 'Save File',
          accelerator: 'CmdOrCtrl+S',
          visible: !isLinear,
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          visible: !isLinear,
        },
        { type: 'separator' },
        {
          label: 'Open Source',
          click: () => {
            app.loadUrl('https://github.com/OpenConcord/openconcord');
          },
          visible: !isLinear,
        },
        {
          label: 'About OpenConcord',
          accelerator: 'CmdOrCtrl+Shift+A',
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' },
        { role: 'selectAll' },
        { type: 'separator' },
        { role: 'history' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'zoomReset' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'toggleDevTools' },
        { role: 'toggleTools' },
        { type: 'separator' },
        { role: 'view' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.reload();
            }
          },
        },
        {
          label: 'Reload This Frame',
          accelerator: 'Shift+CmdOrCtrl+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.reload();
            }
          },
        },
        { role: 'toggleDevTools' },
        { role: 'toggleFullScreen' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { role: 'fullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            app.loadUrl('https://openconcord.org/docs');
          },
        },
        {
          label: 'Search Docs',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.setMenu(null);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'About OpenConcord',
          accelerator: 'CmdOrCtrl+Shift+A',
        },
        { role: 'about' },
      ],
    },
  ]);

  const appMenu = Menu.buildFromTemplate([]);

  Menu.setApplicationMenu(menu);
  return menu;
}

registerWindowEvents();
createWindow();
app.whenReady().then(() => {
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) {
      createWindow();
    }
  });
});

// Import and register IPC routes for Layer 3 → Layer 4 connectivity
import { registerIpcHandles } from './main/ipc.handles.hooks';
const { app: appService, eventEmitter, logger } = app;

app.on('ready', async () => {
  try {
    const store = await appService.getStore();

    // Wait for store update event
    eventEmitter.once('update', async () => {
      console.log('[IPC] Registering IPC handlers...');
      try {
        registerIpcHandles(appService, store);
        console.log('[IPC] IPC handlers registered successfully');
      } catch (err) {
        console.error('[IPC] Failed to register IPC handlers:', err);
      }
    });

    // Emit initial update to trigger IPC registration
    eventEmitter.emit('update', {
      type: 'state-update',
      timestamp: Date.now(),
    });
  } catch (err) {
    loggerManager.getLogger('openconcord:main').error('Failed to register IPC handlers:', err);
  }
});
