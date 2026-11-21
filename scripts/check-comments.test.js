const { findProseComments } = require('./check-comments');

/** @param {string} file @param {string} text */
const found = (file, text) =>
  findProseComments(file, text).map(comment => comment.text);

describe('prose comments', () => {
  test('finds line and block comments', () => {
    const code = [
      '// explains the next line',
      'const a = 1; /* trailing */',
      '/** A doc block. */',
      'export const b = a;',
    ].join('\n');
    expect(found('query.ts', code)).toEqual([
      '// explains the next line',
      '/* trailing */',
      '/** A doc block. */',
    ]);
  });

  test('ignores comment-like text in strings, templates and regexes', () => {
    const code = [
      "const url = 'https://example.com/* not */';",
      'const sql = `-- not ${url} // not`;',
      'const pattern = /\\/\\/ not/;',
    ].join('\n');
    expect(found('query.ts', code)).toEqual([]);
  });

  test('allows tool directives, legal notices and JSDoc types without prose', () => {
    const code = [
      '#!/usr/bin/env node',
      '/*! Licence notice */',
      "// @ts-expect-error The library's types omit this option.",
      '// eslint-disable-next-line no-console',
      '/** @param {string} path @returns {string[]} */',
      '/** @type {Record<string, { a: number }>} */',
      'const pure = /*#__PURE__*/ make();',
    ].join('\n');
    expect(found('script.mjs', code)).toEqual([]);
  });

  test('refuses JSDoc type tags that carry prose', () => {
    expect(
      found('script.mjs', '/** @param {string} path The folder to read. */')
    ).toHaveLength(1);
  });

  test('reads CSS strings', () => {
    expect(found('app.css', ".a { content: '/* not */'; } /* real */")).toEqual(
      ['/* real */']
    );
  });

  test('reads YAML block scalars', () => {
    const yaml = [
      '# real',
      'run: |',
      '  # part of the script',
      "name: 'a # not'",
    ].join('\n');
    expect(found('ci.yml', yaml)).toEqual(['# real']);
  });

  test('reads comments in JSON configuration', () => {
    expect(found('tsconfig.json', '{\n  // real\n  "a": "// not"\n}')).toEqual([
      '// real',
    ]);
  });
});
