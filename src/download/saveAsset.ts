import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { PlannedAsset } from './downloadPlan';
import {
  readSource,
  sourceFailure,
  type AssetSource,
  type HttpSettings,
  type SourceDetails,
} from './assetSource';
import { processImage, type ImageOptions } from './processImage';

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

function preparePdf(buffer: Buffer) {
  if (!buffer.subarray(0, 1024).includes('%PDF-'))
    throw new Error('Source does not contain a PDF');
  return { buffer, extension: 'pdf' as const, backgroundProcessed: false };
}

async function writeAsset(
  filePath: string,
  buffer: Buffer,
  signal: AbortSignal
) {
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
}

export async function saveAsset(
  asset: PlannedAsset,
  sources: AsyncIterable<AssetSource>,
  options: {
    http: HttpSettings;
    signal: AbortSignal;
    processing: ImageOptions;
  }
): Promise<AssetResult | undefined> {
  const { signal } = options;
  let failure: AssetResult | undefined;
  for await (const source of sources) {
    if (signal.aborted) return undefined;
    let details: SourceDetails = {
      url: source.location,
      httpStatus: 0,
      contentType: '',
    };
    try {
      const { buffer, httpStatus, contentType } = await readSource(
        source,
        asset.kind,
        signal,
        options.http
      );
      details = { url: source.location, httpStatus, contentType };
      signal.throwIfAborted();
      const prepared =
        asset.kind === 'image'
          ? await processImage(buffer, options.processing)
          : preparePdf(buffer);
      const filePath = `${asset.fileStem}.${prepared.extension}`;
      await writeAsset(filePath, prepared.buffer, signal);
      return {
        ...details,
        success: true,
        filePath,
        networkPath:
          asset.kind === 'image' && asset.networkStem
            ? `${asset.networkStem}.${prepared.extension}`
            : '',
        fileSize: prepared.buffer.length,
        backgroundProcessed: prepared.backgroundProcessed,
      };
    } catch (error) {
      if (signal.aborted) return undefined;
      failure ??= sourceFailure(details, error);
    }
  }
  return failure;
}
