import { Jimp } from 'jimp';
import { CONSTANTS } from '../shared/constants';

export interface ProcessedImage {
  buffer: Buffer;
  extension: 'jpg' | 'webp';
  backgroundProcessed: boolean;
}

export async function processImage(
  buffer: Buffer,
  quality = CONSTANTS.IMAGE.DEFAULT_QUALITY
): Promise<ProcessedImage> {
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    // Jimp cannot decode WebP. Keep the original bytes and extension.
    return { buffer, extension: 'webp', backgroundProcessed: false };
  }

  const image = await Jimp.fromBuffer(buffer);
  const backgroundProcessed = image.hasAlpha();
  const output = backgroundProcessed
    ? new Jimp({
        width: image.width,
        height: image.height,
        color: 0xffffffff,
      }).composite(image, 0, 0)
    : image;

  return {
    buffer: await output.getBuffer('image/jpeg', { quality }),
    extension: 'jpg',
    backgroundProcessed,
  };
}
