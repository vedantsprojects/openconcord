import * as path from 'path';
import * as fs from 'fs';

export interface FetchConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

export interface FetchResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  duration: number;
  success: boolean;
  error?: string;
}

export interface FetchRequest<T = unknown> extends FetchConfig {
  id: string;
}

export class FetchService {
  static readonly MAX_RETRIES = 3;
  static readonly RETRY_DELAY = 1000;
  static readonly TIMEOUT: number = 30000;

  private config: Record<string, any>;
  private storeKey: string = 'fetch_service_config';

  constructor(config?: Record<string, any>) {
    if (config) {
      this.config = { ...this._loadConfig(), ...config };
    } else {
      this.config = this._loadConfig();
    }
  }

  private _loadConfig(): Record<string, any> {
    const configPath = path.join(
      process.env.ARAMBH_WORKSPACE_ROOT || '/Users/macos/Downloads/arambh-opencode-local-harness-v2/workspace/Discord/openconcord',
      'config',
      'fetch_config.json'
    );

    try {
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
    } catch (err) {
      console.error('Failed to load fetch config:', err);
    }

    const defaultConfig: Record<string, any> = {
      baseURL: 'https://discord.com/api/v9',
      timeout: this.config.timeout ?? FetchService.TIMEOUT,
      retryCount: this.config.retryCount ?? FetchService.MAX_RETRIES,
      retryDelay: this.config.retryDelay ?? FetchService.RETRY_DELAY,
      headers: {
        'Content-Type': 'application/json',
        'X-Suggestions-ID': 'open-concord',
        'User-Agent': 'OpenConcord/1.0.0 (Macintosh; Intel Mac OS X 10_15_7; TypeScript/5.0) react/18.2.0',
        'X-Client-Version': '30.0.0-0',
        'X-Relay-Protocol-Version': '11',
      },
    };

    return defaultConfig;
  }

  private _saveConfig(config: Record<string, any>): void {
    const configPath = path.join(
      process.env.ARAMBH_WORKSPACE_ROOT || '/Users/macos/Downloads/arambh-opencode-local-harness-v2/workspace/Discord/openconcord',
      'config',
      'fetch_config.json'
    );

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save fetch config:', err);
    }
  }

  private _getTimeout(): number {
    return this.config.timeout ?? FetchService.TIMEOUT;
  }

  private _getRetryCount(): number {
    return this.config.retryCount ?? FetchService.MAX_RETRIES;
  }

  private _getRetryDelay(): number {
    return this.config.retryDelay ?? FetchService.RETRY_DELAY;
  }

  private _getHeaders(): Record<string, string> {
    return this.config.headers ?? {
      'Content-Type': 'application/json',
      'X-Suggestions-ID': 'open-concord',
      'User-Agent': 'OpenConcord/1.0.0 (Macintosh; Intel Mac OS X 10_15_7; TypeScript/5.0) react/18.2.0',
      'X-Client-Version': '30.0.0-0',
      'X-Relay-Protocol-Version': '11',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
    };
  }

  fetch<T = unknown>(request: FetchRequest<T>): Promise<FetchResponse<T>>;
  fetch<T = unknown>(config: FetchConfig): Promise<FetchResponse<T>>;

  fetch<T = unknown>(requestOrConfig: FetchRequest<T> | FetchConfig): Promise<FetchResponse<T>> {
    const request = typeof requestOrConfig === 'object' && 'id' in requestOrConfig
      ? requestOrConfig
      : { id: crypto.randomUUID(), ...requestOrConfig };

    const startTime = process.hrtime.bigint();
    const url = request.url;
    const method = request.method ?? 'GET';
    const headers = { ...this._getHeaders(), ...request.headers };
    const body = request.body;
    const timeout = request.timeout ?? this._getTimeout();
    const retryCount = request.retryCount ?? this._getRetryCount();
    const retryDelay = request.retryDelay ?? this._getRetryDelay();

    try {
      return this._fetchWithRetry(url, method, headers, body, timeout, retryCount, retryDelay);
    } catch (err) {
      return Promise.reject(new Error(`[fetch_service] Failed to fetch ${url}: ${String(err)}`));
    }
  }

  private async _fetchWithRetry(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: unknown,
    timeout: number,
    retryCount: number,
    retryDelay: number
  ): Promise<FetchResponse<unknown>> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const response = await this._doFetchRequest({ url, method, headers, body, timeout });

        if (response.status >= 200 && response.status < 300) {
          return response;
        }

        lastError = new Error(`[Fetch Request] Failed to fetch ${url} with status ${response.status}`);
        await this.sleep(retryDelay);

      } catch (err) {
        lastError = err;

        if (attempt < retryCount) {
          await this.sleep(retryDelay);
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error(`[fetch_service] Failed to fetch ${url}: unknown error`);
  }

  private async _doFetchRequest({
    url,
    method,
    headers,
    body,
    timeout,
  }: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
    timeout: number;
  }): Promise<FetchResponse<unknown>> {
    const startTime = process.hrtime.bigint();

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: await response.json().catch(() => ({})),
        duration,
        success: response.status >= 200 && response.status < 300,
      };
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      return {
        status: 0,
        statusText: 'Failed to fetch',
        headers: {},
        data: { error: true, message: String(error), request: { url, method } },
        duration,
        success: false,
        error: String(error),
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  send<RequestType extends Record<string, unknown>, ResponseType>(
    url: string,
    data: RequestType,
    options?: Record<string, any>
  ): Promise<FetchResponse<ResponseType>> {
    return this.fetch<ResponseType>({
      url: `${url}(${data.id})`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data,
      timeout: options?.timeout ?? this._getTimeout(),
      retryCount: options?.retryCount ?? this._getRetryCount(),
      retryDelay: options?.retryDelay ?? this._getRetryDelay(),
    });
  }

  get(url: string, options?: Record<string, any>): Promise<FetchResponse> {
    return this.fetch({ url, method: 'GET', ...options });
  }

  post<T = unknown>(url: string, body?: T, options?: Record<string, any>): Promise<FetchResponse<T>> {
    return this.fetch<T>({ url, method: 'POST', body, ...options });
  }

  put<T = unknown>(url: string, body?: T, options?: Record<string, any>): Promise<FetchResponse<T>> {
    return this.fetch<T>({ url, method: 'PUT', body, ...options });
  }

  patch<T = unknown>(url: string, body?: T, options?: Record<string, any>): Promise<FetchResponse<T>> {
    return this.fetch<T>({ url, method: 'PATCH', body, ...options });
  }

  delete<T = unknown>(url: string, options?: Record<string, any>): Promise<FetchResponse<T>> {
    return this.fetch<T>({ url, method: 'DELETE', ...options });
  }

  static async fetch<T = unknown>(url: string, options?: FetchOptions): Promise<FetchResponse<T>> {
    return new FetchService(options).fetch<T>({
      url,
      method: options?.method ?? 'GET',
      headers: options?.headers,
      body: options?.body,
      timeout: options?.timeout,
      retryCount: options?.retryCount,
    });
  }

  static async get<T = unknown>(url: string, options?: Record<string, any>): Promise<FetchResponse<T>> {
    return new FetchService(options).get<T>(url, options);
  }

  static async post<T = unknown>(url: string, body: unknown, options?: Record<string, any>): Promise<FetchResponse<T>> {
    return new FetchService(options).post<T>(url, body, options);
  }

  static async put<T = unknown>(url: string, body: unknown, options?: Record<string, any>): Promise<FetchResponse<T>> {
    return new FetchService(options).put<T>(url, body, options);
  }

  static async patch<T = unknown>(url: string, body: unknown, options?: Record<string, any>): Promise<FetchResponse<T>> {
    return new FetchService(options).patch<T>(url, body, options);
  }

  static async delete<T = unknown>(url: string, options?: Record<string, any>): Promise<FetchResponse<T>> {
    return new FetchService(options).delete<T>(url, options);
  }
}

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}
