/**
 * @fileoverview Test suite for the App service layer.
 * Application lifecycle, window management, and config management.
 */

import { AppService } from "../core/app.service";

describe("AppService", () => {
  let appService: AppService;
  let mockConfigService: {
    set: (appName: string, value: object) => void;
    get: (appName: string) => object;
  };

  beforeEach(() => {
    // Create a mock config service
    mockConfigService = {
      set: jest.fn(),
      get: jest.fn(),
    } as any;

    appService = new AppService("AppService", mockConfigService as any);
  });

  afterEach(() => {
    appService.shutdown = 2;
    appService.windows = [];
    appService.closeMainWindow = jest.fn();

    // Reset all timers
    jest.clearAllMocks();
    jest.clearAllTimers();
    appService = null!;
  });

  describe("window management", () => {
    beforeEach(() => {
      // Create a mock that can return both a value and be called
      mockConfigService.get = jest.fn().mockImplementation((name: string) => {
        if (name === "appIdentifier") {
          return {
            name: "test-app",
            displayName: "Test Application",
          };
        }
        return undefined;
      });
    });

    it("initializes with no windows", () => {
      expect(appService.windows).toEqual([]);
    });

    it("creates a new window when showMainWindow is called", async () => {
      const mainWindow: any = {
        loadURL: jest.fn(),
        setBounds: jest.fn(),
        setAlwaysOnTop: jest.fn(),
        center: jest.fn(),
      };

      const mockWindow = jest.fn().mockImplementation(() => mainWindow);

      const originalBrowserWindow = BrowserWindow;
      (BrowserWindow as any) = mockWindow;

      await appService.showMainWindow();

      // Check that Window.create was called
      expect(mockWindow).toHaveBeenCalled();
      expect(appService.windows.length).toBe(1);

      // Check that Window.destroy is called on shutdown
      appService.shutdown = 2;
      appService.shutdown();

      // Check that destroy was called
      expect(mainWindow.destroy).toHaveBeenCalled();
    });

    it("does not create a window if one already exists", async () => {
      appService.windows.push({} as any);

      mockConfigService.get = jest.fn().mockImplementation((name: string) => {
        if (name === "appIdentifier") {
          return {
            name: "test-app",
            displayName: "Test Application",
          };
        }
        return undefined;
      });

      const mockWindow = jest.fn().mockImplementation(() => ({} as any).destroy);

      const mockBrowserWindow = jest.fn().mockImplementation(() => {
        return {
          loadURL: jest.fn(),
          setBounds: jest.fn(),
          setAlwaysOnTop: jest.fn(),
          center: jest.fn(),
          destroy: jest.fn(),
        };
      });

      (BrowserWindow as any) = mockBrowserWindow;

      await appService.showMainWindow();

      // Should not create a new window
      expect(mockBrowserWindow).not.toHaveBeenCalled();
      expect(appService.windows.length).toBe(1);
    });

    it("closes all windows on shutdown", () => {
      mockConfigService.get = jest.fn().mockImplementation((name: string) => {
        if (name === "appIdentifier") {
          return {
            name: "test-app",
            displayName: "Test Application",
          };
        }
        return undefined;
      });

      const window1 = { destroy: jest.fn() } as any;
      const window2 = { destroy: jest.fn() } as any;

      appService.windows = [window1, window2];

      appService.shutdown();

      expect(window1.destroy).toHaveBeenCalled();
      expect(window2.destroy).toHaveBeenCalled();
    });

    describe("config management", () => {
      it("uses the ConfigService from the app config name", () => {
        expect(appService.getConfigService).not.toBeNull();
      });

      it("uses the ConfigService to fetch the display name", () => {
        mockConfigService.get = jest.fn().mockImplementation((name: string) => {
          if (name === "appIdentifier") {
            return {
              name: "test-app",
              displayName: "Test App Display",
            };
          }
          return undefined;
        });

        expect(appService.getConfigService()).toBeDefined();
      });
    });
  });

  describe("app configuration defaults", () => {
    it("sets default app config when not provided", () => {
      const config = {
        application: {
          window: {
            alwaysOnTop: false,
            center: true,
            minWidth: 800,
            minHeight: 600,
            frame: false,
            backgroundColor: "#000000",
            transparent: true,
            hasShadow: false,
            show: false,
            showTitle: false,
            x: 500,
            y: 0,
            width: 1280,
            height: 720,
          },
        },
      };

      appService.setAppConfig(config);
      expect(appService.getAppConfig()).toEqual(config);
    });

    it("returns the application config from the store", () => {
      const appStore = appService.getStore();
      expect(appStore).not.toBeNull();
    });

    it("returns window configuration from the store", () => {
      const appStore = appService.getStore();
      expect(appStore).not.toBeNull();

      if (appStore) {
        // @ts-expect-error — accessing internal property for testing
        const appConfig = appStore.get("app", "application", {});
        expect(appConfig).toBeDefined();
      }
    });

    describe("window configuration defaults", () => {
      it("sets default window dimensions", () => {
        const config = {};
        appService.setAppConfig(config);
        expect(appService.getAppConfig().application.window.width).toBe(1280);
        expect(appService.getAppConfig().application.window.height).toBe(720);
      });

      it("sets default window position to center screen", () => {
        const config = {};
        appService.setAppConfig(config);
        const w = appService.getAppConfig().application.window;
        expect(w.x).toBeDefined();
        expect(w.y).toBeDefined();
      });

      it("sets defaults for frame and transparency", () => {
        const config = {};
        appService.setAppConfig(config);
        expect(appService.getAppConfig().application.window.frame).toBe(false);
        expect(appService.getAppConfig().application.window.transparent).toBe(true);
        expect(appService.getAppConfig().application.window.hasShadow).toBe(false);
      });

      it("sets default center behavior", () => {
        const config = {};
        appService.setAppConfig(config);
        expect(appService.getAppConfig().application.window.center).toBe(true);
      });

      it("sets default alwaysOnTop behavior", () => {
        const config = {};
        appService.setAppConfig(config);
        expect(appService.getAppConfig().application.window.alwaysOnTop).toBe(false);
      });

      it("sets default minHeight and minWidth", () => {
        const config = {};
        appService.setAppConfig(config);
        expect(appService.getAppConfig().application.window.minWidth).toBe(800);
        expect(appService.getAppConfig().application.window.minHeight).toBe(600);
      });

      it("sets default showTitle behavior", () => {
        const config = {};
        appService.setAppConfig(config);
        expect(appService.getAppConfig().application.window.showTitle).toBe(false);
      });

      it("sets default show behavior", () => {
        const config = {};
        appService.setAppConfig(config);
        expect(appService.getAppConfig().application.window.show).toBe(false);
      });

      it("sets default backgroundColor", () => {
        const config = {};
        appService.setAppConfig(config);
        expect(appService.getAppConfig().application.window.backgroundColor).toBe("#000000");
      });
    });

    describe("application config defaults", () => {
      it("sets default application name", () => {
        const config = {};
        appService.setAppConfig(config);
        const configService = appService.getConfigService();

        configService.set("app", {
          application: { name: "custom-name" },
        });

        expect(configService.get("app", "application", "name")).toBe("custom-name");

        expect(appService.getAppConfig().application.name).toBe("custom-name");
      });

      it("returns the app config from the app config service", () => {
        const mockGet = jest.fn().mockImplementation((name: string) =>
          name === "appIdentifier"
            ? {
                name: "test-app",
                displayName: "Test Application",
              }
            : "foo"
        );
      });

      it("merges the existing app config with defaults", () => {
        const config = {
          appIdentifier: {
            name: "test-app",
            displayName: "Test Application",
          },
        };

        appService.setAppConfig(config);

        expect(appService.getAppConfig()).toMatchObject(config);
      });

      it("preserves user-provided values", () => {
        const config = {
          appIdentifier: {
            name: "custom-app",
            displayName: "Custom Display",
          },
          application: {
            window: {
              width: 1920,
              height: 1080,
            },
          },
        };

        appService.setAppConfig(config);

        expect(appService.getAppConfig().application.window.width).toBe(1920);
        expect(appService.getAppConfig().application.window.height).toBe(1080);
      });
    });
  });
});
