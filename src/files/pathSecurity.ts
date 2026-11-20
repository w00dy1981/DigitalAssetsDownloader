import * as pathModule from 'node:path';

export class PathSecurityError extends Error {
  constructor(
    message: string,
    public readonly attemptedPath: unknown
  ) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

export function sanitizePath(inputPath: unknown, allowedRoot?: string): string {
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

export function joinFilename(folder: unknown, filename: unknown): string {
  if (
    typeof filename !== 'string' ||
    !filename ||
    filename === '.' ||
    pathModule.basename(filename) !== filename
  ) {
    throw new PathSecurityError('Invalid filename', filename);
  }
  return sanitizePath(filename, sanitizePath(folder));
}

function isWithinRoot(candidate: string, root: string): boolean {
  const relative = pathModule.relative(root, candidate);
  return (
    relative !== '..' &&
    !relative.startsWith('..' + pathModule.sep) &&
    !pathModule.isAbsolute(relative)
  );
}
