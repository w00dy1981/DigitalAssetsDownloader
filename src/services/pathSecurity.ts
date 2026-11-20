import * as pathModule from 'node:path';
import { stat, readdir } from 'node:fs/promises';

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

  if (inputPath.includes('..') || inputPath.includes('\0')) {
    throw new PathSecurityError('Path traversal attempt detected', inputPath);
  }

  const normalizedPath = pathModule.normalize(inputPath);

  if (normalizedPath.includes('..')) {
    throw new PathSecurityError(
      'Path traversal attempt detected after normalization',
      inputPath
    );
  }

  if (!allowedRoot) {
    const resolved = pathModule.isAbsolute(normalizedPath)
      ? normalizedPath
      : pathModule.resolve(normalizedPath);
    return resolved;
  }

  const resolvedAllowedRoot = pathModule.normalize(allowedRoot);
  const resolvedPath = pathModule.normalize(
    pathModule.isAbsolute(normalizedPath)
      ? normalizedPath
      : pathModule.join(resolvedAllowedRoot, normalizedPath)
  );

  if (!isWithinRoot(resolvedPath, resolvedAllowedRoot)) {
    throw new PathSecurityError(
      `Path outside allowed directory: ${resolvedPath} not within ${resolvedAllowedRoot}`,
      inputPath
    );
  }

  if (options.allowedRoots && options.allowedRoots.length > 0) {
    const normalizedRoots = options.allowedRoots.map(root =>
      pathModule.normalize(root)
    );
    const isAllowed = normalizedRoots.some(root =>
      isWithinRoot(resolvedPath, root)
    );

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
    throw error;
  }
}

/**
 * Safely joins path components, preventing traversal attacks
 * @param basePath Base directory path
 * @param components Path components to join
 * @returns Sanitized joined path
 */
export function safeJoin(basePath: string, ...components: string[]): string {
  if (!basePath || typeof basePath !== 'string') {
    throw new PathSecurityError('Invalid base path provided', basePath);
  }

  for (const component of components) {
    if (!component || typeof component !== 'string') {
      throw new PathSecurityError('Invalid path component', component);
    }

    if (
      component.includes('..') ||
      component.includes('\0') ||
      pathModule.isAbsolute(component)
    ) {
      throw new PathSecurityError('Unsafe path component detected', component);
    }
  }

  const joinedPath = pathModule.join(basePath, ...components);
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

    const stats = await stat(safePath);

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
    const stats = await stat(safeDirPath);
    if (!stats.isDirectory()) {
      throw new PathSecurityError('Path is not a directory', dirPath);
    }

    const entries = await readdir(safeDirPath);
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
      `Failed to read directory: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      dirPath
    );
  }
}

function isWithinRoot(candidate: string, root: string): boolean {
  const relative = pathModule.relative(root, candidate);
  return (
    relative !== '..' &&
    !relative.startsWith('..' + pathModule.sep) &&
    !pathModule.isAbsolute(relative)
  );
}
