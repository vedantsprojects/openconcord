import * as path from 'path';
import * as fs from 'fs';
import { createLogger, Logger, transports, format } from 'winston';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARNING = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogMetadata {
  [key: string]: unknown;
}

type LogLevelToWinston = {
  [key in LogLevel]: keyof typeof transports.Console.prototype;
};

const LEVEL_MAP: LogLevelToWinston = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARNING]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.FATAL]: 'error',
};

function isValidLevel(level: number): level is LogLevel {
  return Object.keys(LogLevel).some((k) => LogLevel[k as LogLevel] === level);
}

function formatTimestamp(timestamp: string) {
  return `${timestamp} |`;
}

function formatLevel(level: keyof typeof transports.Console.prototype) {
  const winstonLevels = Object.keys(LEVEL_MAP)
    .map((k) => LEVEL_MAP[k as LogLevel])
    .filter((l) => l !== undefined);
  const levelVal = winstonLevels[0];
  return levelVal ? `[${levelVal.toUpperCase()}]` : `[UNKNOWN]`;
}

function formatMessage(message: string) {
  return message;
}

function formatError(err?: Error): string {
  if (!err) return '';
  const lines = err.stack ? err.stack.split('\n') : [err.message];
  return lines.join('\n  ');
}

function buildFormattedMessage(
  service: string,
  level: string,
  message: string,
  correlationId?: string,
  error?: Error,
  metadata?: LogMetadata
) {
  const timestamp = new Date().toISOString();
  const metaStr = metadata ? ` 📋 ${JSON.stringify(metadata)}` : '';
  const errorStr = error ? `\n  ${error.stack || error.message}` : '';
  
  const prefix = `${timestamp} | ${formatLevel(
    (LEVEL_MAP[Object.keys(LogLevel).find((k) => (LEVEL_MAP[k as LogLevel] as string) === level) as LogLevel] as string) ||
    'INFO'
  )}`;
  
  return `${prefix} | ${service} ⚡ ${message}${errorStr}${metaStr}`;
}

export class OpenConcordLogger {
  private logger: Logger;
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logger = createLogger({
      level: 'debug',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.printf(
          ({ timestamp, level, message, service: svc, correlationId, error, metadata }) => {
            const prefix = `${timestamp} | [${correlationId || '—'}]`;
            const metaStr = metadata ? ` 📋 ${metadata}` : '';
            const errorStr = error ? `\n  🔴 ${error.message}${error.stack ? '\n' + error.stack : ''}` : '';
            return `${prefix} | ${svc} ⚡  ${message}${errorStr}${metaStr}`;
          }
        )
      ),
      transports: [
        new transports.Console({
          format: format.combine(format.colorize(), format.simple()),
        }),
        new transports.File({
          filename: path.join(process.env.ARAMBH_LOG_PATH || '/tmp', 'openconcord.log'),
          maxsize: 5242880,
          maxSize: 10485760,
          maxFiles: 5,
          timestamp: () => new Date(),
        }),
      ],
      exceptionHandlers: [
        new transports.File({
          filename: path.join(process.env.ARAMBH_LOG_PATH || '/tmp', 'openconcord-exceptions.log'),
          level: 'error',
        }),
      ],
      exitOnError: false,
    });

    this.logger.level = 'debug';
    this.logger.add(
      new transports.Console({
        level: 'info',
        format: format.combine(
          format.colorize({ all: true }),
          format.printf(({ timestamp, level, message }) => {
            const color = level === 'debug' ? '\x1B[36m' : level === 'warn' ? '\x1B[33m' : '\x1B[32m';
            const reset = '\x1B[0m';
            return `${color}[\x1B[1m${level.toUpperCase()}]${reset}] ${timestamp} • ${this.serviceName}: ${message}`;
          })
        ),
      })
    );
  }

  get level(): string {
    return this.logger.level;
  }

  set level(val: string) {
    this.logger.level = val;
  }

  get serviceName(): string {
    return this.serviceName;
  }

  set serviceName(val: string) {
    this.serviceName = val;
  }

  debug(msg: string, ...args: unknown[]) {
    const formatted = this._formatMessage(msg, LogLevel.DEBUG, args);
    this.logger.debug(formatted);
  }

  info(msg: string, ...args: unknown[]) {
    const formatted = this._formatMessage(msg, LogLevel.INFO, args);
    this.logger.info(formatted);
  }

  warn(msg: string, ...args: unknown[]) {
    const formatted = this._formatMessage(msg, LogLevel.WARNING, args);
    this.logger.warn(formatted);
  }

  error(msg: string, ...args: unknown[]) {
    const formatted = this._formatMessage(msg, LogLevel.ERROR, args);
    this.logger.error(formatted);
  }

  fatal(msg: string, ...args: unknown[]) {
    const formatted = this._formatMessage(msg, LogLevel.FATAL, args);
    this.logger.error(formatted);
  }

  private _formatMessage(
    msg: string,
    level: LogLevel,
    args: unknown[]
  ): string {
    const formatted = args.length > 0 ? msg.replace('{0}', String(args[0])) : msg;
    const serviceStr = this.serviceName;
    return serviceStr + ': ' + formatted;
  }

  addTransport(...transports_: transports.TransportInstance[]) {
    this.logger.add(...transports_);
  }

  removeTransport(...transports_: transports.TransportInstance[]) {
    this.logger.remove(...transports_);
  }

  clearAllTransports() {
    this.logger.removeAllTransports();
  }

  createTransports(...transports_: transports.TransportInstance[]) {
    return [...transports_];
  }
}

export class LoggerManager {
  private loggers: Map<string, OpenConcordLogger> = new Map();

  getLogger(serviceName: string): OpenConcordLogger;
  getLogger(options: { name: string; level?: LogLevel }): OpenConcordLogger;

  getLogger(nameOrOptions: string | { name: string; level?: LogLevel }): OpenConcordLogger {
    const options = typeof nameOrOptions === 'string'
      ? { name: nameOrOptions }
      : { name: nameOrOptions };

    const existing = this.loggers.get(options.name);
    if (existing) {
      if (options.level !== undefined) {
        existing.level = options.level.toString();
      }
      return existing;
    }

    const logger = new OpenConcordLogger(options.name);
    this.loggers.set(options.name, logger);
    logger.serviceName = options.name;
    logger.level = Object.keys(LogLevel).find(
      (k) => LogLevel[k as LogLevel] === options.level
    ) || 'info';

    return logger;
  }

  getMainLogger(): OpenConcordLogger {
    return this.getLogger('openconcord:main');
  }

  getRendererLogger(): OpenConcordLogger {
    return this.getLogger('openconcord:renderer');
  }

  getWorktreeLogger(): OpenConcordLogger {
    return this.getLogger('openconcord:worktree');
  }

  getAllLoggers(): OpenConcordLogger[] {
    return Array.from(this.loggers.values());
  }

  clear(serviceNames: string[]): void {
    for (const name of serviceNames) {
      this.loggers.delete(name);
    }
  }
}

export const loggerManager = new LoggerManager();
export const debug = loggerManager.getLogger('openconcord:debug');
export const info = loggerManager.getLogger('openconcord:info');
export const warn = loggerManager.getLogger('openconcord:warn');
export const error = loggerManager.getLogger('openconcord:error');
export const fatal = loggerManager.getLogger('openconcord:fatal');

debug.serviceName = 'openconcord:debug';
info.serviceName = 'openconcord:info';
warn.serviceName = 'openconcord:warn';
error.serviceName = 'openconcord:error';
fatal.serviceName = 'openconcord:fatal';
