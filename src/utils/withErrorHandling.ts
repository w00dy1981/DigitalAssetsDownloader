/**
 * withErrorHandling - Higher-order function for consistent error handling
 *
 * Wraps async operations with standardized error handling using ErrorHandlingService.
 * Eliminates repetitive try-catch blocks throughout the services layer.
 *
 * Follows KISS and DRY principles:
 * - KISS: Simple wrapper function that does one thing well
 * - DRY: Eliminates repeated try-catch-errorHandler patterns
 * - SOLID: Single responsibility - only handles error wrapping
 */

import {
  errorHandler,
  ErrorHandlingOptions,
} from '@/services/ErrorHandlingService';

export interface WithErrorHandlingOptions
  extends Partial<ErrorHandlingOptions> {
  /**
   * Return null instead of throwing when error occurs
   * Useful for operations where failure should be handled gracefully
   */
  returnNullOnError?: boolean;
}

/**
 * Wraps an async operation with consistent error handling
 *
 * @param operation - The async function to execute
 * @param context - Context string for error logging and categorization
 * @param options - Error handling configuration
 * @returns Promise that resolves to operation result or null (if returnNullOnError is true)
 *
 * @example
 * ```typescript
 * // Basic usage - throws on error
 * const result = await withErrorHandling(
 *   () => fs.promises.readFile(path),
 *   'FileRead'
 * );
 *
 * // Return null on error instead of throwing
 * const result = await withErrorHandling(
 *   () => downloadFile(url),
 *   'Download',
 *   { returnNullOnError: true, throwOnError: false }
 * );
 * ```
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  options: WithErrorHandlingOptions = {}
): Promise<T | null> {
  const { returnNullOnError = false, ...errorHandlingOptions } = options;

  try {
    return await operation();
  } catch (error) {
    const handledError = errorHandler.handleError(error, context, {
      throwOnError: returnNullOnError ? false : true,
      ...errorHandlingOptions,
    });

    if (returnNullOnError) {
      return null;
    }

    // If we get here, throwOnError was true and errorHandler didn't throw
    // This should not happen in normal operation, but provides type safety
    throw handledError;
  }
}

/**
 * Wraps a synchronous function that returns a promise (async function factory)
 * Creates a new function with consistent error handling applied
 *
 * @param fn - Function that returns a Promise
 * @param context - Context string for error logging
 * @param options - Error handling configuration
 * @returns New function with error handling wrapper
 *
 * @example
 * ```typescript
 * const safeDownload = wrapAsyncFunction(
 *   (url: string) => axios.get(url),
 *   'HTTP_Download'
 * );
 *
 * // Usage - errors are handled consistently
 * const response = await safeDownload('https://example.com/file.jpg');
 * ```
 */
export function wrapAsyncFunction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  context: string,
  options: WithErrorHandlingOptions = {}
): (...args: TArgs) => Promise<TResult | null> {
  return async (...args: TArgs): Promise<TResult | null> => {
    return withErrorHandling(() => fn(...args), context, options);
  };
}

/**
 * Batch error handling for multiple operations
 * Executes operations in parallel with consistent error handling
 *
 * @param operations - Array of operations to execute
 * @param context - Context string for error logging
 * @param options - Error handling configuration
 * @returns Array of results (null for failed operations if returnNullOnError is true)
 *
 * @example
 * ```typescript
 * const results = await withErrorHandlingBatch([
 *   () => downloadFile(url1),
 *   () => downloadFile(url2),
 *   () => downloadFile(url3)
 * ], 'BatchDownload', { returnNullOnError: true });
 *
 * // results contains mix of successful downloads and nulls for failures
 * ```
 */
export async function withErrorHandlingBatch<T>(
  operations: (() => Promise<T>)[],
  context: string,
  options: WithErrorHandlingOptions = {}
): Promise<(T | null)[]> {
  const promises = operations.map((operation, index) =>
    withErrorHandling(operation, `${context}[${index}]`, {
      returnNullOnError: true,
      ...options,
    })
  );

  return Promise.all(promises);
}
