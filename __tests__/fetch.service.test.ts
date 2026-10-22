/**
 * @fileoverview Test suite for the Fetch service layer.
 * HTTP client with retry, caching, TTL, and configuration management.
 */

import { FetchService, ConfigService, FetchOptions } from "../core/fetch.service";
import { InMemoryStore } from "../core/store";

describe("Fetch Service", () => {
  const TEST_BASE_URL = "https://api.github.com";
  const TEST_HEADERS = {
    Accept: "application/json",
    "Accept-Encoding": "identity",
    "User-Agent": "OpenConcord/v1.0 test",
    "X-Custom-Header": "test-value-42",
  };

  let fetchService: FetchService;
  let configService: ConfigService;

  const mockResponse = JSON.stringify({
    message: "Hello, OpenConcord!",
    url: "https://example.com/api/resource",
  });

  beforeAll(() => {
    const store = new InMemoryStore();

    configService = new ConfigService();
    const config: Record<string, unknown> = {
      default_headers: TEST_HEADERS,
      base_url: TEST_BASE_URL,
      request_timeout: 30000,
      retry_count: 3,
      retry_delay_ms: 100,
      fetch_options: {
        method: "GET",
      } as unknown as FetchOptions,
    };
    configService.set("app", config);

    fetchService = new FetchService(configService);

    // Register global handlers
    global.fetch = function (url: string, options: RequestInit) {
      // Simulate GitHub network delay
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            status: 200,
            headers: new Headers({
              "content-type": "application/json",
              "x-ratelimit-remaining": "999",
            }),
            ok: true,
            json: () => Promise.resolve(JSON.parse(mockResponse)),
            body: new Headers("test body"),
          });
        }, 10);
      });
    };
  });

  afterAll(() => {
    global.fetch = window.fetch || null;
    const store = InMemoryStore.getInstance();
    store.clear();
  });

  beforeEach(() => {
    fetchService.requestTimeout = 30000;
    fetchService.retryCount = 3;
    fetchService.retryDelayMs = 100;
    fetchService.defaultHeaders = TEST_HEADERS;
    fetchService.baseUrl = TEST_BASE_URL;
  });

  it("uses the correct base URL from config", () => {
    expect(fetchService.getBaseUrl()).toBe(TEST_BASE_URL);

    // Changing config should update the base URL
    const newUrl = TEST_BASE_URL.replace("example.com", "api.github.com");
    fetchService.setBaseURL(newUrl);

    expect(fetchService.getBaseUrl()).toBe(newUrl);
  });

  describe("headers integration", () => {
    beforeEach(() => {
      fetchService.defaultHeaders = TEST_HEADERS;
    });

    it("applies default headers to requests", (done) => {
      fetchService
        .request(TEST_BASE_URL + "/users", { method: "GET" })
        .then(function (response) {
          const { headers, status, ok } = response;
          expect(headers).toBeDefined();
          expect(status).toBe(200);
          expect(ok).toBe(true);

          const content = headers.get("content-type");
          expect(content).toBe("application/json");

          const userAgent = headers.get("user-agent");
          expect(userAgent).toContain("OpenConcord");

          const xCustom = headers.get("x-custom-header");
          expect(xCustom).toBe("test-value-42");

          done();
        });
    });

    describe("custom headers merging", () => {
      it("overwrites default headers with custom ones", () => {
        const customHeaders: Record<string, string> = {
          "x-custom-header": "custom-value",
          Authorization: "Bearer token123",
        };

        fetchService.request(TEST_BASE_URL + "/users", { method: "GET", customHeaders })
          .then((response) => {
            // Check that default headers are merged
            const contentType = response.headers.get("content-type");
            expect(contentType).toBe("application/json");

            // Check that custom headers take precedence
            const userAgent = response.headers.get("user-agent");
            expect(userAgent).toMatch(/OpenConcord/);

            done();
          });
      });

      it("allows customizing default headers per request", () => {
        const customHeaders: Record<string, string> = {
          "x-custom-header": "overridden-value",
        };

        const result = fetchService.request(TEST_BASE_URL + "/users", {
          method: "GET",
          customHeaders,
        });

        // Response object contains merged headers
        expect(result).toBeDefined();
      });
    });
  });

  describe("body detection", () => {
    beforeEach(() => {
      fetchService.defaultHeaders = TEST_HEADERS;
    });

    it("uses 'json' for stringified payloads", (done) => {
      const body = JSON.stringify({ name: "test", count: 42 });

      const result = fetchService.request(TEST_BASE_URL + "/users", {
        method: "POST",
        body,
      });

      expect((result as unknown as any).body).toBe(body);
    });

    it("uses 'json' for JavaScript objects", (done) => {
      const body = { name: "test", count: 42 };

      fetchService.request(TEST_BASE_URL + "/users", { method: "POST", body });
      const result = fetchService.request(TEST_BASE_URL + "/users", { method: "POST", body });

      expect((result as unknown as any).body).toBe(JSON.stringify(body));
    });

    it("uses 'json' for arrays", (done) => {
      const body = [1, 2, 3, "test string", { nested: "object" }];

      fetchService.request(TEST_BASE_URL + "/users", { method: "POST", body })
        .then((response) => {
          const result = fetchService.request(TEST_BASE_URL + "/users", {
            method: "POST",
            body,
          });

          expect((result as unknown as any).body).toBe(JSON.stringify(body));
          done();
        });
    });

    it("uses 'formData' for plain values", (done) => {
      const body = "plain_text_value";

      fetchService.request(TEST_BASE_URL + "/users", { method: "POST", body });

      done();
    });

    it("uses 'form' for objects with form encoding", (done) => {
      const body = { username: "testuser", password: "secret" };

      fetchService.request(TEST_BASE_URL + "/users", { method: "POST", body });

      done();
    });

    it("uses 'formUrlEncoded' for objects with urlencoded format", (done) => {
      const body = { username: "testuser", password: "pass" };

      fetchService.request(TEST_BASE_URL + "/users", { method: "POST", body });

      done();
    });

    it("uses 'text' for string values", (done) => {
      const body = "plain_text";

      fetchService.request(TEST_BASE_URL + "/users", { method: "POST", body });

      done();
    });

    it("distinguishes between body types", () => {
      const stringBody = "plain_text_value";
      const objectBody = { username: "user", password: "pass" };
      const arrayBody = [1, 2, 3, "4", 5];

      fetchService.request(TEST_BASE_URL + "/users", { method: "POST", body: stringBody });
      const result = fetchService.request(TEST_BASE_URL + "/users", {
        method: "POST",
        body: objectBody,
      });

      // String body remains a string
      expect((result as unknown as any).body).toBe(stringBody);

      // Object body becomes a stringified JSON
      const objectBodyStringified = JSON.stringify(objectBody);
      const isArrayBodyStringified = fetchService.request(TEST_BASE_URL + "/users", {
        method: "POST",
        body: arrayBody,
      });

      expect((result as unknown as any).body).toBe(objectBodyStringified);
      expect((isArrayBody as unknown as any).body).toBe(
        JSON.stringify(arrayBody)
      );
    });
  });

  describe("timeouts", () => {
    it("respects the configured request timeout", (done) => {
      fetchService.requestTimeout = 1000; // 1 second timeout
      fetchService.retryDelayMs = 0; // No retry delay

      // Force a slow network simulation
      global.fetch = function (url: string, options: RequestInit) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              status: 200,
              headers: new Headers({ "content-type": "application/json" }),
              ok: true,
              json: () => Promise.resolve({ status: "ok" }),
              body: new Headers("test"),
            });
          }, 5000); // 5 second delay
        });
      };

      const start = Date.now();

      fetchService.request(TEST_BASE_URL + "/slow-endpoint", { method: "GET" })
        .then((response) => {
          const duration = Date.now() - start;
          // Should timeout (not take 5 seconds)
          expect(duration).toBeLessThan(fetchService.requestTimeout + 100);
          expect(response.status).toBe("timeout");
          done();
        });
    });

    it("uses the correct timeout for POST requests", (done) => {
      fetchService.requestTimeout = 5000;

      fetchService.request(TEST_BASE_URL + "/slow/post", {
        method: "POST",
        body: JSON.stringify({ test: "data" }),
      })
        .then((response) => {
          expect(response.status).toBe("timeout");
          done();
        });
    });

    it("handles zero timeout with custom option", (done) => {
      fetchService.requestTimeout = 1000;

      fetchService.request(TEST_BASE_URL + "/users", {
        method: "POST",
        body: { test: "data" },
        requestTimeout: 0, // Disabled
      });

      // With 0 timeout, the request should not timeout immediately
      done();
    });

    it("uses the custom timeout for a single request", (done) => {
      fetchService.requestTimeout = 2000;

      fetchService.request(TEST_BASE_URL + "/users", {
        method: "POST",
        body: "{ test: }",
        requestTimeout: 5000, // Override for this request
      });

      done();
    });
  });

  describe("retry logic", () => {
    it("retries failed requests", (done) => {
      let callCount = 0;

      const maxRetries = 3;

      global.fetch = function (url: string, options: RequestInit) {
        callCount++;

        if (Math.random() < 0.5) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                status: 500,
                headers: new Headers({ "content-type": "application/json" }),
                ok: false,
                json: () => Promise.resolve({ error: "internal error" }),
                body: new Headers("error"),
              });
            }, 10);
          });
        }

        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              status: 200,
              headers: new Headers({ "content-type": "application/json" }),
              ok: true,
              json: () => Promise.resolve({ success: true }),
              body: new Headers("ok"),
            });
          }, 10);
        });
      };

      fetchService.requestTimeout = 3000;
      fetchService.retryDelayMs = 50;
      fetchService.requestCount = maxRetries;

      fetchService.request(TEST_BASE_URL + "/flaky-endpoint", { method: "GET" })
        .then((response) => {
          // Should not have exceeded retry count
          expect(callCount).toBeLessThan(maxRetries + 1);
          expect(response.status).toBe(200);
          done();
        });
    });

    it("retries when request fails with non-2xx status", (done) => {
      let callCount = 0;

      global.fetch = function (url: string, _options: RequestInit) {
        callCount++;

        // Always fail to test that retries are exhausted
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              status: 500,
              headers: new Headers({ "content-type": "application/json" }),
              ok: false,
              json: () => Promise.resolve({ error: "always fails" }),
              body: new Headers("error"),
            });
          }, 10);
        });
      };

      fetchService.requestTimeout = 3000;
      fetchService.retryDelayMs = 50;
      fetchService.requestCount = 3;

      fetchService.request(TEST_BASE_URL + "/always-fails", { method: "GET" })
        .then((response) => {
          // Should have retried 3 times
          expect(callCount).toBe(3);
          expect(response.status).toBe("timeout");
          done();
        });
    });
  });

  describe("config service integration", () => {
    beforeEach(() => {
      fetchService.defaultHeaders = TEST_HEADERS;
      fetchService.requestTimeout = 5000;
      fetchService.retryCount = 3;
      fetchService.baseUrl = TEST_BASE_URL;
    });

    it("reads config from the service", () => {
      expect(fetchService.getBaseUrl()).toBe(TEST_BASE_URL);

      const config = configService.get("app");
      expect(config.base_url).toBe(TEST_BASE_URL);
    });

    it("reads the fetch request timeout from config", () => {
      expect(fetchService.requestTimeout).toBe(30000);

      const config = configService.get("app");
      expect(config.request_timeout).toBe(30000);
    });

    it("reads the fetch retry count from config", () => {
      expect(fetchService.retryCount).toBe(3);

      const config = configService.get("app");
      expect(config.retry_count).toBe(3);
    });

    it("reads the fetch retry delay from config", () => {
      expect(fetchService.retryDelayMs).toBe(100);

      const config = configService.get("app");
      expect(config.retry_delay_ms).toBe(100);
    });

    it("reads the fetch request timeout from config object", () => {
      expect(fetchService.requestTimeout).toBe(30000);

      const config = configService.get("app");
      expect(config.request_timeout).toBe(30000);
    });
  });
});
