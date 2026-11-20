import * as path from 'path';
import { createHash } from 'node:crypto';
import { joinFilename, sanitizePath } from '../files/pathSecurity';

interface Destination {
  fileStem: string;
  networkStem: string;
}

export type PlannedAsset = Destination &
  (
    | {
        kind: 'image';
        urls: string[];
        productCode: string;
        sourceFilename?: string;
      }
    | { kind: 'pdf'; urls: [string] }
  );

export interface PlannedRow {
  rowNumber: number;
  productCode: string;
  assets: PlannedAsset[];
}

function destination(
  folder: string,
  referenceFolder: string,
  stem: string
): Destination {
  const reference = referenceFolder?.trim();
  const fileStem = joinFilename(folder, stem);
  if (!reference) return { fileStem, networkStem: '' };
  if (path.win32.isAbsolute(reference) && !path.posix.isAbsolute(reference)) {
    sanitizePath(reference);
    return { fileStem, networkStem: path.win32.join(reference, stem) };
  }
  return { fileStem, networkStem: joinFilename(reference, stem) };
}

export interface DownloadPlanConfig {
  partNoColumn: string;
  imageColumns: readonly string[];
  pdfColumn: string;
  filenameColumn: string;
  imageFolder: string;
  pdfFolder: string;
  imageFilePath: string;
}

export function planDownloads(
  config: DownloadPlanConfig,
  data: readonly Record<string, unknown>[]
): PlannedRow[] {
  const occurrences = new Map<string, number>();
  const rows: PlannedRow[] = [];

  for (const [index, row] of data.entries()) {
    const rawCode = row[config.partNoColumn];
    if (rawCode == null || String(rawCode).trim() === '') continue;

    const urls = config.imageColumns
      .map(column => row[column])
      .filter(Boolean)
      .map(String);
    const pdfUrl = config.pdfColumn && row[config.pdfColumn];
    if (urls.length === 0 && !pdfUrl) continue;

    const productCode = String(rawCode);
    // ABM references survive later runs containing a different subset of products.
    const readable = productCode.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 120);
    const plain =
      readable === productCode &&
      readable === readable.toUpperCase() &&
      !/^(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/.test(readable);
    const base = plain
      ? readable
      : `${readable}~${createHash('sha256').update(productCode).digest('hex').slice(0, 24)}`;
    const occurrence = (occurrences.get(productCode) ?? 0) + 1;
    occurrences.set(productCode, occurrence);
    const stem = occurrence === 1 ? base : `${base}~${occurrence}`;

    const assets: PlannedAsset[] = [];
    if (urls.length > 0) {
      const filename = config.filenameColumn && row[config.filenameColumn];
      assets.push({
        kind: 'image',
        urls,
        productCode,
        sourceFilename: filename ? String(filename) : undefined,
        ...destination(config.imageFolder, config.imageFilePath, stem),
      });
    }
    if (pdfUrl) {
      assets.push({
        kind: 'pdf',
        urls: [String(pdfUrl)],
        ...destination(config.pdfFolder, '', stem),
      });
    }
    rows.push({ rowNumber: index + 1, productCode, assets });
  }

  return rows;
}
