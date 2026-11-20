import * as fs from 'fs/promises';
import { setTimeout } from 'timers/promises';
import axios from 'axios';
import type { Readable } from 'node:stream';
import type { PlannedAsset } from './downloadPlan';
import { joinFilename, sanitizePath } from '../files/pathSecurity';

export interface SourceDetails {
  url: string;
  httpStatus: number;
  contentType: string;
}

async function listImageNames(folder: string): Promise<string[]> {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  return entries
    .filter(
      entry =>
        entry.isFile() &&
        !entry.name.includes('..') &&
        /\.(?:jpe?g|png|gif|bmp|webp|tiff?)$/i.test(entry.name)
    )
    .map(entry => entry.name);
}

interface SourceImage {
  name: string;
  filePath: string;
}

async function listSourceImages(folder: string): Promise<SourceImage[]> {
  try {
    const root = sanitizePath(folder);
    return (await listImageNames(root)).map(filename => ({
      name: filename.toLowerCase(),
      filePath: joinFilename(root, filename),
    }));
  } catch (error) {
    console.warn(
      'Could not search the source image folder',
      describeError(error)
    );
    return [];
  }
}

function findSourceImage(
  asset: Extract<PlannedAsset, { kind: 'image' }>,
  files: readonly SourceImage[]
): string | undefined {
  for (const name of [asset.sourceFilename, asset.productCode.trim()]) {
    if (!name) continue;
    const query = name.toLowerCase();
    const match = files.find(file => file.name.includes(query));
    if (match) return match.filePath;
  }
}

async function readLocalSource(
  location: string,
  kind: PlannedAsset['kind'],
  signal: AbortSignal
): Promise<Buffer> {
  let file = sanitizePath(location);
  if (kind === 'image' && (await fs.stat(file)).isDirectory()) {
    const [candidate] = await listImageNames(file);
    if (!candidate) throw new Error('No image files found in directory');
    file = joinFilename(file, candidate);
  }
  return fs.readFile(file, { signal });
}

export interface HttpSettings {
  connectionTimeout: number;
  readTimeout: number;
  retryAttempts: number;
}

async function fetchSource(
  url: string,
  signal: AbortSignal,
  settings: HttpSettings
) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await axios.get<Readable>(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/*,application/pdf,*/*;q=0.8',
        },
        timeout: Math.ceil(settings.connectionTimeout * 1000),
        responseType: 'stream',
        signal,
      });
      // Axios' Node timeout covers the wait for headers. Bound the time between body chunks separately.
      response.request.setTimeout(0);
      const timeout =
        settings.readTimeout > 0
          ? globalThis.setTimeout(
              () => response.data.destroy(new Error('Read timeout')),
              Math.ceil(settings.readTimeout * 1000)
            )
          : undefined;
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of response.data) {
          timeout?.refresh();
          chunks.push(chunk);
        }
        return {
          httpStatus: response.status,
          contentType: String(response.headers['content-type'] ?? ''),
          buffer: Buffer.concat(chunks),
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      if (axios.isAxiosError<Readable>(error)) error.response?.data.destroy();
      if (attempt >= settings.retryAttempts || signal.aborted) throw error;
      await setTimeout(Math.min(1000 * attempt, 5000), undefined, { signal });
    }
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface AssetSource {
  location: string;
  kind: 'http' | 'file';
}

async function mappedSource(value: string): Promise<AssetSource> {
  const address = value.trim();
  if (/^https?:\/\//i.test(address)) return { kind: 'http', location: address };
  if (/^www\.[^/\\\s?#]+/i.test(address) && !address.includes('\\')) {
    // An existing relative file or folder can also start with "www.".
    try {
      await fs.access(value);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        ['ENOENT', 'ENOTDIR', 'ENAMETOOLONG', 'EINVAL'].includes(
          String(error.code)
        )
      ) {
        return { kind: 'http', location: 'https://' + address };
      }
    }
  }
  return { kind: 'file', location: value };
}

export function createSourceSelector(folder: string) {
  let folderImages: Promise<SourceImage[]> | undefined;
  return async function* selectSources(asset: PlannedAsset) {
    const seen = new Set<string>();
    if (asset.kind === 'image' && folder) {
      const local = findSourceImage(
        asset,
        await (folderImages ??= listSourceImages(folder))
      );
      if (local) {
        seen.add(local);
        yield { kind: 'file', location: local } satisfies AssetSource;
      }
    }
    for (const value of asset.urls) {
      const source = await mappedSource(value);
      if (seen.has(source.location)) continue;
      seen.add(source.location);
      yield source;
    }
  };
}

export async function readSource(
  source: AssetSource,
  kind: PlannedAsset['kind'],
  signal: AbortSignal,
  http: HttpSettings
) {
  if (source.kind === 'http') return fetchSource(source.location, signal, http);
  return {
    buffer: await readLocalSource(source.location, kind, signal),
    httpStatus: 200,
    contentType: 'local_file_processed',
  };
}

export function sourceFailure(details: SourceDetails, error: unknown) {
  return {
    ...details,
    success: false as const,
    httpStatus: axios.isAxiosError(error)
      ? (error.response?.status ?? 0)
      : details.httpStatus,
    error: describeError(error),
  };
}
