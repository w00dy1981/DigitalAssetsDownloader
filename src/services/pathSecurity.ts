import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Path Security Utilities
 * Prevents path traversal attacks and validates file system access
 */

export interface PathValidationOptions {
  allowedRoots?: string[];
  allowAbsolute?: boolean;
  maxDepth?: number;
}

export class PathSecurityError extends Error {
  constructor(
    message: string,
    public readonly attemptedPath: string
  ) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

/**
 * Sanitizes and validates a file path to prevent directory traversal attacks
 * @param inputPath The path to sanitize
 * @param allowedRoot Optional root directory to restrict access to
 * @param options Additional validation options
 * @returns Sanitized absolute path
 * @throws PathSecurityError if path is malicious or outside allowed boundaries
 */
export function sanitizePath(
  inputPath: string,
  allowedRoot?: string,
  options: PathValidationOptions = {}
): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new PathSecurityError('Invalid path provided', inputPath);
  }

  // Detect obvious traversal attempts
  if (inputPath.includes('..') || inputPath.includes('\0')) {
    throw new PathSecurityError('Path traversal attempt detected', inputPath);
  }

  // Normalize the path to resolve any relative components
  const normalizedPath = path.normalize(inputPath);

  // Check for traversal attempts in normalized path
  if (normalizedPath.includes('..')) {
    throw new PathSecurityError(
      'Path traversal attempt detected after normalization',
      inputPath
    );
  }

  // If no allowed root specified, return normalized path
  if (!allowedRoot) {
    return path.resolve(normalizedPath);
  }

  // Resolve both paths to absolute paths
  const resolvedAllowedRoot = path.resolve(allowedRoot);
  const resolvedPath = path.resolve(resolvedAllowedRoot, normalizedPath);

  // Ensure the resolved path is within the allowed root
  if (
    !resolvedPath.startsWith(resolvedAllowedRoot + path.sep) &&
    resolvedPath !== resolvedAllowedRoot
  ) {
    throw new PathSecurityError(
      `Path outside allowed directory: ${resolvedPath} not within ${resolvedAllowedRoot}`,
      inputPath
    );
  }

  // Check against allowed roots if multiple are specified
  if (options.allowedRoots && options.allowedRoots.length > 0) {
    const isAllowed = options.allowedRoots.some(root => {
      const resolvedRoot = path.resolve(root);
      return (
        resolvedPath.startsWith(resolvedRoot + path.sep) ||
        resolvedPath === resolvedRoot
      );
    });

    if (!isAllowed) {
      throw new PathSecurityError(
        `Path not in any allowed directory: ${resolvedPath}`,
        inputPath
      );
    }
  }

  return resolvedPath;
}

/**
 * Validates if a file path is safe to access
 * @param filePath Path to validate
 * @param allowedRoot Optional root directory restriction
 * @returns true if path is safe, false otherwise
 */
export function isPathSafe(filePath: string, allowedRoot?: string): boolean {
  try {
    sanitizePath(filePath, allowedRoot);
    return true;
  } catch (error) {
    if (error instanceof PathSecurityError) {
      console.warn(`Unsafe path detected: ${error.message}`);
      return false;
    }
    // Re-throw non-security errors
    throw error;
  }
}

/**
 * Safely joins path components, preventing traversal attacks
 * @param basePath Base directory path
 * @param ...components Path components to join
 * @returns Sanitized joined path
 */
export function safeJoin(basePath: string, ...components: string[]): string {
  if (!basePath || typeof basePath !== 'string') {
    throw new PathSecurityError('Invalid base path provided', basePath);
  }

  // Validate each component
  for (const component of components) {
    if (!component || typeof component !== 'string') {
      throw new PathSecurityError('Invalid path component', component);
    }

    if (
      component.includes('..') ||
      component.includes('\0') ||
      path.isAbsolute(component)
    ) {
      throw new PathSecurityError('Unsafe path component detected', component);
    }
  }

  const joinedPath = path.join(basePath, ...components);
  return sanitizePath(joinedPath, basePath);
}

/**
 * Validates that a file exists and is accessible within security constraints
 * @param filePath Path to file
 * @param allowedRoot Optional root directory restriction
 * @returns Promise resolving to true if file is safe and accessible
 */
export async function validateFileAccess(
  filePath: string,
  allowedRoot?: string
): Promise<boolean> {
  try {
    const safePath = sanitizePath(filePath, allowedRoot);

    // Check if file exists and is accessible
    const stats = await fs.stat(safePath);

    // Additional security check: ensure it's actually a file
    if (!stats.isFile()) {
      console.warn(`Path is not a file: ${safePath}`);
      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof PathSecurityError) {
      console.warn(`File access denied: ${error.message}`);
      return false;
    }
    // File doesn't exist or other I/O error
    return false;
  }
}

/**
 * Safely reads directory contents within security constraints
 * @param dirPath Directory path to read
 * @param allowedRoot Optional root directory restriction
 * @returns Promise resolving to array of safe file paths
 */
export async function safeReadDir(
  dirPath: string,
  allowedRoot?: string
): Promise<string[]> {
  const safeDirPath = sanitizePath(dirPath, allowedRoot);

  try {
    const stats = await fs.stat(safeDirPath);
    if (!stats.isDirectory()) {
      throw new PathSecurityError('Path is not a directory', dirPath);
    }

    const entries = await fs.readdir(safeDirPath);
    const safePaths: string[] = [];

    for (const entry of entries) {
      try {
        const entryPath = safeJoin(safeDirPath, entry);
        safePaths.push(entryPath);
      } catch (error) {
        if (error instanceof PathSecurityError) {
          console.warn(`Skipping unsafe directory entry: ${entry}`);
          continue;
        }
        throw error;
      }
    }

    return safePaths;
  } catch (error) {
    if (error instanceof PathSecurityError) {
      throw error;
    }
    throw new PathSecurityError(
      `Failed to read directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      dirPath
    );
  }
}
