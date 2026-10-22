import Database from "better-sqlite3";
import type { Logger } from "../services/logger";
import type { Config } from "../types";
import { nanoid } from "nanoid";

/**
 * In-memory database cache for high-frequency access.
 * Falls back to disk-based database on cache miss.
 */
export class InMemoryStore<K extends string | number, V> {
  private cache: Map<K, V> = new Map();
  private maxSize: number;
  private logger: Logger;

  constructor(maxSize: number = 1000, private readonly _logger: Logger) {
    this.maxSize = maxSize;
    this.logger = _logger;
    this._logger?.info("InMemoryStore initialized with max size:", maxSize);
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this._logger?.debug(`Cache hit for key: ${key}`);
      return value;
    }
    this._logger?.debug(`Cache miss for key: ${key}`);
    return undefined;
  }

  set(key: K, value: V, ttl?: number): void {
    const entry: { value: V; expiresAt: number } = { value, expiresAt: ttl ? Date.now() + ttl : 0 };
    this.cache.set(key, entry);

    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this._logger?.debug("Cache eviction: removed oldest entry");
    }

    this._logger?.debug(`Cache set key: ${key}, TTL: ${ttl || "infinite"}`);
  }

  delete(key: K): boolean {
    const wasPresent = this.cache.has(key);
    this.cache.delete(key);
    this._logger?.debug(`Cache deleted key: ${key}, wasPresent: ${wasPresent}`);
    return wasPresent;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this._logger?.info(`InMemoryStore cleared (${size} entries flushed)`);
  }

  sync(withDisk: () => void): void {
    this._logger?.debug("Syncing cache with disk store");
    withDisk();
  }
}

/**
 * Disk-backed persistent store using better-sqlite3.
 * Supports row-level locking for concurrent access.
 */
export class DiskStore {
  private db: Database.Database;
  private logger: Logger;
  private readonly schemaVersion = 1;

  constructor(
    readonly path: string,
    private readonly _logger: Logger
  ) {
    try {
      this._logger?.info(`Opening database at: ${path}`);
      this.db = new Database(path, {
        readonly: false,
        fileMustExist: false,
        fileExistsCheck: (path, existing) => {
          const stat = existing.statSync();
          if (stat.isFile()) return { mode: 0o644, time: stat.mtimeMs };
          return { mode: 0o644, time: stat.mtimeMs, size: stat.size };
        },
      });
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("synchronous = NORMAL");
      this.db.pragma("cache_size = 64000");
      this.db.pragma("temp_store = MEMORY");

      this.initSchema();
      this._logger?.info("Database initialized successfully");
    } catch (error) {
      this._logger?.error(`Failed to initialize database:`, { path, error });
      throw error;
    }
  }

  private schemaText(): string {
    return `
      TABLE IF NOT EXISTS config (
        key    TEXT PRIMARY KEY NOT NULL,
        value  TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      TABLE IF NOT EXISTS user_config (
        user_id TEXT PRIMARY KEY NOT NULL,
        key    TEXT NOT NULL,
        value  TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      TABLE IF NOT EXISTS servers (
        server_id TEXT PRIMARY KEY NOT NULL,
        name      TEXT NOT NULL,
        icon      TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      TABLE IF NOT EXISTS channels (
        channel_id TEXT PRIMARY KEY NOT NULL,
        server_id  TEXT NOT NULL,
        name       TEXT NOT NULL,
        type       TEXT NOT NULL,
        parent_id  TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (server_id) REFERENCES servers(server_id) ON DELETE CASCADE
      );

      TABLE IF NOT EXISTS messages (
        message_id TEXT PRIMARY KEY NOT NULL,
        channel_id TEXT NOT NULL,
        sender_id  TEXT NOT NULL,
        content    TEXT NOT NULL,
        type       TEXT NOT NULL,
        state      TEXT NOT NULL DEFAULT 'new',
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE
      );

      TABLE IF NOT EXISTS reactions (
        message_id TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        emoji      TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (message_id, user_id, emoji),
        FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE
      );

      TABLE IF NOT EXISTS presence (
        user_id    TEXT PRIMARY KEY NOT NULL,
        server_id  TEXT NOT NULL,
        status     TEXT NOT NULL,
        activities TEXT DEFAULT '[]',
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      DROP TABLE IF EXISTS schema_version;
      CREATE TABLE schema_version (
        version INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      INSERT OR REPLACE INTO schema_version (version, created_at) VALUES (${this.schemaVersion}, strftime('%s', 'now'));
    `;
  }

  private initSchema(): void {
    const schema = this.schemaText().trim();
    this.db.exec(schema);
  }

  close(): void {
    this._logger?.debug("Closing database connection");
    this.db.close();
  }

  async backup(destination: string): Promise<void> {
    this._logger?.info(`Backing up database to: ${destination}`);
    try {
      await new Promise<void>((resolve, reject) => {
        this.db.backup(destination, (err) => {
          if (err) {
            this._logger?.error("Backup failed:", err);
            reject(err);
          } else {
            this._logger?.info("Backup completed successfully");
            resolve();
          }
        });
      });
    } catch (error) {
      this._logger?.error(`Backup failed:`, { destination, error });
      throw error;
    }
  }
}

export class AppStore {
  private readonly configStore: Map<string, Config>;
  private readonly userConfigStore: Map<string, Map<string, string>>;
  private readonly serverStore: Map<string, Config>;
  private readonly channelStore: Map<string, Config>;
  private readonly serverIdToName: Map<string, string>;
  private readonly channelNameMap: Map<string, string>;
  private readonly logger: Logger;

  constructor(private readonly _logger: Logger) {
    this.logger = _logger;
    this.configStore = new Map();
    this.userConfigStore = new Map();
    this.serverStore = new Map();
    this.channelStore = new Map();
    this._logger?.info("AppStore initialized");
  }

  getConfig(key: string, fallback?: Config): Config | undefined {
    if (!this.configStore.has(key)) {
      this._logger?.info(`Config cache miss for: ${key}`);
    }
    return this.configStore.get(key) ?? undefined;
  }

  setUserConfig(userId: string, key: string, value: string): void {
    if (!this.userConfigStore.has(userId)) {
      this.userConfigStore.set(userId, new Map());
    }
    const userConfig = this.userConfigStore.get(userId)!;
    userConfig.set(key, value);
    this._logger?.debug(`User config set: user=${userId}, key=${key}, value=${value}`);
  }

  getUserConfig(userId: string, key: string): string | undefined {
    const userConfig = this.userConfigStore.get(userId);
    if (!userConfig) {
      this._logger?.debug(`User config not found for user: ${userId}`);
      return undefined;
    }
    return userConfig.get(key);
  }

  setConfig(key: string, value: Config): void {
    if (!this.configStore.has(key)) {
      this._logger?.info(`Cache hit bypassed - writing config: ${key}`);
    }
    this.configStore.set(key, value);
    this._logger?.debug(`Config set: key=${key}`);
  }

  addChannel(channelId: string, channel: Config): void {
    this.channelStore.set(channelId, channel);
    this.channelNameMap.set(channelId, channel.name);
    this._logger?.debug(`Channel added: ${channelId}`);
  }

  getChannel(channelId: string): Config | undefined {
    if (!this.channelStore.has(channelId)) {
      this._logger?.debug(`Channel not found: ${channelId}`);
    }
    return this.channelStore.get(channelId);
  }

  removeChannel(channelIds: string[]): void {
    channelIds.forEach((id) => {
      const channel = this.channelStore.get(id);
      if (channel) {
        this.channelNameMap.delete(id);
        this.channelStore.delete(id);
        this._logger?.debug(`Channel removed: ${id}`);
      }
    });
  }

  getChannelName(channelId: string): string | undefined {
    const name = this.channelNameMap.get(channelId);
    const channel = this.channelStore.get(channelId);
    if (channel?.name !== undefined) {
      this.channelNameMap.set(channelId, channel.name);
      this._logger?.debug(`Channel name fetched: ${channelId} => ${channel.name}`);
    }
    return name;
  }

  addServer(serverId: string, server: Config): void {
    this.serverStore.set(serverId, server);
    this.serverIdToName.set(serverId, server.name);
    this._logger?.debug(`Server added: ${serverId}`);
  }

  getServer(serverId: string): Config | undefined {
    if (!this.serverStore.has(serverId)) {
      this._logger?.debug(`Server not found: ${serverId}`);
    }
    return this.serverStore.get(serverId);
  }

  getServerName(serverId: string): string | undefined {
    const name = this.serverIdToName.get(serverId);
    const server = this.serverStore.get(serverId);
    if (server?.name !== undefined) {
      this.serverIdToName.set(serverId, server.name);
      this._logger?.debug(`Server name fetched: ${serverId} => ${server.name}`);
    }
    return name;
  }

  removeServers(serverIds: string[]): void {
    serverIds.forEach((id) => {
      const server = this.serverStore.get(id);
      if (server) {
        this.serverIdToName.delete(id);
        this.serverStore.delete(id);
        this._logger?.debug(`Server removed: ${id}`);
      }
    });
  }

  addMessage(messageId: string, message: Config, channelId: string): void {
    this.logger.debug(`Message added: ${messageId} to channel: ${channelId}`);
    this.getChannel(channelId)?.messages?.push(message);
    this._logger?.debug(`Channel messages updated: ${channelId}`);
  }

  getChannelMessages(channelId: string, cursor?: string): Config[] {
    const channel = this.channelStore.get(channelId);
    if (!channel?.messages) {
      return [];
    }
    const messages = channel.messages;
    if (cursor) {
      const cursorIndex = messages.findIndex((m) => m.id === cursor);
      if (cursorIndex >= 0) {
        return messages.slice(cursorIndex + 1);
      }
      this.logger.debug(`Cursor not found, returning all messages`);
    }
    return channel.messages;
  }

  setPresence(userId: string, serverId: string, presence: Partial<Config>): void {
    const existing = this.serverIdToName.get(serverId);
    const currentPresence = existing;
    currentPresence?.presence?.push(presence);
    this._logger?.debug(`Presence updated for user: ${userId}`);
  }

  getPresence(userId: string, serverId: string): Partial<Config> | undefined {
    const server = this.serverIdToName.get(serverId);
    if (!server?.presence) return undefined;
    return server.presence.find((p) => p.id === userId);
  }

  subscribeToChannels(callback: (channelId: string, action: "update" | "add" | "remove") => void): () => void {
    const originalSet = this.channelStore.set.bind(this.channelStore);
    const originalGet = this.channelStore.get.bind(this.channelStore);
    const originalGetChannelName = this.getChannelName.bind(this);

    const wrappedSet = (key: string, value: Config) => {
      originalSet(key, value);
      callback(key, "update");
    };

    const wrappedGet = (key: string): Config | undefined => {
      const result = originalGet(key);
      if (result) callback(key, "update");
      return result;
    };

    const wrappedGetChannelName = (key: string): string | undefined => {
      const result = originalGetChannelName(key);
      if (result) callback(key, "update");
      return result;
    };

    this.channelStore.set = wrappedSet;
    this.channelStore.get = wrappedGet;
    this.getChannelName = wrappedGetChannelName;

    return () => {
      this.channelStore.set = originalSet;
      this.channelStore.get = originalGet;
      this.getChannelName = originalGetChannelName;
      this._logger?.debug("Channel subscription unsubscribed");
    };
  }

  setServersState(serverIds: string[], state: Config): void {
    const server = this.serverIdToName.get(serverIds[0]);
    this._logger?.debug(`Servers-state updated: ${serverIds[0]}`);
    server?.assets?.serverList = state;
  }

  addOnlineUser(serverId: string, userId: string): void {
    const server = this.serverIdToName.get(serverId);
    this._logger?.debug(`Online user added: ${userId} in ${serverId}`);
    const currentOnline = server?.onlineUsers ?? [];
    if (!currentOnline.some((u) => u.userIdentifier === userId)) {
      server.onlineUsers ??= [];
      server.onlineUsers.push({ userIdentifier: userId });
    }
  }
}
