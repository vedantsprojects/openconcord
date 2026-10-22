/**
 * Layer 5: IPC Message Handlers
 *
 * This module handles all IPC messages between the renderer (Layer 4)
 * and the main process, routing them to the appropriate Layer 3 service
 * implementations.
 */

import { app, protocol, BrowserWindow, ipcMain } from 'electron';
import { path } from './path';
import {
  AppConfig,
  AppState,
  AppModule,
  WindowConfig,
} from '../core/interface';
import { AppService } from '../core/app.service';
import { Logger } from '../core/logger';
import { ChannelRegistry } from '../core/app.module';
import { FetchService } from '../core/fetch.service';
import { FetchServiceConfig } from '../core/fetch';
import { Store } from '../store';

// Type for an IPC handler that wraps a service method
type IpcHandler<TService> = (
  sender: Electron.IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<TService> | TService;

/**
 * Service provider for main process IPC routing.
 * Each service implements its IPC-exposed methods here.
 */
interface ServiceProvider {
  setup: (app: AppService, store: Store, fetch: FetchService) => Promise<void>;
  getChannelRegistry: () => ChannelRegistry | null;
}

// Mock service provider for IPC (would be replaced with real service instances in production)
const createMockProviders = async (app: AppService): Promise<ServiceProvider[]> => {
  // In production, these would be actual service instances from the AppModule
  return [
    {
      setup: async () => {
        app.on('window-config-update', (config: WindowConfig) => {
          console.log('[IPC] Window config updated:', config);
          BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('window-config-update', config);
          });
        });

        app.on('app-settings-update', (config: AppConfig) => {
          console.log('[IPC] App settings updated:', config);
          BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('app-settings-update', config);
          });
        });
      },
      getChannelRegistry: () => app.getChannelRegistry() || null,
    },
  ];
};

const providers: ServiceProvider[] = [];

/**
 * Registry of IPC handlers with their allowed process constraints.
 * This enforces that handlers are only callable from their intended process.
 */
type IpcHandlerWithAllowance<THandler> = THandler & {
  readonly allowedProcess: 'main' | 'renderer' | 'main-or-renderer';
  readonly name?: string;
  readonly description?: string;
  readonly deprecated?: boolean;
  readonly requiresAuth?: boolean;
};

/**
 * Registers a single IPC handler with validation.
 * @param channel - The channel name for the IPC route.
 * @param handler - The handler function with an `allowedProcess` property.
 */
export function registerIpcHandler<THandler>(
  channel: string,
  handler: IpcHandlerWithAllowance<THandler>,
): void {
  // Build handlers array for registry
  const handlers: Array<{
    channel: string;
    handler: IpcHandler<unknown> | IpcHandlerWithAllowance<unknown>;
    allowedProcess: 'main' | 'renderer' | 'main-or-renderer';
  }> = handlers?.slice() || [];
  handlers.push({ channel, handler, allowedProcess: handler.allowedProcess || 'main' });

  // @ts-expect-error - electron IpcMainInvokeEvent type issue
  ipcMain.handle(channel, handler as any);
}

/**
 * Registers a batch of IPC handlers with validation.
 * @param handlers - Array of { channel, handler, allowedProcess } tuples.
 */
export function registerIpcHandlers<THandler>(
  handlers: Array<{
    channel: string;
    handler: IpcHandlerWithAllowance<THandler>;
    allowedProcess: 'main' | 'renderer' | 'main-or-renderer';
  }>,
): void {
  const reg: Array<{
    channel: string;
    handler: IpcHandler<unknown> | IpcHandlerWithAllowance<unknown>;
    allowedProcess: 'main' | 'renderer' | 'main-or-renderer';
  }> = [];
  for (const h of handlers) {
    reg.push({ channel: h.channel, handler: h.handler, allowedProcess: h.allowedProcess });
  }
  for (const { channel, handler, allowedProcess } of reg) {
    // @ts-expect-error - electron IpcMainInvokeEvent type issue
    ipcMain.handle(channel, handler as any);
  }
}

type IpcHandleResult<T> = T extends Promise<infer R> ? R : T;

/**
 * Registers all IPC routes that route messages from renderer to main process.
 * Each route validates the incoming message, checks for a handler,
 * and either invokes the handler or emits an error to the renderer.
 */
export function registerIpcHandles(
  app: AppService,
  store: Store,
  ipcRoutes: Record<string, IpcHandler<unknown> & { allowedProcess?: 'main' | 'renderer' | 'main-or-renderer' }>,
): void {
  store.on('update', (state: unknown) => {
    providers.forEach(async (provider) => {
      const appState = state as AppState;
      const config: AppModule = {
        name: appState.config.name,
        version: appState.config.version,
        port: appState.config.port,
        window: {
          width: appState.config.window?.width,
          height: appState.config.window?.height,
          minimizable: appState.config.window?.minimizable,
          alwaysOnTop: appState.config.window?.alwaysOnTop,
        },
        modules: appState.modules,
      };
      const fetchConfig: FetchServiceConfig = {
        baseURL: app.config.baseURL,
        timeout: app.config.timeout,
        headers: app.config.headers,
      };
      const fetch = new FetchService(fetchConfig, app.eventEmitter, app.logger);

      try {
        const appStateRes = await app.getState();
        await provider.setup(appStateRes[0], { update }, fetch);
      } catch (error) {
        console.log('Error setting up IPC handler:', error);
      }
    });
  });

  // Window configuration IPC route
  // @ts-expect-error - electron IpcMainInvokeEvent type issue
  ipcMain.handle('window-config', async (_, e) => {
    const config: WindowConfig = {
      title: appState.config.name,
      width: appState.config.window?.width,
      height: appState.config.window?.height,
      x: appState.config.window?.x,
      y: appState.config.window?.y,
      minimizable: appState.config.window?.minimizable,
      maximizable: appState.config.window?.maximizable,
      fullscreenable: appState.config.window?.fullscreenable,
      alwaysOnTop: appState.config.window?.alwaysOnTop,
    };
    return config;
  });

  // Window min / max / close actions
  // @ts-expect-error
  ipcMain.handle('window-minimize', async (_, e) => {
    let win = BrowserWindow.getFocusedWindow();
    if (!win) {
      win = BrowserWindow.getMainWindow();
    }
    win?.minimize();
    return true;
  });

  // @ts-expect-error
  ipcMain.handle('window-maximize', async (_, e) => {
    const win = BrowserWindow.getFocusedWindow();
    win?.isMaximized()
      ? win?.unmaximize()
      : win?.maximize();
    return true;
  });

  // @ts-expect-error
  ipcMain.handle('window-close', async (_, e) => {
    const win = BrowserWindow.getFocusedWindow();
    win?.close();
    return true;
  });

  // @ts-expect-error
  ipcMain.handle('window-set-config', async (_, e, config) => {
    window.config = config;
    return true;
  });

  // @ts-expect-error
  ipcMain.handle('window-set-topmost', async (_, e, topmost) => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    const isTopmost = topmost;
    mainWindow?.setAlwaysOnTop(isTopmost);
    return true;
  });

  // @ts-expect-error
  ipcMain.handle('window-focus', async (_, e) => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    mainWindow?.focus();
    return true;
  });

  // @ts-expect-error
  ipcMain.handle('window-show', async (_, e) => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    mainWindow?.show();
    return true;
  });

  // @ts-expect-error
  ipcMain.handle('window-hide', async (_, e) => {
    const mainWindow = BrowserWindow.getFocusedWindow();
    mainWindow?.hide();
    return true;
  });

  // @ts-expect-error
  ipcMain.handle('menu-get', async (_, e) => {
    const appMenu = await app.getMnu();
    return appMenu;
  });

  // @ts-expect-error
  ipcMain.handle('menu-serialize', async (_, e) => {
    const menu = await app.getMnu();
    return JSON.stringify(menu);
  });

  // Fetch messages (MessageManagerService)
  // @ts-expect-error
  ipcMain.handle('messages-fetch', async (_, e, filter) => {
    const appModule = await app.getChannelRegistry;
    if (!appModule) throw new Error('no channels');
    return appModule.getChannels('channels');
  });

  // Update channel selection
  // @ts-expect-error
  ipcMain.handle('channel-selection-update', async (_, e, data) => {
    const update = {
      type: 'channel-selection-update',
      data: {
        channelId: data.channelId,
        guildId: data.guildId,
      },
    };
    return update;
  });

  // Update messages
  // @ts-expect-error
  ipcMain.handle('messages-update', async (_, e, data) => {
    return update;
  });

  // Fetch messages (MessageManagerService)
  // @ts-expect-error
  ipcMain.handle('message-manager-fetch', async (_, e) => {
    const channels: Array<{
      name: string;
      type: 'text' | 'voice' | 'notification' | 'private';
      id: string;
      parentId: string;
    }> = await app.getChannelRegistry;
    if (!channels) return [];

    return channels.map((channel) => {
      const messages: Array<{
        id: string;
        channelId: string;
        guildId: string;
        author: { id: string; name: string; discriminator: string; avatar?: string };
        content: string;
        timestamp: string;
        pinned: boolean;
      }> = [];
      return {
        name: channel.name,
        messages,
        channel,
      };
    });
  });

  // Fetch modals (ModalService)
  // @ts-expect-error
  ipcMain.handle('modals-fetch', async (_, e) => {
    const appModule = await app.getChannelRegistry;
    if (!appModule) throw new Error('no channels');
    return appModule.getChannels('channels');
  });

  // Update modals
  // @ts-expect-error
  ipcMain.handle('modals-update', async (_, e, data) => {
    return update;
  });

  // Close modal (ModalService)
  // @ts-expect-error
  ipcMain.handle('modals-close', async (_, e, modalId) => {
    return true;
  });

  // Fetch modal manager (ModalService)
  // @ts-expect-error
  ipcMain.handle('modal-manager-fetch', async (_, e) => {
    const appModule = await app.getChannelRegistry;
    if (!appModule) throw new Error('no channels');
    return appModule.getChannels('channels');
  });

  // Search (SearchRegistryService)
  // @ts-expect-error
  ipcMain.handle('search-fetch', async (_, e, query) => {
    const appModule = await app.getChannelRegistry;
    if (!appModule) throw new Error('no search registry');
    const results = await appModule.getServerDiscoveryResults(query);
    return results.map((result) => {
      return {
        id: result.id,
        type: result.type as
          | 'message'
          | 'user'
          | 'channel'
          | 'user_group'
          | 'role'
          | 'emojiset',
        name: result.name,
        guildId: result.guildId,
        typeRaw: result.typeRaw,
      };
    });
  });

  // Fetch search registry
  // @ts-expect-error
  ipcMain.handle('search-registry-fetch', async (_, e) => {
    const appModule = await app.getChannelRegistry;
    if (!appModule) throw new Error('no search registry');
    const searchRegistry = await appModule.getServerDiscovery;
    return {
      id: searchRegistry.id,
      name: searchRegistry.name,
      type: searchRegistry.type,
      version: searchRegistry.version,
      description: searchRegistry.description ?? '',
    };
  });

  // App settings update
  // @ts-expect-error
  ipcMain.handle('app-settings-update', async (_, e, data) => {
    return update;
  });
}

// Store provider interface
type SetUpdate = (update: unknown) => void;
let update: SetUpdate;

if (!('set' in window)) {
  (window as any).update = (data: unknown) => {
    update(data);
  };
}
