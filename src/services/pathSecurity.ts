import * as pathModule from 'node:path';
import { stat } from 'node:fs/promises';

export class PathSecurityError extends Error {
  constructor(
    message: string,
    public readonly attemptedPath: string
  ) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

export function sanitizePath(inputPath: string, allowedRoot?: string): string {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new PathSecurityError('Invalid path provided', inputPath);
  }

  if (inputPath.includes('..') || inputPath.includes('\0')) {
    throw new PathSecurityError('Path traversal attempt detected', inputPath);
  }

  const resolved = pathModule.resolve(allowedRoot || '.', inputPath);
  if (allowedRoot && !isWithinRoot(resolved, allowedRoot)) {
    throw new PathSecurityError('Path outside allowed directory', inputPath);
  }
  return resolved;
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

  return sanitizePath(pathModule.join(...components), sanitizePath(basePath));
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

function isWithinRoot(candidate: string, root: string): boolean {
  const relative = pathModule.relative(root, candidate);
  return (
    relative !== '..' &&
    !relative.startsWith('..' + pathModule.sep) &&
    !pathModule.isAbsolute(relative)
  );
}
