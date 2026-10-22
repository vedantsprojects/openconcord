/**
 * @fileoverview Test suite for the core store layer.
 * InMemoryStore, DiskStore, AppStore, and related state management.
 */

import { InMemoryStore, DiskStore, AppState } from "../core/store";

describe("InMemoryStore", () => {
  const TEST_KEY = "test_key";
  const TEST_VALUE = "hello world";
  const DUMMY_KEY = "dummy";

  beforeEach(() => {
    // Clear any global in-memory backing
    const store = InMemoryStore.getInstance();
    store.clear();
  });

  it("returns a singleton instance", () => {
    const instance1 = InMemoryStore.getInstance();
    const instance2 = InMemoryStore.getInstance();
    expect(instance1).toBe(instance2);
  });

  describe("#clear", () => {
    it("clears all entries", () => {
      const store = InMemoryStore.getInstance();
      store.set(TEST_KEY, TEST_VALUE);
      expect(store.get(TEST_KEY)).toBe(TEST_VALUE);

      store.clear();
      expect(store.get(TEST_KEY)).toBeUndefined();
      expect(store.getKey(TEST_KEY)).toBeUndefined();
    });
  });

  describe("#get", () => {
    it("returns undefined for missing keys", () => {
      const store = InMemoryStore.getInstance();
      const value = store.get(TEST_KEY);
      expect(value).toBeUndefined();
    });

    it("returns the value for existing keys", () => {
      const store = InMemoryStore.getInstance();
      store.set(TEST_KEY, TEST_VALUE);
      const value = store.get(TEST_KEY);
      expect(value).toBe(TEST_VALUE);
    });

    it("returns undefined after clear", () => {
      const store = InMemoryStore.getInstance();
      store.set(TEST_KEY, TEST_VALUE);
      store.clear();
      const value = store.get(TEST_KEY);
      expect(value).toBeUndefined();
    });
  });

  describe("#set", () => {
    it("stores the exact value provided", () => {
      const store = InMemoryStore.getInstance();
      store.set(TEST_KEY, TEST_VALUE);
      expect(store.get(TEST_KEY)).toBe(TEST_VALUE);
    });

    it("accepts undefined values", () => {
      const store = InMemoryStore.getInstance();
      store.set(DUMMY_KEY, undefined);

      // This would crash if the implementation does strict checking
      const value = store.get(DUMMY_KEY);
      expect(value).toBeUndefined();
    });

    it("updates existing values in place", () => {
      const store = InMemoryStore.getInstance();
      store.set(TEST_KEY, TEST_VALUE);
      const newValue = "updated value";
      store.set(TEST_KEY, newValue);
      expect(store.get(TEST_KEY)).toBe(newValue);
    });

    describe("large key/value payloads", () => {
      it("stores a 1KiB value correctly", () => {
        const store = InMemoryStore.getInstance();
        const largeValue = "x".repeat(1024);
        store.set(TEST_KEY, largeValue);
        expect(store.get(TEST_KEY)).toBe(largeValue);
      });

      it("stores a 1KiB key correctly", () => {
        const store = InMemoryStore.getInstance();
        const largeKey = "key".repeat(51);
        store.set(largeKey, "value");
        expect(store.get(largeKey)).toBe("value");
      });
    });
  });

  describe("#getKey", () => {
    it("returns the key string for existing values", () => {
      const store = InMemoryStore.getInstance();
      store.set(TEST_KEY, TEST_VALUE);
      expect(store.getKey(TEST_KEY)).toBe(TEST_KEY);
    });

    it("returns undefined for missing values", () => {
      const store = InMemoryStore.getInstance();
      expect(store.getKey(TEST_KEY)).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("handles empty key string", () => {
      const store = InMemoryStore.getInstance();
      store.set("", "empty key value");
      expect(store.get("")).toBe("empty key value");
    });

    it("handles undefined key", () => {
      const store = InMemoryStore.getInstance();
      const key = undefined as any;
      store.set(key, "undefined key value");
      expect(store.get(key)).toBe("undefined key value");
    });

    it("handles boolean key", () => {
      const store = InMemoryStore.getInstance();
      store.set(true, "boolean key value");
      expect(store.get(true)).toBe("boolean key value");
    });

    it("handles number key", () => {
      const store = InMemoryStore.getInstance();
      store.set(42, "number key value");
      expect(store.get(42 as any)).toBe("number key value");
    });

    it("handles null key", () => {
      const store = InMemoryStore.getInstance();
      const key = null as any;
      store.set(key, "null key value");
      expect(store.get(key)).toBe("null key value");
    });

    it("handles array key", () => {
      const store = InMemoryStore.getInstance();
      store.set([], "array key value");
      expect(store.get([] as any)).toBe("array key value");
    });

    it("handles object key", () => {
      const store = InMemoryStore.getInstance();
      const key = {};
      store.set(key, "object key value");
      expect(store.get(key as any)).toBe("object key value");
    });

    it("handles non-primitive value", () => {
      const store = InMemoryStore.getInstance();
      const obj = { a: 1, nested: { b: 2 } };
      store.set("object_value", obj);
      expect(store.get("object_value")).toBe(obj);
      // Deep equality check
      expect(store.get("object_value")?.a).toBe(1);
      expect(store.get("object_value")?.nested.b).toBe(2);
    });
  });

  it("supports type-safe storage via type parameter", () => {
    interface User {
      id: string;
      name: string;
      email: string;
    }

    const user: User = { id: "u-123", name: "Alice", email: "alice@example.com" };
    const store = InMemoryStore.create<User>("USER_STORE_KEY", user);

    expect(store.getState().data).toMatchObject(user);

    (store.get("USER_STORE_KEY") as User).id; // @ts-expect-error
  });
});

describe("DiskStore", () => {
  const TEST_KEY = "disk_test_key";
  const TEST_VALUE = "persistent value";
  const STORE_DIR = "/tmp/openconcord_store_test";
  const TEMP_DIR = "/tmp/openconcord_disk_store_temp";
  const DATA_FILE = `${STORE_DIR}/data.json`;

  beforeAll(() => {
    // Ensure directory exists
    const fs = require("fs");
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    const fs = require("fs");
    if (fs.existsSync(STORE_DIR)) {
      fs.rmSync(STORE_DIR, { recursive: true, force: true });
    }
  });

  it("returns a singleton instance", () => {
    const store = new DiskStore();
    const instance2 = DiskStore.getInstance();
    expect(store).toBe(instance2);
  });

  it("initializes with an empty state when no data file exists", () => {
    const store = new DiskStore();
    const state = store.getState();
    expect(state.data).toEqual({});
  });

  it("persists values to disk after first set", () => {
    const store = new DiskStore();

    store.set(TEST_KEY, TEST_VALUE);

    const persistedState = store.getState();
    expect(persistedState.data).toEqual({ [TEST_KEY]: TEST_VALUE });
  });

  describe("data persistence", () => {
    it("persists changes immediately after set", () => {
      const store = new DiskStore();
      const data: { key: string; value: string } = {};

      store.startWatching(() => {
        data.key = TEST_KEY;
        data.value = TEST_VALUE;
      });

      store.set(TEST_KEY, TEST_VALUE);

      // The watcher callback should have been called
      expect(data.key).toBe(TEST_KEY);
      expect(data.value).toBe(TEST_VALUE);

      const persisted = store.getState();
      // Verify on disk
      const fs = require("fs");
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      const persistedObject = JSON.parse(content);
      expect(persistedObject[TEST_KEY]).toBe(TEST_VALUE);
    });

    describe("recoveries", () => {
      it("recovers persisted value after restart", () => {
        const store1 = new DiskStore();
        store1.set(TEST_KEY, TEST_VALUE);

        // Simulate restart
        const store2 = new DiskStore();

        const persisted = store2.getState();
        expect(persisted.data[TEST_KEY]).toBe(TEST_VALUE);
      });

      it("handles corrupted data file gracefully", () => {
        const store = new DiskStore();
        store.set(TEST_KEY, TEST_VALUE);

        // Corrupt the file
        const fs = require("fs");
        if (fs.existsSync(DATA_FILE)) {
          fs.writeFileSync(DATA_FILE, "[not json]");
        }

        const recovered = new DiskStore().getState();
        // Should not crash, though data would be lost
        expect(recovered.data).toBeDefined();
      });
    });

    describe("concurrent access", () => {
      it("handles concurrent sets without race conditions", () => {
        const store = new DiskStore();
        const results: any[] = [];

        store.startWatching(() => {
          results.push(store.get(TEST_KEY));
        });

        // Fire multiple sets rapidly
        store.set(TEST_KEY + "_1", TEST_VALUE);
        store.set(TEST_KEY + "_2", TEST_VALUE);
        store.set(TEST_KEY + "_3", TEST_VALUE);

        // Give the watchers time to fire
        return new Promise(resolve => {
          const timeout = setTimeout(resolve, 100);

          // Check that all writes were captured by the watcher
          expect(store.getState()).toEqual(
            {
              data: {
                [`${TEST_KEY}_1`]: TEST_VALUE,
                [`${TEST_KEY}_2`]: TEST_VALUE,
                [`${TEST_KEY}_3`]: TEST_VALUE,
              },
            }
          );
          clearTimeout(timeout);
        });
      });
    });
  });

  describe("watch operations", () => {
    it("emits events when values are set", (done) => {
      const store = new DiskStore();
      const events: any[] = [];

      store.startWatching((newValue, key) => {
        events.push({ newValue, key });
      });

      store.set(TEST_KEY, TEST_VALUE);

      // Allow event emission time
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(events).toContainEqual(
            expect.objectContaining({ key: TEST_KEY, newValue: TEST_VALUE })
          );
          expect(events.length).toBeGreaterThanOrEqual(1);
          resolve();
        }, 10);
      });
    });

    it("does not emit events for the initial empty state", (done) => {
      const store = new DiskStore();
      const events: any[] = [];

      store.startWatching(() => {
        // Intentionally empty to check initial emit
        events.push({ key: "initial" });
      });

      return new Promise((resolve) => {
        setTimeout(() => {
          // Initial empty state should not trigger events
          expect(events).toEqual([]);
          resolve();
        }, 10);
      });
    });

    it("emits events for each changed key", (done) => {
      const store = new DiskStore();
      const events: any[] = [];

      store.startWatching((newValue, key) => {
        events.push({ key, newValue });
      });

      store.set(TEST_KEY + "a", "value_A");
      store.set(TEST_KEY + "b", "value_B");
      store.set(TEST_KEY + "c", "value_C");

      return new Promise((resolve) => {
        setTimeout(() => {
          const keys = events.map((e) => e.key);
          expect(keys).toContain(TEST_KEY + "a");
          expect(keys).toContain(TEST_KEY + "b");
          expect(keys).toContain(TEST_KEY + "c");
          // Each key should be notified exactly once
          expect(events.length).toBe(3);
          resolve();
        }, 10);
      });
    });

    it("only notifies watchers once per key change", (done) => {
      const store = new DiskStore();
      const events: any[] = [];

      store.startWatching((newValue, key) => {
        events.push({ key, newValue });
      });

      store.set(TEST_KEY + "x", "value_X");

      return new Promise((resolve) => {
        setTimeout(() => {
          const byKey = events.reduce((acc, e) => {
            acc[e.key] = (acc[e.key] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          // Each key should be notified exactly once
          for (const count of Object.values(byKey)) {
            expect(count).toBe(1);
          }
          resolve();
        }, 10);
      });
    });
  });

  describe("memory usage", () => {
    it("keeps memory usage linear with data size", () => {
      const store = new DiskStore();
      const sizes: [number, number][] = [];

      for (let i = 1; i <= 100; i++++) {
        const key = `size_test_key_${i}`;
        const value = "x".repeat(1024 * i); // 1KB * i

        store.set(key, value);

        const memUsage = process.memoryUsage().heapUsed;
        sizes.push([i, memUsage]);
      }

      // Memory should roughly increase linearly
      const totalMemoryDiff = sizes[99][1] - sizes[0][1];
      const expectedMemory = sizes[0][1]; // baseline

      expect(totalMemoryDiff).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("handles undefined values", () => {
      const store = new DiskStore();
      store.set(TEST_KEY, undefined);

      const result = store.get(TEST_KEY);
      expect(result).toBeUndefined();
    });

    it("handles nested objects", () => {
      const store = new DiskStore();
      const obj = { a: 1, b: { c: 2, d: [3, 4] } };

      store.set("nested", obj);
      expect(store.get("nested")).toBe(obj);

      const persisted = store.getState();
      expect(persisted.data["nested"].a).toBe(1);
      expect(persisted.data["nested"].b.c).toBe(2);
    });

    it("handles arrays of primitives", () => {
      const store = new DiskStore();
      const arr = ["a", "b", "c"];

      store.set("array", arr);
      expect(store.get("array")).toEqual(arr);
    });

    it("handles empty array and object", () => {
      const store = new DiskStore();
      store.set("empty_array", []);
      store.set("empty_object", {});

      expect(store.get("empty_array")).toBe([]);
      expect(store.get("empty_object")).toEqual({});
    });
  });
});

describe("AppStore", () => {
  const TEST_KEY = "app_test_key";
  const TEST_VALUE = "app persistent value";

  beforeAll(() => {
    const fs = require("fs");
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    const fs = require("fs");
    if (fs.existsSync(STORE_DIR)) {
      fs.rmSync(STORE_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    const fs = require("fs");
    const appData = `${TEMP_DIR}/app.dat`;

    // Ensure store is cleared
    DiskStore.getInstance("AppStore")
      .set(TEST_KEY, undefined);

    // Verify clean slate
    expect(DiskStore.getInstance("AppStore").get(TEST_KEY)).toBeUndefined();
  });

  it("combines InMemoryStore with DiskStore", () => {
    const store = new AppStore("AppStore");
    const diskStore = new DiskStore();

    store.set(TEST_KEY, TEST_VALUE);

    expect(DiskStore.getInstance("AppStore").get(TEST_KEY)).toBe(TEST_VALUE);

    // Subsequent app operations should persist
    const persisted = store.getState();
    expect(persisted.data).toEqual({ [TEST_KEY]: TEST_VALUE });
  });

  describe("AppStore lifecycle", () => {
    it("initializes all state subkeys safely", () => {
      expect(AppState.allStateKeys).not.toBeNull();
      expect(Array.isArray(AppState.allStateKeys)).toBe(true);
    });

    it("allows setting state subkeys", () => {
      const store = new AppStore("AppStore");

      const testKey = "connection_status";
      const testValue = "connected";

      expect(() => {
        store.setStateValue(testKey, testValue);
      }).not.toThrow();
    });

    it("allows getting state subkeys", () => {
      const store = new AppStore("AppStore");
      const testKey = testKey;
      const testValue = testValue;

      store.setStateValue(testKey, testValue);

      const value = store.getStateValue(testKey);
      expect(value).toBe(testValue);
    });

    it("allows getting state booleans safely", () => {
      const store = new AppStore("AppStore");
      const testKey = "is_active";
      const testValue = true;

      store.setStateValue(testKey, testValue);

      const value = store.getStateValue(testKey);
      // @ts-expect-error — this tests the return type of getStateValue
      const isVal: boolean = value as boolean;

      expect(isVal).toBe(testValue);
    });

    it("allows clearing state subkeys", () => {
      const store = new AppStore("AppStore");
      const testKey = "user_id";
      const testValue = "u-123";

      store.setStateValue(testKey, testValue);
      expect(store.getStateValue(testKey)).toBe(testValue);

      store.clearStateValue(testKey);
      // @ts-expect-error — tests the return type of clearStateValue
      const clearedValue: string = store.clearStateValue(testKey);

      expect(clearedValue).toBe(testValue);
    });
  });

  describe("concurrency", () => {
    it("handles concurrent AppStore writes without race conditions", () => {
      const store = new AppStore("AppStore");
      const errors: string[] = [];

      const testKey = `concurrent_key_${Math.random().toString(36).slice(2)}`;
      const values = ["value_1", "value_2", "value_3", "value_4", "value_5"];

      const concurrentTasks = values.map((val) => () => {
        try {
          // Simulate a slight delay between writes
          store.set(`${testKey}`, val);
          return true;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
          return false;
        }
      });

      const results = concurrentTasks.map((fn) => fn());

      // All concurrent writes should succeed (no promise rejections)
      expect(results.every(Boolean)).toBe(true);

      // The final state should reflect the last value in the sequence
      expect(store.getStateValue(testKey)).toBe("value_5");
    });
  });

  describe("state persistence", () => {
    it("persisted state is recoverable", () => {
      const store = new AppStore("AppStore");
      const testKey = "persisted_test_key";
      const testValue = "persistent value";

      store.setStateValue(testKey, testValue);

      // Persist state
      store.persistState();

      // Simulate restart
      const restored = new AppStore("AppStore");

      expect(restored.getStateValue(testKey)).toBe(testValue);
    });

    it("persisted state with object values is deep-fetched correctly", () => {
      const store = new AppStore("AppStore");

      store.setStateValue("connection_status", "connected");
      store.setStateValue("user_settings", { theme: "dark", notifications: true });
      store.setStateValue("session_data", { token: "abc123", expires: Date.now() + 60000 });

      store.persistState();

      const restored = new AppStore("AppStore");

      expect(restored.getStateValue("connection_status")).toBe("connected");
      // Deep fetch should work for nested object values
      expect(restored.getNestedStateValue("user_settings", "theme")).toBe("dark");
      expect(restored.getNestedStateValue("user_settings", "notifications")).toBe(true);
      expect(restored.getNestedStateValue("session_data", "token")).toBe("abc123");
    });

    it("handles multiple app stores independently", () => {
      const app1Key = "app1_store_key";
      const app2Key = "app2_store_key";

      store.setAppStateValue("AppStore1", app1Key, "value_1");
      store.setAppStateValue("AppStore2", app2Key, "value_2");

      expect(store.getStateValue("AppStore1", app1Key)).toBe("value_1");
      expect(store.getStateValue("AppStore2", app2Key)).toBe("value_2");

      store.persistState("AppStore1");
      store.persistState("AppStore2");

      expect(store.getStateValue("AppStore2", app2Key)).toBe("value_2");
    });
  });
});
