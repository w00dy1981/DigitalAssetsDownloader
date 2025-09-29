/**
 * Path Security Utilities
 * Prevents path traversal attacks and validates file system access
 */

type NodeRequireFunction = (moduleId: string) => unknown;

interface PathModule {
  sep: string;
  normalize(pathValue: string): string;
  resolve(...paths: string[]): string;
  join(...paths: string[]): string;
  isAbsolute(pathValue: string): boolean;
}

const nodeRequireFn = getNodeRequire();
const nativePathModule = nodeRequireFn
  ? safeRequire<PathModule>(nodeRequireFn, 'path')
  : null;

const pathModule: PathModule = nativePathModule ?? createBrowserPathModule();

const nativeFsPromises = nodeRequireFn
  ? (safeRequire<typeof import('fs/promises')>(nodeRequireFn, 'fs/promises') ??
    (() => {
      const fsModule = safeRequire<typeof import('fs')>(nodeRequireFn, 'fs');
      return fsModule?.promises ?? null;
    })())
  : null;

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
    return formatOutputPath(resolved, inputPath);
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

  return formatOutputPath(resolvedPath, allowedRoot);
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

    if (!nativeFsPromises) {
      console.warn('File system validation attempted without fs access.');
      return false;
    }

    const stats = await nativeFsPromises.stat(safePath);

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

  if (!nativeFsPromises) {
    throw new PathSecurityError(
      'File system access is not available in this environment',
      dirPath
    );
  }

  try {
    const stats = await nativeFsPromises.stat(safeDirPath);
    if (!stats.isDirectory()) {
      throw new PathSecurityError('Path is not a directory', dirPath);
    }

    const entries = await nativeFsPromises.readdir(safeDirPath);
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

function getNodeRequire(): NodeRequireFunction | null {
  // In renderer process, don't attempt to access Node.js require
  if (typeof window !== 'undefined') {
    return null;
  }

  if (typeof globalThis === 'undefined') {
    return null;
  }

  const globalRequire = (globalThis as { require?: NodeRequireFunction })
    .require;
  if (typeof globalRequire === 'function') {
    return globalRequire;
  }

  try {
    const evaluated = eval(
      'typeof require !== "undefined" ? require : undefined'
    );
    if (typeof evaluated === 'function') {
      return evaluated as NodeRequireFunction;
    }
  } catch {
    // Ignore lookup failures
  }

  const nonWebpack = (
    globalThis as {
      __non_webpack_require__?: NodeRequireFunction;
    }
  ).__non_webpack_require__;
  if (typeof nonWebpack === 'function') {
    return nonWebpack;
  }

  return null;
}

function safeRequire<T>(req: NodeRequireFunction, moduleId: string): T | null {
  try {
    return req(moduleId) as T;
  } catch {
    return null;
  }
}

function createBrowserPathModule(): PathModule {
  const sep = '/';

  const normalize = (input: string): string => {
    if (!input) {
      return '.';
    }

    const normalizedInput = normalizeSlashes(input);
    const { prefix, rest, absolute } = splitPrefix(normalizedInput);
    const segments = collapseSegments(rest, absolute || Boolean(prefix));
    const hadTrailingSlash =
      rest.endsWith('/') || (rest === '' && normalizedInput.endsWith('/'));

    let result = segments.join('/');
    if (prefix) {
      const base = absolute ? `${prefix}/` : `${prefix}`;
      result = result ? `${base}${result}` : base;
    } else if (absolute) {
      result = result ? `/${result}` : '/';
    } else if (!result) {
      result = '.';
    }

    if (hadTrailingSlash && result !== '/' && !result.endsWith('/')) {
      result += '/';
    }

    return result;
  };

  const isAbsolute = (value: string): boolean => {
    const normalized = normalizeSlashes(value);
    return (
      normalized.startsWith('/') ||
      /^[a-zA-Z]:\//.test(normalized) ||
      normalized.startsWith('//')
    );
  };

  const join = (...segments: string[]): string => {
    if (!segments.length) {
      return '.';
    }

    const filtered = segments
      .filter(segment => typeof segment === 'string' && segment.length > 0)
      .map(normalizeSlashes);

    if (!filtered.length) {
      return '.';
    }

    return normalize(filtered.join('/'));
  };

  const resolve = (...segments: string[]): string => {
    if (!segments.length) {
      return '.';
    }

    let resolved = '';
    for (const segment of segments) {
      if (!segment) {
        continue;
      }

      if (isAbsolute(segment)) {
        resolved = normalize(segment);
      } else if (resolved) {
        resolved = normalize(`${resolved}/${segment}`);
      } else {
        resolved = normalize(segment);
      }
    }

    return resolved || '.';
  };

  return { sep, normalize, join, resolve, isAbsolute };
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/');
}

function splitPrefix(value: string): {
  prefix: string;
  rest: string;
  absolute: boolean;
} {
  if (value.startsWith('//')) {
    const withoutSlashes = value.replace(/^\/+/, '');
    const parts = withoutSlashes.split('/');
    const host = parts.shift() ?? '';
    const share = parts.shift() ?? '';
    const prefix = `//${host}${share ? `/${share}` : ''}`;
    const rest = parts.join('/');
    return { prefix, rest, absolute: true };
  }

  const driveMatch = value.match(/^([a-zA-Z]:)(.*)$/);
  if (driveMatch) {
    const drive = driveMatch[1];
    const remainder = driveMatch[2] || '';
    const absolute = remainder.startsWith('/');
    const rest = absolute ? remainder.slice(1) : remainder;
    return { prefix: drive, rest, absolute };
  }

  const absolute = value.startsWith('/');
  const rest = absolute ? value.slice(1) : value;
  return { prefix: '', rest, absolute };
}

function collapseSegments(pathPart: string, absolute: boolean): string[] {
  if (!pathPart) {
    return [];
  }

  const rawSegments = pathPart.split('/');
  const stack: string[] = [];

  for (const segment of rawSegments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (stack.length > 0) {
        stack.pop();
      } else if (!absolute) {
        stack.push('..');
      }
      continue;
    }

    stack.push(segment);
  }

  return stack;
}

function toComparisonPath(pathValue: string): string {
  const normalized = pathModule.normalize(pathValue);
  const forward = normalizeSlashes(normalized);
  if (forward.length > 1 && forward.endsWith('/')) {
    return forward.replace(/\/+$/, '');
  }
  return forward;
}

function isWithinRoot(candidate: string, root: string): boolean {
  const normalizedCandidate = toComparisonPath(candidate);
  const normalizedRoot = toComparisonPath(root);

  if (normalizedRoot === '/' || normalizedRoot === '') {
    return normalizedCandidate.startsWith('/');
  }

  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}/`)
  );
}

function formatOutputPath(pathValue: string, reference?: string): string {
  if (nativePathModule) {
    return pathValue;
  }

  if (reference && reference.includes('\\')) {
    return pathValue.replace(/\//g, '\\');
  }

  return pathValue;
}
