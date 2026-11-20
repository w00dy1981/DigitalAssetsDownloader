import { Jimp } from 'jimp';
import { processImage } from './ImageProcessingService';

test('a transparent PNG becomes an opaque white JPEG', async () => {
  const source = new Jimp({ width: 8, height: 8, color: 0x00000000 });
  const result = await processImage(await source.getBuffer('image/png'));
  const jpeg = await Jimp.fromBuffer(result.buffer);

  expect(result).toMatchObject({ extension: 'jpg', backgroundProcessed: true });
  expect(result.buffer.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  expect(jpeg.getPixelColor(0, 0)).toBe(0xffffffff);
});
