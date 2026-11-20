import * as path from 'node:path';
import { joinFilename } from './pathSecurity';

it('resolves the selected folder and preserves valid double dots', () => {
  expect(joinFilename('Acme..2026', 'photo..jpg')).toBe(
    path.resolve('Acme..2026', 'photo..jpg')
  );
});

it.each([
  '',
  '.',
  '..',
  '../elsewhere',
  'subdir/file',
  path.resolve('elsewhere'),
])('keeps generated filenames inside the selected folder (%s)', filename => {
  expect(() => joinFilename('output', filename)).toThrow();
});

it('requires an output folder', () => {
  expect(() => joinFilename('', 'item')).toThrow();
});
