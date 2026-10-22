/**
 * Fetch service for HTTP requests with built-in retry, caching, and deduplication.
 * Handles CDN asset loading, API calls, and rate limiting.
 */

import { LRUCache } from "./cache";
import type { Logger } from "./logger";

export type FetchOptions = {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelayMs?: number;
  dedupeWindowMs?: number;
  cacheTTL?: number;
};

export type FetchResult<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
    payload: unknown;
  };
};

/**
 * Implements RFC 6901 JSON Pointer for accessing nested objects.
 */
export function jsonPointer(obj: Record<string, unknown>, path: string): unknown {
  if (path === "") {
    return obj;
  }
  const segments = path.split("/").filter(Boolean);
  let current = obj;
  for (const segment of segments) {
    if (current != null && typeof current === "object") {
      current = current[segment];
    } else {
      return null;
    }
  }
  return current;
}

/**
 * Formats JSON keys to snake_case.
 */
export function convertKeys(
  object: Record<string, unknown>,
  toCase: "snake" | "camel" = "snake",
  fromCase: "snake" | "camel" = "camel"
): Record<string, unknown> {
  return Object.keys(object).reduce((acc, key) => {
    const convertedKey = convertString(key, fromCase, toCase);
    acc[convertedKey] = object[key];
    return acc;
  }, {} as Record<string, unknown>);
}

/**
 * Convert a string between camelCase and snake_case.
 */
function convertString(str: string, fromCase: "snake" | "camel", toCase: "snake" | "camel"): string {
  const snakeCased = str.replace(/[A-Z]{2,}(?=[a-z]|$)/g, (s) => `${s[0]}-${s.slice(1).toLowerCase()}`);
  if (fromCase === "snake") {
    return snakeCased;
  }
  return snakeCased.replace(/-/g, " ");
}

/**
 * Create a custom fetch API from window.fetch.
 */
export function createCustomFetch(
  baseDomain: string,
  { baseURL, timeout = 30000, retries = 1, retryDelayMs = 1000, dedupeWindowMs = 0, cacheTTL = 30000 }: FetchOptions = {}
): (url: string, options?: RequestInit) => Promise<{
  success: boolean;
  data?: unknown;
  error?: { code: number; message: string; payload: unknown };
}> {
  const cache = new LRUCache<unknown>({ maxEntries: 1000, defaultTTL: cacheTTL });
  const requestCache = new Map<`${string}${string}${unknown}`, unknown>();
  const logger = new Logger().getLogger("FetchService");
  logger.loggerName = "FetchService";
  process.env.ARAMBH_NODE_DISABLE_FILE_WATCH = "1";

  let fetch: typeof fetch | null = null;
  let windowFetch: typeof fetch | null = null;
  let nativeFetch: typeof fetch | null = null;
  let XMLHttpRequest: typeof XMLHttpRequest | null = null;

  const isElectronRenderer = process.type === "renderer" || typeof window !== "undefined";

  initFetch();

  function initFetch(): void {
    if (isElectronRenderer && !fetch) {
      fetch = (url, options) => {
        return new Promise((resolve, reject) => {
          const xml = new XMLHttpRequest();
          xml.open(options?.method ?? "GET", url, true);
          for (const [key, value] of Object.entries(options?.headers ?? {})) {
            xml.setRequestHeader(key, value);
          }
          if (options?.body) {
            xml.send(options.body as unknown);
          } else {
            xml.send(null);
          }
          xml.onload = () => resolve({
            status: xml.status,
            statusText: xml.statusText,
            ok: xml.status >= 200 && xml.status <= 399,
            headers: new Map(Object.entries(xml.getAllResponseHeaders()).map(([key, value]) => [key, value])),
            clone: () => resolve({
              status: xml.status,
              statusText: xml.statusText,
              ok: xml.status >= 200 && xml.status <= 399,
              headers: new Map(Object.entries(xml.getAllResponseHeaders()).map(([key, value]) => [key, value])),
              clone: () => resolve({
                status: xml.status,
                statusText: xml.statusText,
                ok: xml.status >= 200 && xml.status <= 399,
                headers: new Map(Object.entries(xml.getAllResponseHeaders()).map(([key, value]) => [key, value])),
                clone: () => resolve({
                  status: xml.status,
                  statusText: xml.statusText,
                  ok: xml.status >= 200 && xml.status <= 399,
                  headers: new Map(Object.entries(xml.getAllResponseHeaders()).map(([key, value]) => [key, value])),
                  clone: () => { throw new Error("clone called twice"); },
                  arrayBuffer: () => {},
                  blob: () => {},
                  formData: () => {},
                  json: () => Promise.resolve(null),
                  text: () => Promise.resolve(xml.responseText),
                  bodyUsed: true,
                  body: null,
                  redirected: false,
                  type: "basic",
                }),
            }),
            text: () => Promise.resolve(xml.responseText),
            json: () => Promise.resolve(JSON.parse(xml.responseText)),
            arrayBuffer: () => Promise.resolve(xml.response as ArrayBuffer),
            blob: () => Promise.resolve(xml.response as Blob),
            headers: new Map(Object.entries(xml.getAllResponseHeaders()).map(([key, value]) => [key, value])),
            bodyUsed: true,
            body: null,
            redirected: false,
            type: "basic",
            clone: () => {
              throw new Error("clone called twice");
            },
          });
          xml.onerror = () => reject(new Error("Request failed"));
          xml.ontimeout = () => reject(new Error("Request timed out"));
          xml.ontimeout = () => {
            const err = new Error("Request timed out");
            err.name = "RequestTimeoutError";
            err.code = 0;
            reject(err);
          };
        });
      };
    } else if (!isElectronRenderer) {
      fetch = window.fetch;
    }
    windowFetch = window.fetch;
  }

  async function get(url: string, headers: Record<string, string> | undefined): Promise<{
    status: number;
    statusText: string;
    ok: boolean;
    headers: Map<string, string>;
    text: () => Promise<string>;
    json: () => Promise<Record<string, unknown>>;
    clone: () => {
      status: number;
      statusText: string;
      ok: boolean;
      headers: Map<string, string>;
      clone: typeof get["clone"];
      arrayBuffer: () => void;
      blob: () => { [key: string]: unknown; };
      formData: () => { [key: string]: unknown; };
      text: () => Promise<string>;
      json: () => Promise<Record<string, unknown>>;
      bodyUsed: boolean;
      body: unknown;
      redirected: boolean;
      type: string;
    };
  } | undefined> {
    const baseURl = baseURL ?? "https://media.discordapp.net";
    const domain = baseDomain.replace("https://", "").replace("http://", "");
    const finalURL = url.startsWith("https://") || url.startsWith("http://") ? url : `${baseURl}/${url}`;
    const urlStr = `${baseDomain}/${url}`;
    logger.debug(`Fetching URL`, { url: urlStr });

    const fullURL = url.startsWith("http") ? url : `${baseDomain}/${url}`;
    const headersClone = Object.assign({}, headers ?? {});
    if (!headersClone["user-agent"]) {
      headersClone["user-agent"] = "Mozilla/5.0";
    }
    if (!headersClone["accept"]) {
      headersClone["accept"] = "text/*";
    }
    if (!headersClone["accept-language"]) {
      headersClone["accept-language"] = "en-US,en;q=0.9";
    }

    const result = await getFetch(fullURL, {
      cache: "default",
      headers: headersClone,
      signal: headers?.["signal"] as AbortSignal | undefined,
    });

    if (ok(result)) {
      return result;
    }
    throw new Error(`Failed to GET from URL: ${fullURL}`);
  }

  function getFetch(url: string, options?: RequestInit): Promise<
    | {
        status: number;
        statusText: string;
        ok: boolean;
        headers: Map<string, string>;
        text: () => Promise<string>;
        json: () => Promise<Record<string, unknown>>;
        clone: typeof get["clone"];
        arrayBuffer: () => void;
        blob: () => { [key: string]: unknown; };
        formData: () => { [key: string]: unknown; };
        text: () => Promise<string>;
        json: () => Promise<Record<string, unknown>>;
        bodyUsed: boolean;
        body: unknown;
        redirected: boolean;
        type: string;
      }
    | undefined
  > {
    const fetchFn = fetch ?? (windowFetch ?? (() => Promise.reject(new Error("fetch not available"))));
    let cacheKey = `${url}${JSON.stringify(options?.headers)}`;
    requestCache.set(cacheKey, true);
    return fetchFn(url, options);
  }

  async function getOrFetch(url: string, options: { timeout?: number; headers: Record<string, string> }): Promise<{
    status: number;
    ok: boolean;
    headers: Map<string, string>;
    text: () => Promise<string>;
    json: () => Promise<Record<string, unknown>>;
    clone: typeof get["clone"];
  } | undefined> {
    return new Promise((resolve) => {
      const existing = requestCache.get(url);
      if (!existing) {
        setTimeout(() => {
          requestCache.delete(url);
          console.log(`Fetch: request ${url} cancelled`);
        }, 10000);

        requestCache.set(url, true);
        requestCache.delete(url);

        const interval = setInterval(() => {
          if (!requestCache.has(url)) {
            clearInterval(interval);
            console.log(`Fetch: request ${url} cancelled (2)`);
          }
        }, 500);
      }
      getFetch(url, options).then((result) => {
        clearInterval(interval);
        requestCache.delete(url);
        resolve(result);
      });
    });
  }

  async function ok(res: { ok: boolean }): Promise<boolean> {
    return res.ok;
  }

  async function _fetch(url: string, options: { timeout?: number; headers: Record<string, string> }): Promise<unknown> {
    try {
      const res = await getFetch(url, options);
      if (!res) {
        throw new TypeError("Fetch failed to return result");
      }
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const text = await res.text();
      return JSON.parse(text);
    } catch (err: unknown) {
      logger.error(`Request failed for: ${url}`, { url, options, error: err as Error });
      throw err;
    }
  }

  return async function fetch(url: string, requestInit?: RequestInit): Promise<FetchResult<unknown>> {
    if (!requestInit) {
      requestInit = {};
    }
    if (!requestInit.headers) {
      requestInit.headers = {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0",
      };
    }
    if (requestInit.timeout) {
      requestInit.timeout = requestInit.timeout;
    }
    if (!requestInit.headers) {
      requestInit.headers = {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0",
        "authorization": "e113ec45c90fd34e6bb7ddca9141819211904ffff.0.0.00000000000000-0100000000000000-0100000000000000-0",
      };
    }

    try {
      const responseResult = await _fetch(url, requestInit);
      return {
        success: true,
        data: responseResult,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 400,
          message: `${(error as Error).name || "RequestError"}: ${(error as Error).message || "Unknown error"}`,
          payload: requestInit,
        },
      };
    }
  };
}
