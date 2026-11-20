import * as path from 'node:path';

export function joinFilename(folder: string, filename: string): string {
  if (!folder) throw new Error('Select an output folder');
  if (
    !filename ||
    filename === '.' ||
    filename === '..' ||
    path.basename(filename) !== filename
  ) {
    throw new Error('Expected a filename within the selected output folder');
  }
  return path.join(path.resolve(folder), filename);
}
