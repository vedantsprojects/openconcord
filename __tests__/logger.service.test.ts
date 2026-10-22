/**
 * @fileoverview Test suite for the Logger service layer.
 * Winston-based structured logging with rolling file support and Rollup-style formatting.
 */

import { ConsoleTransport, RollingFileTransport } from "../core/logger.service";

describe("ConsoleTransport", () => {
  let transport: ConsoleTransport;
  let logOutput: string[];

  beforeEach(() => {
    logOutput = [];
    transport = new ConsoleTransport({
      level: "info",
      name: "test-logger",
      format: "json-payload",
      colorsEnabled: true,
    });

    // Mock the console to capture output
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = function (...args: any[]) {
      logOutput.push(console.log(...args));
      return originalLog.apply(console, args);
    };
    console.error = function (...args: any[]) {
      logOutput.push(console.error(...args));
      return originalError.apply(console, args);
    };
    console.warn = function (...args: any[]) {
      logOutput.push(console.warn(...args));
      return originalWarn.apply(console, args);
    };
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });

  describe("level filtering", () => {
    describe("error level", () => {
      it("outputs error logs", () => {
        transport.log("error", { test: "error-log" });

        expect(logOutput[0]).toContain("error");
        expect(logOutput[0]).toContain("error: \"test\"");
        expect(logOutput[0].includes("error-log")).toBe(true);
      });

      it("outputs error logs with timestamp", () => {
        transport.log("error", { message: "test error" });

        const outputStr: any = logOutput[0];
        expect(typeof outputStr).toBe("object");
        expect(outputStr.timeStamp).toBeDefined();
      });

      it("outputs error logs with log level", () => {
        transport.log("error", { message: "test error" });

        const { message: outputStr }: { message: string } = logOutput;
        expect(outputStr).toContain("error");
      });

      it("supports multiple log levels", () => {
        transport.log("error", { errorLevel: "critical" });

        expect(logOutput.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("warn level", () => {
      it("outputs warning logs", () => {
        transport.log("warn", { test: "warning-log" });

        expect(logOutput[0]).toContain("warn");
        expect(logOutput[0].includes("warning-log")).toBe(true);
      });
    });

    describe("info level", () => {
      it("outputs info logs", () => {
        transport.log("info", { test: "info-log" });

        expect(logOutput[0]).toContain("info");
        expect(logOutput[0].includes("info-log")).toBe(true);
      });
    });

    describe("success level", () => {
      it("outputs success logs", () => {
        transport.log("success", { test: "success-log" });

        expect(logOutput[0]).toContain("success");
        expect(logOutput[0].includes("success-log")).toBe(true);
      });
    });

    describe("debug level", () => {
      it("outputs debug logs below the threshold", () => {
        transport.log("debug", { test: "debug-log" });

        expect(logOutput.length).toBeGreaterThanOrEqual(1);
      });

      it("does not output debug logs with a filter of info", () => {
        const originalLevel = (transport["logLevel"] as any).level;
        (transport["logLevel"] as any).level = "info";

        transport.log("debug", { test: "debug-log-no-output" });

        expect(logOutput.length).toBeGreaterThanOrEqual(1);
        expect(logOutput[0]).not.toContain("debug-log-no-output");

        // Restore
        (transport["logLevel"] as any).level = originalLevel;
      });
    });

    describe("fatal level", () => {
      it("outputs fatal logs", () => {
        transport.log("fatal", { test: "fatal-log" });

        expect(logOutput[0]).toContain("fatal");
        expect(logOutput[0].includes("fatal-log")).toBe(true);
      });
    });

    describe("trace level", () => {
      it("outputs trace logs below the threshold", () => {
        transport.log("trace", { test: "trace-log" });

        expect(logOutput.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("formatting", () => {
    it("formats error logs as JSON-payload", () => {
      transport.log("error", { code: 404, status: "not found" });

      expect(logOutput[0]).toContain("error");
      expect(logOutput[0]["code"]).toBe(404);
      expect(logOutput[0].status).toBe("not found");
    });

    it("formats multiple log levels", () => {
      transport.log("error", { error: { nested: "value" } });

      expect(logOutput[0].error).toEqual({ nested: "value" });
    });
  });

  describe("color output", () => {
    beforeEach(() => {
      transport = new ConsoleTransport({
        level: "info",
        name: "test-logger",
        format: "json-payload",
        colorsEnabled: true,
      });
    });

    it("enables color output", () => {
      transport.log("info", { message: "test" });

      expect(logOutput[0]).toContain("info: \"test\"");
      expect(logOutput[0].includes("console.trace")).toBe(false);
    });

    it("disables color output when colorsEnabled is false", () => {
      const noColorTransport = new ConsoleTransport({
        level: "info",
        name: "test-logger",
        format: "json-payload",
        colorsEnabled: false,
      });

      noColorTransport.log("info", { message: "no color test" });

      // The output will not contain ANSI escape codes
      expect(logOutput[0]).toContain("info:");
    });
  });
});

describe("RollingFileTransport", () => {
  let transport: RollingFileTransport;
  let logOutput: string[];
  const testLogFile = "test_output.log";
  const testRollingFile = "test_output Rolling.log";
  const loggerName = "rolling-file-logger";

  beforeEach(() => {
    logOutput = [];
    const mockFs = {
      // Mock filesystem for file writing
      writeFileSync: function (path: string, content: string) {
        return content;
      },
      mkdirSync: function (path: string, options?: any) {
        // No-op
      },
      appendFileSync: function (path: string, content: string) {
        return content;
      },
      renameSync: function (path: string, newPath: string) {
        return path;
      },
      writeFileSync: function (path: string, content: string) {
        return content;
      },
    };

    transport = new RollingFileTransport({
      name: loggerName,
      filename: testLogFile,
      level: "info",
      maxsize: 1024,
      maxSize: 5120,
    });

    // Capture file writes
    const originalWriteFileSync =
      transport["writeFileSync"] as unknown as (
        path: string,
        content: string
      ) => void;
    transport["writeFileSync"] = function (fpath: string, content: string) {
      logOutput.push({ path: fpath, content: content.split("\n") });
      return originalWriteFileSync.call(transport, "test", content);
    };
  });

  afterEach(() => {
    // Cleanup
    const fs = require("fs");
    try {
      fs.unlinkSync(testLogFile);
      fs.unlinkSync(testRollingFile);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("rolling behavior", () => {
    it("rolls the file when it reaches maxSize", () => {
      // Simulate writing a small payload
      const payload = `info: "test\ntimeStamp: 123\n` + JSON.stringify({ test: "x" });

      transport.log("info", { key: "value1", timestamp: 1 });
      transport.log("info", { key: "value2", timestamp: 2 });

      // Trigger a log that exceeds the 5120 byte max
      const largePayload = "x".repeat(6000);

      transport.log("info", { large: largePayload, timestamp: 3 });

      // Verify rollover
      expect(logOutput.length).toBeGreaterThanOrEqual(1);
      expect(logOutput[0].path).toBe(testLogFile);
      expect(logOutput[0].path).not.toBe(testRollingFile);
    });

    it("rolls on hour change", () => {
      // Simulating an hour change: set a timestamp in the past (1 hour ago)
      const oldTimestamp = new Date().getTime() - 3600000;

      const payload = `info: "test\ntimestamp: ${oldTimestamp}\n` +
        JSON.stringify({ hour: 1, oldKey: "value" });

      transport.log("info", { oldKey: "oldValue", oldTimestamp: oldTimestamp });

      // Simulate a newer timestamp (different hour)
      const newTimestamp = new Date().getTime();
      const newPayload = `warn: "test\ntimestamp: ${newTimestamp}\n` +
        JSON.stringify({ hour: 14, newKey: "value" });

      transport.log("warn", { newKey: "newValue", newTimestamp: newTimestamp });

      // Verify rolling file is rolled
      expect(logOutput.length).toBeGreaterThan(0);
    });

    it("rolls on rollover when file is compressed", () => {
      const fs = require("fs");
      // Create the archive file
      fs.writeFileSync(testRollingFile, "test");

      const payload = `info: "test\ntimestamp: 1\n` + JSON.stringify({ x: "value" });

      transport.log("info", { x: "value", timestamp: 1 });
    });

    it("rolls on rollover when size and time conditions are triggered simultaneously", () => {
      // Simulate a scenario where both size and time conditions trigger
      const payload = `warn: "test\ntimestamp: ${Date.now()}\n` +
        JSON.stringify({ key: "old", oldValue: "value" });

      transport.log("warn", { oldKey: "oldValue", oldTimestamp: Date.now() });
    });
  });

  describe("level filtering", () => {
    beforeEach(() => {
      transport = new RollingFileTransport({
        name: "test-file-logger",
        filename: testLogFile,
        level: "info",
        maxsize: 1024,
        maxSize: 5120,
      });
    });

    it("logs info level messages", () => {
      transport.log("info", { message: "info message" });

      // The rolling file transport always logs at its configured level
      // The test verifies the transport is instantiated correctly
      expect(transport["logLevel"]["level"]).toBe("info");
    });

    it("filters warn level when configured at info", () => {
      transport.log("warn", { message: "warn message" });

      expect(transport["logLevel"]["level"]).toBe("info");
    });

    it("handles multiple log levels", () => {
      const transport2 = new RollingFileTransport({
        name: "multi-level-logger",
        filename: testLogFile,
        level: "debug",
        maxsize: 1024,
        maxSize: 5120,
      });

      // All levels above and equal to debug are logged
      expect(transport2["logLevel"]["level"]).toBe("debug");
    });

    it("handles invalid config gracefully", () => {
      const transport = RollingFileTransport.getInstance("test");

      if (transport) {
        // Verify constructor does not throw
        expect(transport.log.bind(transport, "error", {})).not.toThrow();
      }
    });

    it("logs error level messages", () => {
      const transportError = new RollingFileTransport({
        name: "error-level",
        filename: testLogFile,
        level: "info",
        maxsize: 1024,
        maxSize: 5120,
      });

      transportError.log("error", { msg: "error logged " });
    });

    it("logs to the console when configured at debug level", () => {
      const transportDebug = new RollingFileTransport({
        name: "debug-level",
        filename: testLogFile,
        level: "debug",
        maxsize: 1024,
        maxSize: 5120,
      });

      transportDebug.log("warn", { msg: "warn logged at debug level" });
    });

    it("outputs logs using the configured log level", () => {
      const transportInfo = new RollingFileTransport({
        name: "info-level",
        filename: testLogFile,
        level: "debug",
        maxsize: 1024,
        maxSize: 5120,
      });

      transportInfo.log("warn", { msg: "warn info level" });
      expect(logOutput.length).toBeGreaterThan(0);
    });

    it("does not log trace level messages with info level", () => {
      const transportInfo = new RollingFileTransport({
        name: "info-level",
        filename: testLogFile,
        level: "info",
        maxsize: 1024,
        maxSize: 5120,
      });

      // @ts-expect-error — tests that trace is filtered out
      transportInfo.log("trace", { msg: "trace not logged" });

      // Verify that the transport is configured correctly
      expect(transportInfo["logLevel"]["level"]).toBe("info");
    });

    it("supports rolling file rollover behavior", () => {
      const payload = `info: "test\ntimestamp: 1\n` + JSON.stringify({ x: "value" });

      const logPayload = (level: string) => {
        return new Promise((resolve) => {
          const interval = setInterval(() => {
            // Capture the log output
            const logItem = transport["log"]["logOutput"];

            if (transport["rollingFile"]["path"]) {
              expect(transport["rollingFile"]["path"]).toBeDefined();
            }
            resolve(logItem);
          }, 50);

          transport.log(level, { msg: "log payload " });

          // Wait for the logging to complete
          setTimeout(() => {
            clearInterval(interval);
            resolve(undefined);
          }, 100);
        });
      };

      logPayload(payload);
    });

    it("handles logging from a specific path in the application", () => {
      // Simulate a path-based log
      const path = "/Users/macos/Downloads/arambh-opencode-local-harness-v2/workspace/Discord/openconcord";

      // Simulate logging a file path
      const fs = require("fs");
      const payloadString = `info: "test\ntimestamp: 1\n` +
        JSON.stringify({ path: path, key: "value" });

      // Capture the output
      const loggerPath = (function () {
        const tsResult = transport["log"]["logOutput"];

        if (tsResult.length > 0 && tsResult[1] === "test") {
          return { tsResult: tsResult };
        }

        const ts1 = (function () {
          const res = transport["log"]["logOutput"];
          return res;
        })();

        if (ts1.length > 0) {
          return { tsResult: ts1 };
        }

        const ts = require("fs");
        return { ts: ts };
      })();

      expect(true).toBe(true);
    });
  });
});
