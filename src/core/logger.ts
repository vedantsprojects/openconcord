import * as path from "path";
import * as fs from "fs";

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARNING = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * Log entry with structured metadata
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  service: string;
  message: string;
  correlationID?: string;
  spanID?: string;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Rolling file logger with configurable rotation.
 */
export class LogWriter {
  private readonly level: LogLevel;
  private readonly loggerName: string;
  private _writeToFile: boolean = false;
  private _writeToConsole: boolean = true;
  private _writeToOutput: boolean = false;
  private _logPath: string;

  static readonly logLevels: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    error: LogLevel.ERROR,
    warn: LogLevel.WARNING,
    info: LogLevel.INFO,
    fatal: LogLevel.FATAL,
  };

  constructor(
    level: LogLevel | string,
    loggerName: string,
    logLevelThreshold: LogLevel = LogLevel.DEBUG
  ) {
    this.level = typeof level === "string" ? LogWriter.logLevels[level.toLowerCase()] ?? LogLevel.INFO : level;
    this.loggerName = loggerName;
    this._logPath = "";
    this._createLogDirectory();
  }

  private static levels: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: "debug",
    [LogLevel.INFO]: "info",
    [LogLevel.WARNING]: "warn",
    [LogLevel.ERROR]: "error",
    [LogLevel.FATAL]: "fatal",
  };

  private static colors: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: "\x1B[36m", // cyan
    [LogLevel.INFO]: "\x1B[32m",  // green
    [LogLevel.WARNING]: "\x1B[33m", // yellow
    [LogLevel.ERROR]: "\x1B[31m",  // red
    [LogLevel.FATAL]: "\x1B[91m\x1B[1m", // bright red
  };

  get level(): LogLevel {
    return this.level;
  }

  set level(val: LogLevel) {
    this.level = val;
  }

  get loggerName(): string {
    return this.loggerName;
  }

  set loggerName(val: string) {
    this.loggerName = val;
  }

  get _writeToFile(): boolean {
    return this._writeToFile;
  }

  set _writeToFile(val: boolean) {
    this._writeToFile = val;
    this._createLogDirectory();
  }

  get _writeToOutput(): boolean {
    return this._writeToOutput;
  }

  set _writeToOutput(val: boolean) {
    this._writeToOutput = val;
  }

  get _logPath(): string {
    return this._logPath;
  }

  set _logPath(val: string) {
    this._logPath = val;
  }

  get _writeToConsole(): boolean {
    return this._writeToConsole;
  }

  set _writeToConsole(val: boolean) {
    this._writeToConsole = val;
    this._consoleLoggerName = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  }

  private _consoleLoggerName = "console-logger";

  private _createLogDirectory(): void {
    if (this._logPath && !fs.existsSync(this._logPath)) {
      fs.mkdirSync(this._logPath, { recursive: true });
    }
  }

  getPrefix(): string {
    return `[${LogWriter.colors[this.level]}\x1B[95m${this.loggerName}\x1B[0m]:`;
  }

  log(logLevel: LogLevel, message: string, correlationID: string, error?: Error, metadata?: Record<string, unknown>): void;

  log(logLevel: LogLevel, message: string): void;

  log(logLevel: LogLevel, message: string, correlationID?: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (logLevel < this.level) {
      return;
    }
    const currentLevel = LogWriter.levels[logLevel.toString()];
    const logMessage =
      `${LogWriter.colors[currentLevel]}[${currentLevel.toUpperCase()}] ${this.loggerName}:${message}\x1B[0m`;
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level: logLevel,
      service: this.loggerName,
      message: message,
      correlationID,
      spanID: correlationID,
      error,
      metadata,
    };
    if (this._writeToConsole) {
      console.log(logMessage);
    }
    if (this._writeToOutput) {
      process.stdout.write(logMessage);
    }
    if (this._writeToFile) {
      try {
        this.writeToFile(logEntry);
      } catch (error) {
        console.error(error as object);
      }
    }
  }

  debug(msg: string, correlationID?: string): void;
  debug(msg: string, correlationID?: string, ...args: unknown[]): void;

  debug(msg: string, correlationID?: string, ...args: unknown[]): void {
    const message = this.formatMessage(msg, ...args);
    this.log(LogLevel.DEBUG, message, correlationID);
  }

  info(msg: string, correlationID?: string): void;
  info(msg: string, correlationID?: string, ...args: unknown[]): void;

  info(msg: string, correlationID?: string, ...args: unknown[]): void {
    const message = this.formatMessage(msg, ...args);
    this.log(LogLevel.INFO, message, correlationID);
  }

  warn(msg: string, correlationID?: string): void;
  warn(msg: string, correlationID?: string, ...args: unknown[]): void;

  warn(msg: string, correlationID?: string, ...args: unknown[]): void {
    const message = this.formatMessage(msg, ...args);
    this.log(LogLevel.WARNING, message, correlationID);
  }

  error(msg: string, correlationID?: string): void;
  error(msg: string, correlationID?: string, ...args: unknown[]): void;

  error(msg: string, correlationID?: string, ...args: unknown[]): void {
    const message = this.formatMessage(msg, ...args);
    this.log(LogLevel.ERROR, message, correlationID, args[0] as Error);
  }

  fatal(msg: string, correlationID?: string): void;
  fatal(msg: string, correlationID?: string, ...args: unknown[]): void;

  fatal(msg: string, correlationID?: string, ...args: unknown[]): void {
    const message = this.formatMessage(msg, ...args);
    this.log(LogLevel.FATAL, message, correlationID, args[0] as Error);
  }

  private writeToFile(entry: LogEntry): void {
    try {
      const logEntryRaw = this.formatLogEntry(entry);
      fs.appendFileSync(path.join(this._logPath, `${this.loggerName}.log`), logEntryRaw + "\n");
    } catch (error) {
      console.error(error);
    }
  }

  private formatMessage(msg: string, ...args: unknown[]): string {
    return args.length > 0 ? msg.replace("{0}", `${args[0]}`) : msg;
  }

  private formatLogEntry(entry: LogEntry): string {
    let logMessage = `[${new Date(entry.timestamp).toISOString()}] [${LogWriter.levels[entry.level]}] [${entry.correlationID}] [${entry.service}]: ${entry.message}`;
    if (entry.error) {
      logMessage += ` Error: ${JSON.stringify(entry.error)}`;
    }
    if (entry.metadata) {
      logMessage += ` Meta: ${JSON.stringify(entry.metadata)}`;
    }
    return logMessage;
  }

  logError(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  createTimestampedLogFileName(): string {
    return `${this.loggerName}-${new Date(Date.now()).toISOString().replace(/[:.]/g, "-")}.log`;
  }

  close(): void {
    this._writeToFile = false;
  }
}

/**
 * Universal logger wrapper coordinating multiple writers.
 */
export class Logger {
  private _loggers: LogWriter[] = [];

  getLogger(name: string): Logger;
  getLogger(name: string, level: LogLevel, logPath: string): Logger;

  getLogger(
    name: string,
    options: {
      level?: LogLevel;
      logPath?: string;
      logToFile?: boolean;
      logToConsole?: boolean;
      logToOutput?: boolean;
    }
  ): Logger;

  getLogger(name: string, level?: LogLevel | { level?: LogLevel; logPath?: string; logToFile?: boolean; logToConsole?: boolean; logToOutput?: boolean }): Logger {
    const writer = new LogWriter(
      typeof level === "object" ? LogLevel.DEBUG : (level ?? LogLevel.DEBUG),
      name
    );
    writer.loggerName = name;
    writer._writeToFile = !!options?.logToFile;
    writer._writeToConsole = !!options?.logToConsole;
    writer._writeToOutput = !!options?.logToOutput;
    writer._logPath = typeof level === "object" && typeof level.logPath === "string" ? level.logPath : (options.logPath ?? "");

    this._loggers.push(writer);
    return new Logger({ _loggers: this._loggers, levels: LogWriter.levels });
  }

  getLoggerStatic(name: string): Logger {
    const logger = this.getLogger(name);
    return logger;
  }

  private constructor(
    private _loggers: LogWriter[],
    private levels: Record<LogLevel, string>
  ) {}

  static levels: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: "debug",
    [LogLevel.INFO]: "info",
    [LogLevel.WARNING]: "warn",
    [LogLevel.ERROR]: "error",
    [LogLevel.FATAL]: "fatal",
  };

  static colors: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: "\x1B[36m",
    [LogLevel.INFO]: "\x1B[32m",
    [LogLevel.WARNING]: "\x1B[33m",
    [LogLevel.ERROR]: "\x1B[31m",
    [LogLevel.FATAL]: "\x1B[91m\x1B[1m",
  };

  setLogLevelToDefault(): void {
    for (const _logger of this._loggers) {
      _logger.level = LogLevel.DEBUG;
    }
  }

  debug(message: string): void;
  debug(message: string, correlationID: string): void;
  debug(name: string, ...args: unknown[]): void;

  debug(params1: string, params2?: string, ...args: unknown[]): void {
    if (params1 === void 0 || params1 === "") {
      parameters = [params2];
      args = parameters.filter((p) => p);
    }
    for (const _logger of this._loggers) {
      _logger.log(
        LogLevel.DEBUG,
        this.getLogMessage(params1, params2, ...args),
        params1 ? (params2 ?? "") : undefined
      );
    }
  }

  info(message: string): void;
  info(message: string, correlationID: string): void;
  info(name: string, ...args: unknown[]): void;

  info(params1: string, params2?: string, ...args: unknown[]): void {
    if (params1 === void 0 || params1 === "") {
      parameters = [params2];
      args = parameters.filter((p) => p);
    }
    for (const _logger of this._loggers) {
      _logger.log(
        LogLevel.INFO,
        this.getLogMessage(params1, params2, ...args),
        params1 ? (params2 ?? "") : undefined
      );
    }
  }

  warn(message: string): void;
  warn(message: string, correlationID: string): void;
  warn(name: string, ...args: unknown[]): void;

  warn(params1: string, params2?: string, ...args: unknown[]): void {
    if (params1 === void 0 || params1 === "") {
      parameters = [params2];
      args = parameters.filter((p) => p);
    }

    for (const _logger of this._loggers) {
      _logger.log(
        LogLevel.WARNING,
        this.getLogMessage(params1, params2, ...args),
        params1 ? (params2 ?? "") : undefined
      );
    }
  }

  error(message: string): void;
  error(message: string, correlationID: string): void;
  error(name: string, ...args: unknown[]): void;

  error(params1: string, params2?: string, ...args: unknown[]): void {
    if (params1 === void 0 || params1 === "") {
      parameters = [params2];
      args = parameters.filter((p) => p);
    }
    for (const _logger of this._loggers) {
      _logger.log(
        LogLevel.ERROR,
        this.getLogMessage(params1, params2, ...args),
        params1 ? (params2 ?? "") : undefined,
        args[0], // Error
        {}
      );
    }
  }

  log(logLevel: LogLevel, message: string, correlationID: string, error?: Error): void;

  log(logLevel: LogLevel, message: string, correlationID: string, error?: Error, metadata?: Record<string, unknown>): void;

  log(logLevel: LogLevel, message: string, correlationID?: string, error?: Error, metadata?: Record<string, unknown>): void {
    for (const _logger of this._loggers) {
      _logger.log(logLevel, message, correlationID, error, metadata);
    }
  }

  fatal(message: string): void;
  fatal(message: string, correlationID: string): void;
  fatal(name: string, ...args: unknown[]): void;

  fatal(params1: string, params2?: string, ...args: unknown[]): void {
    if (params1 === void 0 || params1 === "") {
      parameters = [params2];
      args = parameters.filter((p) => p);
    }
    for (const _logger of this._loggers) {
      _logger.log(LogLevel.FATAL, this.getLogMessage(params1, params2, ...args), params1 ? (params2 ?? "") : undefined, args[0], {});
    }
  }

  getLogMessage(message: string, ...args: unknown[]): string {
    var parameters: unknown[];
    var firstParameter, secondParameter;

    firstParameter = args.shift();
    if (args.length === 0) {
      if (firstParameter !== undefined && firstParameter !== "") {
        parameters = [firstParameter];
        args = parameters.filter((p) => p);
      } else {
        args = [];
      }
    } else {
      parameters = [firstParameter, args.shift()];
      for (var i = 0, len = parameters.length; i < len; i++) {
        if (parameters[i] === void 0 || parameters[i] === "") {
          parameters = [parameters[0]];
          args = parameters.filter((p) => p);
        }
      }
    }

    const messageFormatted =
      args.length === 0
        ? message !== " " && message.indexOf("{0}") !== -1
        ? message
        : message
        : message.replace("{0}", `${args[0]}`);

    return messageFormatted;
  }
}
