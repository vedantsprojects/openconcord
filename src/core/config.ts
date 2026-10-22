import * as path from 'path';
import * as fs from 'fs';
import { loggerManager, LoggerManager, LogLevel } from './logger.service';

const logger = loggerManager.getLogger('openconcord:config');

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
    show: boolean;
    fullscreen?: boolean;
    x?: number;
    y?: number;
    alwaysOnTop?: boolean;
  };
  modules: string[];
  theme: 'light' | 'dark' | 'system';
  language: string;
  locale: string;
}

const DEFAULT_APP_CONFIG: AppConfig = {
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
    alwaysOnTop: false,
  },
  modules: [],
  theme: 'light',
  language: 'en',
  locale: 'en-US',
};

export class ConfigManager {
  private static readonly CONFIG_FILE = 'config.json';
  private static readonly USER_CONFIG_FILE = 'user-config.json';
  private static readonly PATH: string = path.join(
    process.env.ARAMBH_WORKSPACE_ROOT || '/Users/macos/Downloads/arambh-opencode-local-harness-v2/workspace/Discord/openconcord',
    'config'
  );

  private _config: AppConfig = { ...DEFAULT_APP_CONFIG };
  private _userConfig: Record<string, unknown> = {};
  private _defaultConfig: AppConfig = { ...DEFAULT_APP_CONFIG };

  constructor(private readonly appConfig: AppConfig) {
    this._defaultConfig = { ...appConfig };
    this.loadConfigs();
  }

  private loadConfigs(): void {
    try {
      // Load user config
      const userConfigPath = path.join(this.PATH, this.USER_CONFIG_FILE);
      if (!fs.existsSync(userConfigPath)) {
        fs.mkdirSync(this.PATH, { recursive: true });
        fs.writeFileSync(userConfigPath, JSON.stringify({}, null, 2), 'utf-8');
      }

      const userConfigContent = fs.readFileSync(userConfigPath, 'utf-8');
      this._userConfig = JSON.parse(userConfigContent);

      // Load main config
      const configPath = path.join(this.PATH, this.CONFIG_FILE);
      if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(this._defaultConfig, null, 2), 'utf-8');
      }

      const configContent = fs.readFileSync(configPath, 'utf-8');
      const partialConfig = JSON.parse(configContent);

      this._config = {
        name: this._defaultConfig.name,
        version: this._defaultConfig.version,
        port: this._defaultConfig.port,
        window: {
          ...this._defaultConfig.window,
          ...partialConfig.window,
        },
        modules: this._defaultConfig.modules,
        theme: this._defaultConfig.theme,
        language: this._defaultConfig.language,
        locale: this._defaultConfig.locale,
        ...partialConfig,
      };

      logger.info(`Config loaded successfully`, {
        configPath,
        userConfigPath,
        modules: (this._config.modules || []).length,
        theme: this._config.theme,
      });
    } catch (error) {
      logger.error('Failed to load config', error);
      this._config = { ...this._defaultConfig };
      this._userConfig = {};

      fs.mkdirSync(this.PATH, { recursive: true });
      if (!fs.existsSync(path.join(this.PATH, this.USER_CONFIG_FILE))) {
        fs.writeFileSync(
          path.join(this.PATH, this.USER_CONFIG_FILE),
          JSON.stringify({}, null, 2),
          'utf-8'
        );
      }
    }
  }

  private saveConfigs(): void {
    try {
      fs.writeFileSync(path.join(this.PATH, this.CONFIG_FILE), JSON.stringify(this._config, null, 2), 'utf-8');
      fs.writeFileSync(path.join(this.PATH, this.USER_CONFIG_FILE), JSON.stringify(this._userConfig, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save configs', error);
    }
  }

  get name(): string {
    return this._config.name;
  }

  set name(value: string) {
    this._config.name = value;
    this._saveSingle('name', value);
  }

  get version(): string {
    return this._config.version;
  }

  set version(value: string) {
    this._config.version = value;
  }

  get port(): number {
    return this._config.port;
  }

  set port(value: number) {
    this._config.port = value;
    this._saveSingle('port', value);
  }

  get window(): AppConfig['window'] {
    return { ...this._config.window };
  }

  set window(value: AppConfig['window']) {
    this._config.window = value;
    this._saveSingle('window', value);
  }

  get modules(): string[] {
    return this._config.modules || [];
  }

  set modules(value: string[]) {
    this._config.modules = value;
    this._saveSingle('modules', value);
  }

  get theme(): AppConfig['theme'] {
    return this._config.theme;
  }

  set theme(value: AppConfig['theme']) {
    this._config.theme = value;
    this._saveSingle('theme', value);
  }

  get language(): string {
    return this._config.language;
  }

  set language(value: string) {
    this._config.language = value;
    this._saveSingle('language', value);
  }

  get locale(): string {
    return this._config.locale;
  }

  set locale(value: string) {
    this._config.locale = value;
    this._saveSingle('locale', value);
  }

  getAllConfig(): AppConfig {
    return { ...this._config };
  }

  getUserConfig(): Record<string, unknown> {
    return { ...this._userConfig };
  }

  getConfigValue<T>(key: string, defaultValue?: T): T {
    const userValue = this._userConfig[key];
    if (userValue !== undefined) return userValue;
    return this._config[key] as T;
  }

  setConfigValue<T>(key: string, value: T): void {
    if (!(key in this._config)) {
      // Auto-register unknown config keys
      this._config[key] = value as any;
    }
    this._config[key] = value;
    this._userConfig[key] = value;
    this.saveConfigs();
  }

  getConfigPath(): string {
    return this.PATH;
  }

  private _saveSingle(key: string, value: unknown): void {
    const userConfigPath = path.join(this.PATH, this.USER_CONFIG_FILE);
    if (!fs.existsSync(userConfigPath)) {
      fs.writeFileSync(userConfigPath, JSON.stringify({}, null, 2), 'utf-8');
    }

    const userConfigContent = fs.readFileSync(userConfigPath, 'utf-8');
    const userConfig = JSON.parse(userConfigContent);
    userConfig[key] = value;

    fs.writeFileSync(userConfigPath, JSON.stringify(userConfig, null, 2), 'utf-8');
  }

  public get appConfig(): AppConfig {
    return { ...this._config };
  }

  public set appConfig(config: AppConfig) {
    this._config = config;
    this.saveConfigs();
  }

  public toJSON(): AppConfig {
    return JSON.parse(JSON.stringify(this._config));
  }
}

export const configManager = new ConfigManager({
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
  theme: 'light',
  language: 'en',
  locale: 'en-US',
});

export default configManager;
