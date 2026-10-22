import React, { useEffect, useState, useRef, useCallback, memo, Suspense, lazy } from 'react';
import { ipcRenderer, webFrame, BrowserWindow } from 'electron';
import { WindowConfig } from '../core.interface';
import { ChannelSidebar } from './components/ChannelSidebar';

// UI Theme hook via IPC
export function useWindow(): {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  focus: () => void;
  show: () => void;
  hide: () => void;
  resize: (width: number, height: number) => void;
} {
  const config = ipcRenderer.invoke('window-config') as WindowConfig | null;
  const title = config?.title ?? '';

  return {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    focus: () => ipcRenderer.send('window-focus'),
    show: () => ipcRenderer.send('window-show'),
    hide: () => ipcRenderer.send('window-hide'),
    resize: (width: number, height: number) => {
      webFrame.setBounds({ width, height });
    },
  };
}

// App Settings hook via IPC
export function useAppSettings(): {
  appConfig: {
    name: string;
    version: string;
    port: number;
    window: {
      width: number;
      height: number;
      minimizable: boolean;
      alwaysOnTop: boolean;
    };
    modules: Array<{
      name: string;
      version?: string;
      enabled: boolean;
    }>;
  };
} {
  const [appConfig, setAppConfig] = React.useState({
    name: '',
    version: '1.0.0',
    port: 3000,
    window: {
      width: 1280,
      height: 720,
      minimizable: false,
      alwaysOnTop: false,
    },
    modules: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const handle = (event: Electron.IpcRendererEvent, data: unknown) => {
      setAppConfig((prev) => ({ ...prev, ...data }));
      setLoading(false);
    };
    ipcRenderer.on('app-settings-update', handle);
    return () => ipcRenderer.removeAllListeners('app-settings-update');
  }, []);

  return { appConfig, loading };
}

// System Theme hook
export function useSystemTheme(): ['light' | 'dark' | 'auto', string] {
  const [theme, setColor] = React.useState<'light' | 'dark' | 'auto'>('auto');
  const currentColorScheme: string = '';

  function updateColorScheme(): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    color = mediaQuery.matches ? 'dark' : 'light';
    theme = mediaQuery.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', color);
  }

  // Initial color-scheme check
  updateColorScheme();

  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateColorScheme);
  }

  return [theme, currentColorScheme];
}

// Window Config hook via IPC
export function useWindowConfig(): {
  get(): WindowConfig;
  set(config: WindowConfig): void;
  setTopmost: (topmost: boolean) => void;
} {
  const [config, setConfig] = React.useState<WindowConfig | null>(null);

  const getConfig = useCallback(() => config as WindowConfig, [config]);

  useEffect(() => {
    const handle = (event: Electron.IpcRendererEvent, data: WindowConfig) => {
      setConfig(data);
    };
    ipcRenderer.on('window-config-update', handle);
    return () => ipcRenderer.removeAllListeners('window-config-update');
  }, []);

  return {
    get: getConfig,
    set: (config_: WindowConfig) => ipcRenderer.send('window-set-config', config_),
    setTopmost: (topmost: boolean) => ipcRenderer.send('window-set-topmost', topmost),
  };
}

// Menu hook
export function useAppMenu(): Record<string, () => void> {
  return {
    File: () => {
      const menu = ipcRenderer.invoke('menu-get');
      if (menu && typeof menu === 'object') {
        ipcRenderer.invoke('menu-serialize').then((serialized: string) => {
          let template: Array<Electron.MenuItemConstructorOptions> = [];
          try {
            template = JSON.parse(serialized);
          } catch {
            // Use default menu template
          }
          const { Menu } = require('electron');
          const menuObj = Menu.buildFromTemplate(template);
          menuObj.popup({});
        });
      }
    },
    Edit: () => {
      const menuTemplate = [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectall' },
      ];
      const { Menu } = require('electron');
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({});
    },
    View: () => {
      const menuTemplate = [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Reload This Frame', accelerator: 'Shift+CmdOrCtrl+R', role: 'reload' },
        { label: 'Toggle Developer Tools', accelerator: 'Alt+CmdOrCtrl+D', role: 'toggleDevTools' },
      ];
      const { Menu } = require('electron');
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({});
    },
    Help: () => {
      const menuTemplate = [
        {
          label: 'About OpenConcord',
          accelerator: 'F1',
          click: () => {
            const dialog = require('electron/dialog');
            dialog.showMessageBox({
              type: 'info',
              title: 'About OpenConcord',
              message: 'OpenConcord v1.0.0',
              detail: 'An open-source, respectful alternative to Discord.',
              buttons: ['OK'],
            });
          },
        },
        { role: 'about' },
      ];
      const { Menu } = require('electron');
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({});
    },
  };
}

// --- Layer 4: Service-Connected UI Hooks ---

// MessageManagerService UI hook - gets message data via IPC
export function useMessageManager() {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [currentChannel, setCurrentChannel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to IPC updates
  useEffect(() => {
    const onMessages = (event: Electron.IpcRendererEvent, data: { messages: MessageData[]; currentChannel: string }) => {
      setMessages(data.messages);
      setCurrentChannel(data.currentChannel);
      setIsLoading(false);
    };

    const onSelectionUpdate = (event: Electron.IpcRendererEvent, data: { currentChannel: string }) => {
      setCurrentChannel(data.currentChannel);
    };

    ipcRenderer.on('messages-update', onMessages);
    ipcRenderer.on('channel-selection-update', onSelectionUpdate);

    // Initial fetch
    ipcRenderer.invoke('messages-fetch').then((data: MessageData[]) => {
      setMessages(data);
      setIsLoading(false);
    }).catch((err) => {
      console.error('Failed to fetch messages:', err);
      setIsLoading(false);
    });

    return () => {
      ipcRenderer.removeListener('messages-update', onMessages);
      ipcRenderer.removeListener('channel-selection-update', onSelectionUpdate);
    };
  }, []);

  return {
    messages,
    currentChannel,
    isLoading,
    refreshMessages: () => ipcRenderer.invoke('messages-fetch'),
  };
}

// ModalService UI hook
export function useModalService() {
  const [modals, setModals] = useState<ModalData[]>([]);

  useEffect(() => {
    const onModalUpdate = (event: Electron.IpcRendererEvent, data: { modals: ModalData[] }) => {
      setModals(data.modals);
    };

    ipcRenderer.on('modals-update', onModalUpdate);

    // Initial fetch
    ipcRenderer.invoke('modals-fetch').then((data: ModalData[]) => {
      setModals(data);
    }).catch((err) => {
      console.error('Failed to fetch modals:', err);
    });

    return () => ipcRenderer.removeListener('modals-update', onModalUpdate);
  }, []);

  return modals;
}

// SearchRegistry UI hook
export function useSearchRegistry() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        const el = inputRef.current;
        if (el) {
          el.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await ipcRenderer.invoke('search-fetch', searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    if (value.trim()) {
      performSearch(value);
    } else {
      setSearchResults([]);
    }
  }, [performSearch]);

  return {
    searchResults,
    query,
    isSearching,
    performSearch,
    inputRef,
    setSearchResults,
  };
}

// --- Types ---
export interface MessageData {
  id: string;
  channelId: string;
  guildId: string;
  author: { id: string; name: string; discriminator: string; avatar?: string };
  content: string;
  timestamp: string;
  pinned: boolean;
}

export interface ModalData {
  id: string;
  type: 'settings' | 'members' | 'channels' | 'users' | 'roles';
  title: string;
  isOpen: boolean;
}

export interface SearchResult {
  id: string;
  type: 'message' | 'user' | 'channel' | 'user_group' | 'role' | 'emojiset';
  name: string;
  guildId: string;
  typeRaw: number;
}

// --- Main App Component ---

interface AppProps {
  children: React.ReactNode;
}

const ModalComponent = memo(function ModalComponent({ modals }: { modals: ModalData[] }) {
  const visibleModal = modals.find((m) => m.isOpen);

  if (!visibleModal) return null;

  return (
    <Teleport to="body">
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => {}}>
        <div className="bg-[#313338] border border-[#26272d] rounded-lg shadow-2xl w-full max-w-lg mx-4">
          <div className="flex items-center justify-between p-4 border-b border-[#26272d]">
            <span className="text-white font-semibold">{visibleModal.title}</span>
            <button
              className="text-[#9a9a9a] hover:text-white"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                ipcRenderer.send('modals-close', visibleModal.id);
              }}
            >
              ✕
            </button>
          </div>
          <div className="p-4">Modal content area</div>
        </div>
      </div>
    </Teleport>
  );
});

const SearchBar = memo(function SearchBar() {
  const { query, setQuery, inputRef, isSearching } = useSearchRegistry();

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        🔍
      </div>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        className="w-full pl-8 pr-4 py-2 bg-[#40444b] border border-[#26272d] rounded-md text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="/search (press / to focus)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {isSearching && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="text-blue-400 text-sm">Searching...</span>
        </div>
      )}
      {query && !isSearching && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer">
          <span className="text-[#9a9a9a] hover:text-white">✕</span>
        </div>
      )}
    </div>
  );
});

const MessageList = memo(function MessageList({ messages }: { messages: MessageData[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#9a9a9a] mb-2">👋</div>
          <div className="text-[#dbdee1] text-lg">OpenConcord</div>
          <p className="text-[#747f8d] text-sm mt-2">Select a channel to begin chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="group flex pr-4 py-[4px] hover:bg-[#313338] px-2 -mx-2 rounded-sm cursor-pointer"
          tabIndex={0}
        >
          <img
            src={msg.author.avatar || `https://cdn.openconcord.app/avatars/${msg.author.discriminator}.png`}
            alt={msg.author.name}
            className="w-10 h-10 rounded-full mr-[10px] flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline mb-0.5">
              <span className="text-white font-medium text-sm" title={msg.author.name}>
                {msg.author.name}
              </span>
              <span className="text-[#72767d] text-xs ml-2">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="text-[#dbdee1] text-sm leading-6">{msg.content}</div>
          </div>
        </div>
      ))}
    </div>
  );
});

const AppContent = memo(function AppContent({ children }: { children: React.ReactNode }) {
  const { appConfig, loading } = useAppSettings();
  const { messages, currentChannel, isLoading } = useMessageManager();
  const modals = useModalService();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#313338]">
        <div className="text-white text-lg">Loading app...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-[#313338]">
      <ChannelSidebar
        channels={[]}
        currentChannelId={currentChannel}
        onSelectChannel={() => {}}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
});

let webContentsRef: Electron.WebContents | null = null;

// This is called by React when the first component is mounted (first pass only).
export function useInit(): { children: React.ReactNode } {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (webContentsRef) return;
    webContentsRef = process.parent.webContents;
  }, []);

  if (isInitialized && webContentsRef) {
    try {
      webContentsRef.send('ready');
      setIsInitialized(false);
    } catch {
      // Ignore
    }
  }

  return { children: null };
}

function App() {
  const { close, minimize, maximize, show, hide } = useWindow();
  const appMenu = useAppMenu();
  const { children: initContent } = useInit();

  // Window event listeners via IPC
  useEffect(() => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getMainWindow();

    if (win) {
      win.on('minimize', () => {
        minimize();
        event.preventDefault();
      });
      win.on('maximize', () => {
        maximize();
        event.preventDefault();
      });
      win.on('close', () => {
        close();
        event.preventDefault();
        webContentsRef = null;
      });
    }

    ipcRenderer.on('window-minimize', () => {
      minimize();
    });
    ipcRenderer.on('window-maximize', () => {
      maximize();
    });
    ipcRenderer.on('window-close', () => {
      close();
    });
    ipcRenderer.on('window-show', () => {
      show();
    });
    ipcRenderer.on('window-hide', () => {
      hide();
    });

    return () => {
      win?.removeAllListeners('minimize');
      win?.removeAllListeners('maximize');
      win?.removeAllListeners('close');
      ipcRenderer.removeListener('window-minimize', () => minimize());
      ipcRenderer.removeListener('window-maximize', () => maximize());
      ipcRenderer.removeListener('window-close', () => close());
      ipcRenderer.removeListener('window-show', () => show());
      ipcRenderer.removeListener('window-hide', () => hide());
    };
  }, [minimize, maximize, close, show, hide]);

  return (
    <AppContent>
      <Suspense fallback={null}>
        {initContent}
        <SearchBar />
        {modals.length > 0 && <ModalComponent modals={modals} />}
      </Suspense>
    </AppContent>
  );
}

export default App;

// @ts-ignore - Teleport is a custom HTML element we're assuming exists on body
function Teleport({ children }: { children: React.ReactNode }) {
  return <section>{children}</section>;
}
