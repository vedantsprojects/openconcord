import * as path from 'path';
import * as fs from 'fs';
import { LoggerManager, loggerManager, LogLevel, OpenConcordLogger } from './logger.service';
import { IPCBridge } from './ipc';

export interface AppConfig {
  name: string;
  version: string;
  port: number;
  window: {
    width: number;
    height: number;
    minimizable: boolean;
    maximizable: boolean;
    closable: boolean;
    resizable: boolean;
    transparent: boolean;
    frame: boolean;
    title: string;
    show: boolean;
  };
  modules: string[];
}

export interface AppState {
  readonly name: string;
  readonly version: string;
  readonly store: {
    readonly name: string;
    readonly engine: 'disk' | 'memory';
    readonly ready: boolean;
    readonly initialized: boolean;
  };
  readonly ipc: {
    readonly bridge: IPCBridge;
    readonly ready: boolean;
  };
}

export class App {
  static readonly NAME = 'openconcord';
  static readonly VERSION = '1.0.0';

  private static readonly CONFIG_FILE = 'app.json';
  private static readonly APP_DIR = process.env.ARAMBH_WORKSPACE_ROOT || '/Users/macos/Downloads/arambh-opencode-local-harness-v2/workspace/Discord/openconcord';

  private static readonly logger = loggerManager.getMainLogger();

  private readonly appId: string;
  private readonly configPath: string;
  private readonly appConfigPath: string;
  private readonly storeConfigPath: string;

  private config: Record<string, unknown> = {
    name: 'openconcord',
    version: '1.0.0',
    port: 3000,
    window: {
      width: 1280,
      height: 720,
      minimizable: false,
      maximizable: true,
      closable: true,
      resizable: true,
      transparent: false,
      frame: false,
      show: true,
    },
    modules: [],
  };

  private appConfig: AppConfig = {
    name: 'openconcord',
    version: '1.0.0',
    port: 3000,
    window: {
      width: 1280,
      height: 720,
      minimizable: false,
      maximizable: true,
      closable: true,
      resizable: true,
      transparent: false,
      frame: false,
      show: true,
    },
    modules: [],
  };

  private storeConfig: Record<string, unknown> = {};

  private logger: OpenConcordLogger;
  private static readonly IPC: IPCBridge = new IPCBridge({
    logLevel: LogLevel.INFO,
  });

  constructor(appId: string) {
    this.appId = appId;
    this.appConfigPath = path.join(App.AppDir, 'config', 'app.json');
    this.storeConfigPath = path.join(App.AppDir, 'config', 'store.json');
    this.configPath = path.join(App.AppDir, 'config', 'config.json');
    this.logger = loggerManager.getLogger('openconcord:app');

    try {
      if (!fs.existsSync(path.join(App.AppDir, 'config'))) {
        fs.mkdirSync(path.join(App.AppDir, 'config'), { recursive: true });
      }
    } catch (err) {
      this.logger.error('Failed to create config directory');
    }

    // Load config
    this._loadAppConfig();
  }

  private static get AppDir(): string { return App.AppDir; }

  private _loadAppConfig(): void {
    // Load app config
    try {
      if (fs.existsSync(this.appConfigPath)) {
        const content = fs.readFileSync(this.appConfigPath, 'utf-8');
        this.appConfig = { ...this.appConfig, ...JSON.parse(content) } as AppConfig;
      }
    } catch (error) {
      this.logger.error('Failed to load app config', error);
    }

    // Load store config
    try {
      if (fs.existsSync(this.storeConfigPath)) {
        const content = fs.readFileSync(this.storeConfigPath, 'utf-8');
        this.storeConfig = { ...this.storeConfig, ...JSON.parse(content) };
      }
    } catch (error) {
      this.logger.error('Failed to load store config', error);
    }

    // Load main config
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        this.config = { ...this.config, ...JSON.parse(content) };
      }
    } catch (error) {
      this.logger.error('Failed to load config', error);
    }

    // If no app config, use default
    if (!this.appConfig.name || !this.appConfig.version) {
      this.appConfig = {
        name: 'openconcord',
        version: '1.0.0',
        port: this.config.port || 3000,
        window: this.config.window ?? {
          width: this.config.window?.width || 1280,
          height: this.config.window?.height || 720,
          minimizable: false,
          maximizable: true,
          closable: true,
          resizable: true,
          transparent: false,
          frame: false,
          show: true,
        },
        modules: [],
      };
    }
  }

  private _saveAppConfig(): void {
    try {
      fs.writeFileSync(this.appConfigPath, JSON.stringify(this.appConfig, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to save app config', error);
    }
  }

  get config(): AppConfig {
    return this.appConfig;
  }

  get port(): number {
    return this.appConfig.port || 2000;
  }

  get name(): string {
    return this.appConfig.name;
  }

  get version(): string {
    return this.appConfig.version;
  }

  get modules(): string[] {
    return this.appConfig.modules || [];
  }

  get storeConfig(): Record<string, unknown> {
    return { ...this.storeConfig };
  }

  get appConfig(): AppConfig {
    return { ...this.appConfig };
  }

  set appConfig(config: AppConfig) {
    this.appConfig = config;
    this._saveAppConfig();
  }

  _saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to save config', error);
    }
  }

  _saveStoreConfig(config: Record<string, unknown>): void {
    try {
      fs.writeFileSync(this.storeConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to save store config', error);
    }
  }

  _loadConfig(): {
    name: string;
    version: string;
    port: number;
    window: {
      width: number;
      height: number;
      minimizable: boolean;
      maximizable: boolean;
      closable: boolean;
      resizable: boolean;
      transparent: boolean;
      frame: boolean;
      show: boolean;
    };
    modules: string[];
  } {
    return {
      name: 'open-concord',
      version: '1.0.0',
      port: 3000,
      window: {
        width: 1280,
        height: 720,
        minimizable: false,
        maximizable: true,
        closable: true,
        resizable: true,
        transparent: true,
        frame: true,
        show: true,
      },
      modules: [],
    };
  }

  _getConfigValue(
    name: string,
    defaultValue: unknown,
    defaultValueAsString?: (defaultValue: unknown) => string,
  ): unknown {
    let configValue = this.config[name];

    if (typeof configValue === 'string') {
      // Check user config directory
      const userConfigPath = path.join(this.appDir, 'config', 'user-config.json');
      try {
        if (fs.existsSync(userConfigPath)) {
          const content = fs.readFileSync(userConfigPath, 'utf-8');
          const userConfig = JSON.parse(content);
          if (userConfig[name] !== undefined) {
            configValue = userConfig[name];
          }
        }
      } catch (error) {
        this.logger.error(`Failed to load user config value for ${name}`, error);
        return defaultValue;
      }
    }

    try {
      if (defaultValue.toString === defaultNumber) {
        return parseInt(configValue.replace(/,/g, ''), 10) || defaultValue;
      }
      if (defaultValue.toString === defaultBoolean) {
        return configValue === 'true' || configValue === true || configValue === 1;
      }
      return configValue;
    } catch (_error) {
      return defaultValue;
    }
  }

  _updateConfigValue(name: string, value: unknown): void {
    this.config[name] = value;
  }

  _saveConfigValue(name: string, value: unknown): void {
    const userConfigPath = path.join(this.appDir, 'config', 'user-config.json');
    try {
      let userConfig: Record<string, unknown> = {};
      if (fs.existsSync(userConfigPath)) {
        userConfig = JSON.parse(fs.readFileSync(userConfigPath, 'utf-8'));
      }
      userConfig[name] = value;
      fs.writeFileSync(userConfigPath, JSON.stringify(userConfig, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error(`Error saving config value "${name}"`, error);
      return;
    }
  }

  _readConfigFile(filename: string): { name: string; version: string; port: number; window: object; modules: Array<string> } | null {
    try {
      const configPath = path.join(this.appDir, 'config', filename);
      if (!fs.existsSync(configPath)) return null;

      const content = fs.readFileSync(configPath, 'utf-8');
      const config: Record<string, unknown> = JSON.parse(content);
      return {
        name: config.name || 'open-concord',
        version: config.version || '1.0.0',
        port: (config.port as number) || 2000,
        window: config.window || {
          width: 1280,
          height: 720,
          minimizable: false,
          maximizable: true,
          closable: true,
          resizable: true,
          transparent: true,
          frame: true,
          show: true,
        },
        modules: config.modules || [],
      };
    } catch (error) {
      this.logger.warn(`Failed to read config file: ${filename}`, error);
      return null;
    }
  }

  _readConfigFiles(): Record<string, unknown> {
    try {
      const configPath = path.join(this.appDir, 'config', 'config.json');
      if (!fs.existsSync(configPath)) {
        return {};
      }

      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.warn('Failed to read config files', error);
      return {};
    }
  }

  _setConfigValue(key: string, value: unknown): void {
    const configPath = path.join(this.appDir, 'config', 'config.json');

    try {
      let config: Record<string, unknown> = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }

      config[key] = value;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error(`Failed to set config value "${key}"`, error);
    }
  }

  _writeConfig(config: Record<string, unknown>): void {
    const configPath = path.join(this.appDir, 'config', 'config.json');

    try {
      if (fs.existsSync(configPath)) {
        // Merge with existing config
        const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        fs.writeFileSync(configPath, JSON.stringify({ ...existingConfig, ...config }, null, 2), 'utf-8');
      } else {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      }
    } catch (error) {
      this.logger.warn('Failed to write config file', error);
    }
  }

  _loadConfig(): { name: string; version: string; port: number; window: object; modules: Array<string> } {
    return {
      name: 'open-concord',
      version: '1.0.0',
      port: 3000,
      window: {
        width: 1280,
        height: 720,
        minimizable: false,
        maximizable: true,
        closable: true,
        resizable: true,
        transparent: true,
        frame: true,
        show: true,
      },
      modules: [],
    };
  }

  _getConfigValue(key: string, defaultValue?: unknown, defaultValueAsString?: (defaultValue: unknown) => string): unknown {
    const configPath = path.join(this.appDir, 'config', 'config.json');

    try {
      let config: Record<string, unknown> = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }

      return config[key] !== undefined ? config[key] : defaultValue;
    } catch (error) {
      this.logger.warn(`Failed to fetch config value "${key}"`, error);
      return defaultValue;
    }
  }

  _getConfigKeys(): string[] {
    try {
      const configPath = path.join(this.appDir, 'config', 'config.json');
      if (!fs.existsSync(configPath)) return [];

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return Object.keys(config);
    } catch (error) {
      this.logger.warn('Failed to read all config keys', error);
      return [];
    }
  }

  _removeConfigValue(key: string): void {
    const configPath = path.join(this.appDir, 'config', 'config.json');

    try {
      let config: Record<string, unknown> = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }

      delete config[key];
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      this.logger.warn(`Failed to remove config value "${key}"`, error);
    }
  }

  _getConfigValues(): Record<string, unknown> {
    try {
      const configPath = path.join(this.appDir, 'config', 'config.json');
      if (!fs.existsSync(configPath)) return {};

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...config };
    } catch (error) {
      this.logger.warn('Failed to read all config values', error);
      return {};
    }
  }

  _updateConfig(config: Record<string, unknown>): void {
    const configPath = path.join(this.appDir, 'config', 'config.json');

    try {
      let existingConfig: Record<string, unknown> = {};
      if (fs.existsSync(configPath)) {
        existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }

      const updatedConfig = { ...existingConfig, ...config };
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to update config', error);
    }
  }

  _getAppDirectory(): string {
    return process.env.ARAMBH_WORKSPACE_ROOT || '/Users/macos/Downloads/arambh-opencode-local-harness-v2/workspace/Discord/openconcord';
  }

  private static get AppDir(): string {
    return process.env.ARAMBH_WORKSPACE_ROOT || '/Users/macos/Downloads/arambh-opencode-local-harness-v2/workspace/Discord/openconcord';
  }
}

const defaultNumber = (val: unknown): number => parseInt(String(val), 10) || 0;
const defaultBoolean = (val: unknown): boolean => val === 'true' || val === true || val === 1;

export const app = new App('app');
