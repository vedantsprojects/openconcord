/**
 * @fileoverview Test suite for the Configuration service layer.
 * Type-safe configuration management with user/app/userStore separation.
 */

import { ConfigService, AppConfig, UserConfig } from "../core/config";

describe("ConfigService", () => {
  const TEST_APP_CONFIG = {
    appIdentifier: {
      name: "OpenConcord",
      displayName: "OpenConcord",
      version: "1.0.0",
    },
    application: {
      name: "OpenConcord",
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
        width: 800,
        height: 600,
        size: {
             width: 1280,
        height: 720,
      }
    }
  } as unknown as AppConfig;

  const TEST_USER_CONFIG = {
    appConfig: {
      openAppOnStartup: true,
      language: "en-us",
      theme: "dark",
      accentColor: "#5865F2",
      showHiddenChannels: false,
    } as UserConfig,
  };

  let config: ConfigService;

  beforeEach(() => {
    config = new ConfigService();
    config.set("app", TEST_APP_CONFIG);
    config.set("user", TEST_USER_CONFIG);
  });

  afterEach(() => {
    config.set("app", {});
    config.set("user", {});
    config.set("userStore", {});
  });

  describe("app configuration", () => {
    describe("appIdentifier", () => {
      it("returns the app name", () => {
        expect(config.get("app", "appIdentifier", "name")).toBe("OpenConcord");
      });

      it("returns the app display name", () => {
        expect(config.get("app", "appIdentifier", "displayName")).toBe("OpenConcord");
      });

      it("returns the app version", () => {
        expect(config.get("app", "appIdentifier", "version")).toBe("1.0.0");
      });

      it("returns undefined for missing values", () => {
        expect(config.get("app", "appIdentifier", "missing")).toBeUndefined();
      });

      it("returns fallback values for missing values", () => {
        expect(config.get("app", "appIdentifier", "version", "vTest")).toBe("vTest");
      });

      it("handles non-string values", () => {
        const result = config.get("app", "appIdentifier", "version", "fallback");
        expect(result).toBe("1.0.0"); // returns the stored value, not the fallback
      });
    });

    describe("application", () => {
      it("returns app configuration", () => {
        const result = config.get("app", "application");
        expect(result).toBeDefined();
        expect(typeof result).toBe("object");
      });

      it("returns window configuration", () => {
        const result = config.get("app", "application", "window");
        expect(result).toBeDefined();
        expect(typeof result).toBe("object");
      });

      it("returns window size configuration", () => {
        const result = config.get("app", "application", "window", "size");
        expect(result).toBeDefined();
        expect(typeof result).toBe("object");
      });

      it("returns window size width", () => {
        const result = config.get("app", "application", "window", "size", "width");
        expect(result).toBe(1280);
      });

      it("returns window size height", () => {
        const result = config.get("app", "application", "window", "size", "height");
        expect(result).toBe(720);
      });

      it("returns window dimensions", () => {
        const result = config.get("app", "application", "window", "size");
        expect(result).toEqual({
          width: 1280,
          height: 720,
        });
      });
    });
  });

  describe("user configuration", () => {
    it("returns app config", () => {
      expect(config.get("user", "appConfig")).toBeDefined();
      expect(config.get("user", "appConfig")).toEqual({
        openAppOnStartup: true,
        language: "en-us",
        theme: "dark",
        accentColor: "#5865F2",
        showHiddenChannels: false,
      });
    });

    it("returns openAppOnStartup value", () => {
      expect(config.get("user", "appConfig", "openAppOnStartup")).toBe(true);
    });

    it("returns language value", () => {
      expect(config.get("user", "appConfig", "language")).toBe("en-us");
    });

    it("returns theme value", () => {
      expect(config.get("user", "appConfig", "theme")).toBe("dark");
    });

    it("returns accentColor value", () => {
      expect(config.get("user", "appConfig", "accentColor")).toBe("#5865F2");
    });

    it("returns showHiddenChannels value", () => {
      expect(config.get("user", "appConfig", "showHiddenChannels")).toBe(false);
    });

    it("returns undefined for missing keys in user config", () => {
      expect(config.get("user", "appConfig", "missingKey")).toBeUndefined();
    });

    describe("appConfig modifications", () => {
      it("updates an existing key", () => {
        config.set("user", "appConfig", "theme", "light");
        expect(config.get("user", "appConfig", "theme")).toBe("light");
      });

      it("removes a key by setting to undefined", () => {
        config.set("user", "appConfig", "theme", undefined);
        expect(config.get("user", "appConfig", "theme")).toBeUndefined();
      });
    });

    describe("user store merging", () => {
      it("merges default and custom user configs", () => {
        const defaultConfig = {};
        const customConfig = { customAttr: "custom" };

        config.set("userStore", defaultConfig);
        config.set("userStore", customConfig);

        const result = config.get("userStore", "appAttr");
        expect(config.get("userStore", "appAttr")).toBeUndefined();

        const customResult = config.get("userStore", "customAttr");
        expect(customResult).toEqual("custom");
      });

      it("overwrites existing values in user store", () => {
        const initialConfig = { value1: "initial", value2: "initial2" };
        const updatedConfig = { value1: "updated", value3: "new" };

        config.set("userStore", initialConfig);
        config.set("userStore", updatedConfig);

        expect(config.get("userStore", "value1")).toBe("updated");
        expect(config.get("userStore", "value2")).toBe("initial2");
        expect(config.get("userStore", "value3")).toBe("new");
      });
    });
  });
});
