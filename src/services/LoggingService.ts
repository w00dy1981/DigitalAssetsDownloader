/**
 * LoggingService - Centralized logging with structured output
 * Following KISS principle - simple, focused, single responsibility
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  data?: any;
  error?: Error;
}

export class LoggingService {
  private static instance: LoggingService;
  private currentLogLevel: LogLevel = LogLevel.INFO;
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 1000;

  private constructor() {}

  static getInstance(): LoggingService {
    if (!this.instance) {
      this.instance = new LoggingService();
    }
    return this.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }

  private log(level: LogLevel, message: string, context?: string, data?: any, error?: Error): void {
    if (level < this.currentLogLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      data,
      error,
    };

    // Add to history
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    // Format and output
    const formattedMessage = this.formatMessage(entry);
    
    switch (level) {
      case LogLevel.DEBUG:
        console.log(formattedMessage, data || '');
        break;
      case LogLevel.INFO:
        console.log(formattedMessage, data || '');
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, data || '');
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, error || data || '');
        break;
    }
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    const context = entry.context ? `[${entry.context}]` : '';
    
    return `[${timestamp}] [${level}]${context} ${entry.message}`;
  }

  debug(message: string, context?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  error(message: string, error?: Error | string, context?: string): void {
    if (typeof error === 'string') {
      this.log(LogLevel.ERROR, message, context, undefined, new Error(error));
    } else {
      this.log(LogLevel.ERROR, message, context, undefined, error);
    }
  }

  getHistory(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logHistory.filter(entry => entry.level === level);
    }
    return [...this.logHistory];
  }

  clearHistory(): void {
    this.logHistory = [];
  }

  // Convenience method for download progress
  downloadProgress(fileName: string, progress: number, speed?: string): void {
    this.info(`Download progress: ${progress}%`, 'Download', {
      fileName,
      progress,
      speed,
    });
  }

  // Convenience method for file operations
  fileOperation(operation: string, filePath: string, success: boolean, error?: Error): void {
    const message = `${operation}: ${filePath}`;
    if (success) {
      this.info(message, 'FileSystem');
    } else {
      this.error(message, error, 'FileSystem');
    }
  }

  // Convenience method for validation messages
  validation(field: string, valid: boolean, reason?: string): void {
    const message = `Validation ${valid ? 'passed' : 'failed'} for ${field}${reason ? `: ${reason}` : ''}`;
    if (valid) {
      this.debug(message, 'Validation');
    } else {
      this.warn(message, 'Validation');
    }
  }
}

// Export singleton instance for convenience
export const logger = LoggingService.getInstance();