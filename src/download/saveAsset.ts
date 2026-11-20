import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { setTimeout } from 'timers/promises';
import axios from 'axios';
import type { Readable } from 'node:stream';
import type { PlannedAsset } from './downloadPlan';
import { processImage, type ImageOptions } from './processImage';
import { joinFilename, sanitizePath } from '../files/pathSecurity';

interface SourceDetails {
  url: string;
  httpStatus: number;
  contentType: string;
}

export type AssetResult = SourceDetails &
  (
    | {
        success: true;
        filePath: string;
        networkPath: string;
        fileSize: number;
        backgroundProcessed: boolean;
      }
    | { success: false; error: string }
  );

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

export async function listSourceImages(folder: string): Promise<SourceImage[]> {
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
  url: string,
  kind: PlannedAsset['kind'],
  signal: AbortSignal
): Promise<Buffer> {
  const file = sanitizePath(url);
  if (kind === 'image' && (await fs.stat(file)).isDirectory()) {
    const [candidate] = await listImageNames(file);
    if (!candidate) throw new Error('No image files found in directory');
    return fs.readFile(joinFilename(file, candidate), { signal });
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
        timeout: settings.connectionTimeout * 1000,
        responseType: 'stream',
        signal,
      });
      // Axios' Node timeout covers the wait for headers. Bound the time between body chunks separately.
      response.request.setTimeout(0);
      const timeout = globalThis.setTimeout(
        () => response.data.destroy(new Error('Read timeout')),
        settings.readTimeout * 1000
      );
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of response.data) {
          timeout.refresh();
          chunks.push(chunk);
        }
        return {
          status: response.status,
          headers: response.headers,
          data: Buffer.concat(chunks),
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      if (axios.isAxiosError<Readable>(error)) error.response?.data.destroy();
      if (
        attempt >= settings.retryAttempts ||
        signal.aborted ||
        (axios.isAxiosError(error) && error.response?.status === 404)
      )
        throw error;
      await setTimeout(Math.min(1000 * attempt, 5000), undefined, { signal });
    }
  }
}

function describeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 404) return 'File not found (404)';
    if (error.code === 'ECONNABORTED') return 'Timeout error';
  }
  return error instanceof Error ? error.message : String(error);
}

export async function saveAsset(
  asset: PlannedAsset,
  options: {
    sourceImages: readonly SourceImage[];
    http: HttpSettings;
    signal: AbortSignal;
    processing: ImageOptions;
  }
): Promise<AssetResult | undefined> {
  const { signal } = options;
  const local =
    asset.kind === 'image' && findSourceImage(asset, options.sourceImages);
  const sources = local ? [local, ...asset.urls] : asset.urls;

  let failure: AssetResult | undefined;
  for (const url of sources) {
    if (signal.aborted) return undefined;

    const details: SourceDetails = { url, httpStatus: 0, contentType: '' };
    try {
      let buffer: Buffer;
      if (/^https?:\/\//i.test(url)) {
        const response = await fetchSource(url, signal, options.http);
        details.httpStatus = response.status;
        details.contentType = String(response.headers['content-type'] ?? '');
        buffer = response.data;
      } else {
        buffer = await readLocalSource(url, asset.kind, signal);
        details.httpStatus = 200;
        details.contentType = 'local_file_processed';
      }

      signal.throwIfAborted();
      let extension: 'jpg' | 'webp' | 'pdf' = 'pdf';
      let backgroundProcessed = false;
      if (asset.kind === 'image') {
        const image = await processImage(buffer, options.processing);
        buffer = image.buffer;
        backgroundProcessed = image.backgroundProcessed;
        extension = image.extension;
      } else if (!buffer.subarray(0, 1024).includes('%PDF-')) {
        throw new Error('Source does not contain a PDF');
      }

      const filePath = `${asset.fileStem}.${extension}`;
      const networkPath = asset.networkStem
        ? `${asset.networkStem}.${extension}`
        : '';
      const folder = path.dirname(filePath);
      await fs.mkdir(folder, { recursive: true });
      const temporaryFile = path.join(folder, `.${randomUUID()}.tmp`);
      try {
        await fs.writeFile(temporaryFile, buffer, { flag: 'wx', signal });
        signal.throwIfAborted();
        await fs.rename(temporaryFile, filePath);
      } finally {
        await fs.rm(temporaryFile, { force: true });
      }

      return {
        ...details,
        success: true,
        filePath,
        networkPath,
        fileSize: buffer.length,
        backgroundProcessed,
      };
    } catch (error) {
      if (signal.aborted) return undefined;
      failure ??= {
        ...details,
        httpStatus: axios.isAxiosError(error)
          ? (error.response?.status ?? 0)
          : details.httpStatus,
        success: false,
        error: describeError(error),
      };
    }
  }
  return failure;
}
