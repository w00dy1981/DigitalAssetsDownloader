function prefix(message: string, context?: string) {
  return context ? `[${context}] ${message}` : message;
}

export const logger = {
  debug(message: string, context?: string, data?: unknown) {
    if (process.env.NODE_ENV === 'development') console.debug(prefix(message, context), data ?? '');
  },
  info(message: string, context?: string, data?: unknown) {
    console.info(prefix(message, context), data ?? '');
  },
  warn(message: string, context?: string, data?: unknown) {
    console.warn(prefix(message, context), data ?? '');
  },
  error(message: string, error?: Error | string, context?: string) {
    console.error(prefix(message, context), error ?? '');
  },
  validation(field: string, valid: boolean, reason?: string) {
    if (!valid) console.warn(`Validation failed for ${field}: ${reason ?? ''}`);
  },
};
