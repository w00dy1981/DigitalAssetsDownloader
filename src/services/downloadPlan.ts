import * as path from 'path';
import type { DownloadConfig } from '../shared/types';
import { safeJoin, sanitizePath } from './pathSecurity';

interface Destination {
  filePath: string;
  networkPath: string;
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
  filename: string
): Destination {
  const reference = referenceFolder?.trim();
  let networkPath = '';
  if (reference) {
    if (path.win32.isAbsolute(reference) && !path.posix.isAbsolute(reference)) {
      sanitizePath(reference);
      networkPath = path.win32.join(reference, filename);
    } else {
      networkPath = safeJoin(reference, filename);
    }
  }
  return { filePath: safeJoin(folder, filename), networkPath };
}

export type DownloadPlanConfig = Pick<
  DownloadConfig,
  | 'partNoColumn'
  | 'imageColumns'
  | 'pdfColumn'
  | 'filenameColumn'
  | 'imageFolder'
  | 'pdfFolder'
  | 'imageFilePath'
>;

export function planDownloads(
  config: DownloadPlanConfig,
  data: readonly Record<string, unknown>[]
): PlannedRow[] {
  const claimed = new Set<string>();
  const nextSuffix = new Map<string, number>();
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
    const sanitised = productCode
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/gi, '');
    const base = /^(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i.test(sanitised)
      ? `_${sanitised}`
      : sanitised || 'asset';
    const key = base.toLowerCase();
    let stem = base;
    let suffix = nextSuffix.get(key) ?? 2;
    while (claimed.has(stem.toLowerCase())) {
      stem = `${base}_${suffix++}`;
    }
    claimed.add(stem.toLowerCase());
    nextSuffix.set(key, suffix);

    const assets: PlannedAsset[] = [];
    if (urls.length > 0) {
      const filename = config.filenameColumn && row[config.filenameColumn];
      assets.push({
        kind: 'image',
        urls,
        productCode,
        sourceFilename: filename ? String(filename) : undefined,
        ...destination(config.imageFolder, config.imageFilePath, `${stem}.jpg`),
      });
    }
    if (pdfUrl) {
      assets.push({
        kind: 'pdf',
        urls: [String(pdfUrl)],
        ...destination(config.pdfFolder, '', `${stem}.pdf`),
      });
    }
    rows.push({ rowNumber: index + 1, productCode, assets });
  }

  return rows;
}
