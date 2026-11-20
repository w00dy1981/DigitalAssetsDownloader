import * as path from 'path';
import { EventEmitter } from 'events';
import type {
  DownloadCompletionEvent,
  DownloadProgress,
} from '../shared/types';
import {
  planDownloads,
  type DownloadPlanConfig,
  type PlannedAsset,
} from './downloadPlan';
import { writeDownloadWorkbook } from './downloadWorkbook';
import {
  listSourceImages,
  saveAsset,
  type AssetResult,
  type HttpSettings,
} from './saveAsset';
import type { ImageOptions } from './ImageProcessingService';
import { joinFilename } from './pathSecurity';

export interface DownloadOptions extends DownloadPlanConfig {
  sourceImageFolder: string;
  maxWorkers: number;
  backgroundProcessing: ImageOptions;
}

export class DownloadService extends EventEmitter<{
  progress: [DownloadProgress];
  complete: [DownloadCompletionEvent];
}> {
  private activeRun?: AbortController;

  async startDownloads(
    config: DownloadOptions,
    data: readonly Record<string, unknown>[],
    http: HttpSettings
  ): Promise<void> {
    if (this.activeRun) throw new Error('Downloads already in progress');
    if (!Number.isInteger(config.maxWorkers) || config.maxWorkers < 1) {
      throw new Error('Maximum workers must be a positive integer');
    }

    if (
      ![http.connectionTimeout, http.readTimeout, http.retryAttempts].every(
        value => Number.isInteger(value) && value > 0
      ) ||
      http.retryAttempts > 10
    ) {
      throw new Error('Invalid HTTP timeout or retry settings');
    }
    const run = new AbortController();
    this.activeRun = run;
    let completion: DownloadCompletionEvent;
    try {
      const startTime = Date.now();
      const rows = planDownloads(config, data);
      const assets = rows.flatMap(row => row.assets);
      const results = new Map<PlannedAsset, AssetResult>();
      const total = assets.length;
      let successful = 0;
      let failed = 0;
      let backgroundProcessed = 0;
      let currentFile = '';
      const publishProgress = () => {
        const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        const done = successful + failed;
        const progress: DownloadProgress = {
          currentFile,
          successful,
          failed,
          total,
          backgroundProcessed,
          percentage: total ? (done / total) * 100 : 0,
          elapsedTime,
          estimatedTimeRemaining: done
            ? Math.floor((elapsedTime * (total - done)) / done)
            : 0,
        };
        this.emit('progress', progress);
      };

      publishProgress();
      const options = {
        processing: config.backgroundProcessing,
        http,
        signal: run.signal,
      };

      let next = 0;
      let sourceImages: ReturnType<typeof listSourceImages> | undefined;
      const worker = async () => {
        while (!run.signal.aborted && next < assets.length) {
          const asset = assets[next++];
          currentFile = `${path.basename(asset.fileStem)}.${asset.kind === 'image' ? 'jpg' : 'pdf'}`;
          publishProgress();

          const result = await saveAsset(asset, {
            ...options,
            sourceImages:
              asset.kind === 'image' && config.sourceImageFolder
                ? await (sourceImages ??= listSourceImages(
                    config.sourceImageFolder
                  ))
                : [],
          });
          if (!result) continue;
          results.set(asset, result);
          if (result.success) {
            successful++;
            if (result.backgroundProcessed) backgroundProcessed++;
          } else {
            failed++;
          }
          publishProgress();
        }
      };

      const workers = Array.from(
        { length: Math.min(config.maxWorkers, total) },
        worker
      );
      for (const outcome of await Promise.allSettled(workers)) {
        if (outcome.status === 'rejected') throw outcome.reason;
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 23);
      const logFile = joinFilename(
        config.imageFolder || config.pdfFolder,
        `DownloadLog_${timestamp}.xlsx`
      );
      await writeDownloadWorkbook(logFile, rows, results);
      completion = {
        successful,
        failed,
        total,
        backgroundProcessed,
        logFile,
        cancelled: run.signal.aborted,
      };
    } finally {
      this.activeRun = undefined;
    }

    this.emit('complete', completion);
  }

  cancelDownloads(): void {
    this.activeRun?.abort();
  }
}
