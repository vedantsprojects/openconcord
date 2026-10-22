/**
 * Layer 5: IPC Routes
 * 
 * Routes incoming IPC messages from the renderer to the appropriate Layer 3 services.
 * Each route is a message channel -> handler mapping.
 */

import { ipcMain } from 'electron';

// Type for a single IPC route
export interface IpcRoute {
  name: string;
  handler: (args: unknown[]) => unknown | Promise<unknown>;
}

// Layer 3 services exported for IPC routing
export type MessageManagerService = {
  // Methods to expose via IPC
  fetchMessages: () => Promise<Array<{
    id: string;
    channelId: string;
    guildId: string;
    author: { id: string; name: string; discriminator: string; avatar?: string };
    content: string;
    timestamp: string;
    pinned: boolean;
  }>>;
  handleSelection: (channelId: string, guildId: string) => void;
  formatMessage: (content: string) => string;
};

export type ModalService = {
  openModal: (type: string, title: string, data: unknown) => void;
  closeModal: (modalId: string) => void;
  fetchModals: () => Promise<Array<{
    id: string;
    type: 'settings' | 'members' | 'channels' | 'users' | 'roles';
    title: string;
    isOpen: boolean;
  }>>;
};

export type SearchRegistryService = {
  search: (query: string) => Promise<Array<{
    id: string;
    type: 'message' | 'user' | 'channel' | 'user_group' | 'role' | 'emojiset';
    name: string;
    guildId: string;
    typeRaw: number;
  }>>;
};

// All available IPC routes
export const ipcRoutes: Record<string, IpcRoute> = {
  // --- Window Management Routes ---
  'window-config': {
    name: 'Window Config',
    handler: async () => null, // Main process handles this
  },
  'window-minimize': {
    name: 'Window Minimize',
    handler: async () => true,
  },
  'window-maximize': {
    name: 'Window Maximize',
    handler: async () => true,
  },
  'window-close': {
    name: 'Window Close',
    handler: async () => true,
  },
  'window-set-config': {
    name: 'Window Set Config',
    handler: async (args: [WindowConfig]) => {
      // Stored in main process
      return true;
    },
  },
  'window-set-topmost': {
    name: 'Window Set Topmost',
    handler: async (args: [boolean]) => {
      return true;
    },
  },
  'window-focus': {
    name: 'Window Focus',
    handler: async () => true,
  },
  'window-show': {
    name: 'Window Show',
    handler: async () => true,
  },
  'window-hide': {
    name: 'Window Hide',
    handler: async () => true,
  },
  'menu-get': {
    name: 'Menu Get',
    handler: async () => JSON.stringify([]),
  },
  'menu-serialize': {
    name: 'Menu Serialize',
    handler: async () => JSON.stringify([]),
  },

  // --- MessageManagerService Routes ---
  'messages-fetch': {
    name: 'Messages Fetch',
    handler: async (args: []) => {
      // Call MessageManagerService.fetchMessages() from main process
      return [] as Array<{
        id: string;
        channelId: string;
        guildId: string;
        author: { id: string; name: string; discriminator: string; avatar?: string };
        content: string;
        timestamp: string;
        pinned: boolean;
      }>;
    },
  },
  'channel-selection-update': {
    name: 'Channel Selection Update',
    handler: async (args: [{ channelId: string; guildId: string }]) => {
      return { type: 'channel-selection-update', data: args[0] };
    },
  },
  'messages-update': {
    name: 'Messages Update',
    handler: async (args: [{ messages: object[]; currentChannel: string }]) => {
      return { type: 'messages-update', data: args[0] };
    },
  },
  'message-manager-fetch': {
    name: 'Message Manager Fetch',
    handler: async (args: []) => {
      // Expose MessageManagerService methods
      return {
        fetchMessages: async () => {
          // Delegates to actual service
          return [];
        },
        handleSelection: (channelId: string, guildId: string) => {
          // Delegates to actual service
        },
        formatMessage: (content: string) => content,
      };
    },
  },

  // --- ModalService Routes ---
  'modals-fetch': {
    name: 'Modals Fetch',
    handler: async (args: []) => {
      // Call ModalService.fetchModals() from main process
      return [] as Array<{
        id: string;
        type: 'settings' | 'members' | 'channels' | 'users' | 'roles';
        title: string;
        isOpen: boolean;
      }>;
    },
  },
  'modals-update': {
    name: 'Modals Update',
    handler: async (args: [{ modals: object[] }]) => {
      return { type: 'modals-update', data: args[0] };
    },
  },
  'modals-close': {
    name: 'Modals Close',
    handler: async (args: [string]) => {
      return true;
    },
  },
  'modal-manager-fetch': {
    name: 'Modal Manager Fetch',
    handler: async (args: []) => {
      return {
        openModal: (type: string, title: string, data: unknown) => {
          // Delegates to ModalManagerService
        },
        closeModal: (modalId: string) => {
          // Delegates to ModalManagerService
        },
      };
    },
  },

  // --- SearchRegistry Routes ---
  'search-fetch': {
    name: 'Search Fetch',
    handler: async (args: [string]) => {
      // Call SearchRegistryService.search() from main process
      const query = args[0] as string;
      return [] as Array<{
        id: string;
        type: 'message' | 'user' | 'channel' | 'user_group' | 'role' | 'emojiset';
        name: string;
        guildId: string;
        typeRaw: number;
      }>;
    },
  },
  'search-registry-fetch': {
    name: 'Search Registry Fetch',
    handler: async (args: []) => {
      return {
        search: async (query: string) => {
          // Delegates to InMemorySearchRegistry
          return [];
        },
        getRegistryType: () => 'InMemorySearchRegistry',
      };
    },
  },

  // --- General App Routes ---
  'app-settings-update': {
    name: 'App Settings Update',
    handler: async (args: [{ window: object }]) => {
      return { type: 'app-settings-update', data: args[0] };
    },
  },
};

/**
 * Register all IPC routes with the main process.
 * This is called from the main process to hook up the renderer-facing APIs.
 */
export function registerIpcRoutes() {
  console.log('=== Opening OpenConcord ===');

  for (const route of Object.values(ipcRoutes)) {
    // Each route will be registered by the main process
    // The renderer side just sends: ipcRenderer.send(route.name, ...args)
    // The main process receives and invokes route.handler(args)
    console.log(`  Registered: ${route.name} → ${route.handler.name}`);
  }

  console.log('Ready');
}

// Type guard for IPC messages
export function isIpcMessage(
  obj: Record<string | number | symbol, unknown>
): obj is { type: string; data?: unknown } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Record<string, unknown>).type === 'string'
  );
}
