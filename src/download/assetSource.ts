import * as fs from 'fs/promises';
import { setTimeout } from 'timers/promises';
import axios from 'axios';
import type { Readable } from 'node:stream';
import type { PlannedAsset } from './downloadPlan';
import * as path from 'node:path';

export interface SourceDetails {
  url: string;
  httpStatus: number;
  contentType: string;
}

async function listFiles(folder: string): Promise<string[]> {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() || entry.isSymbolicLink())
    .map(entry => path.join(folder, entry.name));
}

async function listSourceImages(folder: string) {
  try {
    return await listFiles(path.resolve(folder));
  } catch (error) {
    console.warn(
      'Could not search the source image folder',
      describeError(error)
    );
    throw error;
  }
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
  error?: unknown;
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

async function* mappedSources(value: string, kind: PlannedAsset['kind']) {
  const source = await mappedSource(value);
  if (source.kind === 'file' && kind === 'image') {
    try {
      if ((await fs.stat(source.location)).isDirectory()) {
        const files = await listFiles(source.location);
        if (!files.length) throw new Error('No files found in directory');
        for (const location of files) yield { kind: 'file', location } as const;
        return;
      }
    } catch (error) {
      yield { ...source, error };
      return;
    }
  }
  yield source;
}

export function createSourceSelector(folder: string) {
  let folderImages: Promise<string[]> | undefined;
  return async function* selectSources(asset: PlannedAsset) {
    const seen = new Set<string>();
    if (asset.kind === 'image' && folder) {
      try {
        const files = await (folderImages ??= listSourceImages(folder));
        for (const name of [asset.sourceFilename, asset.productCode.trim()]) {
          if (!name) continue;
          const query = name.toLowerCase();
          for (const location of files) {
            if (
              !path.basename(location).toLowerCase().includes(query) ||
              seen.has(location)
            )
              continue;
            seen.add(location);
            yield { kind: 'file', location } satisfies AssetSource;
          }
        }
      } catch (error) {
        yield { kind: 'file', location: folder, error } satisfies AssetSource;
      }
    }
    for (const value of asset.urls) {
      for await (const source of mappedSources(value, asset.kind)) {
        if (seen.has(source.location)) continue;
        seen.add(source.location);
        yield source;
      }
    }
  };
}

export async function readSource(
  source: AssetSource,
  signal: AbortSignal,
  http: HttpSettings
) {
  if ('error' in source) throw source.error;
  if (source.kind === 'http') return fetchSource(source.location, signal, http);
  return {
    buffer: await fs.readFile(source.location, { signal }),
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
