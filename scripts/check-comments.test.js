const { findProseComments } = require('./check-comments');

/** @param {string} file @param {string} text */
const found = (file, text) =>
  findProseComments(file, text).map(comment => comment.text);

describe('prose comments', () => {
  test('finds line, block and JSX comments in TypeScript', () => {
    const code = [
      '// explains the next line',
      'const a = 1; /* trailing */',
      '/** A doc block. */',
      'export const view = <div>{/* in JSX */}</div>;',
    ].join('\n');
    expect(found('view.tsx', code)).toEqual([
      '// explains the next line',
      '/* trailing */',
      '/** A doc block. */',
      '/* in JSX */',
    ]);
  });

  test('reads every TypeScript, JavaScript and JSON file type', () => {
    for (const file of ['x.mts', 'x.cts', 'x.js', 'x.cjs', 'x.jsx']) {
      expect(found(file, '// prose\nconst x = 1;')).toEqual(['// prose']);
    }
    expect(found('x.jsonc', '{ // prose\n "a": 1 }')).toEqual(['// prose']);
    expect(found('tsconfig.json', '{\n  // real\n  "a": "// not"\n}')).toEqual([
      '// real',
    ]);
  });

  test('ignores comment-like text in strings, templates, regexes and JSX text', () => {
    const code = [
      "const url = 'https://example.com/* not */';",
      'const sql = `-- not ${url} // not`;',
      'const pattern = /\\/\\/ not/;',
      'export const view = <a href="//x">// not a comment</a>;',
    ].join('\n');
    expect(found('view.tsx', code)).toEqual([]);
  });

  test('allows tool directives and legal notices', () => {
    const code = [
      '#!/usr/bin/env node',
      '/* Copyright (c) 2026 Example. Permission is hereby granted. */',
      "// @ts-expect-error The library's types omit this option.",
      '// eslint-disable-next-line no-console -- the CLI prints its result',
      '/// <reference types="vite/client" />',
      'const pure = /*#__PURE__*/ make();',
      '//# sourceMappingURL=x.js.map',
      '/*! @license MIT */',
      '// eslint-disable-next-line no-console, no-alert -- staff see it',
      '/* webpackChunkName: "report" */',
    ].join('\n');
    expect(found('script.ts', code)).toEqual([]);
  });

  test('refuses prose dressed as a directive or notice', () => {
    for (const comment of [
      '// eslint-disable because this is prose.',
      '// @ts-check this is why',
      '/* @generated\nOrdinary prose.\n*/',
      '/*! Ordinary prose. */',
      '// Copyright is why we do this',
      '// @license this is why we do this',
      '// eslint-disable this is why we do this',
      '/* webpackChunkName: this is why we do this */',
    ]) {
      expect(found('x.ts', `${comment}\nconst x = 1;`)).toHaveLength(1);
    }
    expect(found('ci.yml', '# eslint-disable-next-line\na: 1')).toHaveLength(1);
  });

  test('allows JSDoc type annotations in JavaScript only when they carry no prose', () => {
    const typed = [
      '/** @param {string} path @returns {string[]} */',
      '/** @type {Record<string, { a: number }>} */',
      "/** @import { Node } from 'typescript' */",
      '/** @type {{\n * name: string,\n * value: number\n * }} */',
      "/**\n * @import { A } from './a.mjs'\n * @import { B } from './b.mjs'\n * @typedef {{\n *   a: A,\n * }} C\n */",
    ];
    for (const comment of typed)
      expect(found('x.mjs', `${comment}\nconst x = 1;`)).toEqual([]);
    for (const comment of [
      '/** @param {string} path The folder to read. */',
      '/** @template T This is prose */',
      '/** @import {Foo} from "foo" this is prose */',
      '/** @typedef {Object} Foo\n * @property {string} bar This is prose\n */',
      '/** @callback Foo\n * @param {string} x This is prose\n */',
      '/** @overload\n * @param {string} x This is prose\n * @returns {string}\n */',
    ]) {
      expect(found('x.mjs', `${comment}\nconst x = 1;`)).toHaveLength(1);
    }
    expect(found('x.ts', '/** @type {string} */\nconst x = "";')).toHaveLength(
      1
    );
  });

  test('reads CSS escapes, strings and URLs', () => {
    expect(found('app.css', ".a { content: '/* not */'; } /* real */")).toEqual(
      ['/* real */']
    );
    expect(found('app.css', ".a { --foo: a\\'b; } /* prose */")).toEqual([
      '/* prose */',
    ]);
    expect(
      found('app.css', '.a { background: url(https://x.test/a/*i*/b.png); }')
    ).toEqual([]);
  });

  test('reads YAML block scalars and reports the right lines', () => {
    const yaml = [
      '# real',
      'run: |',
      '  # part of the script',
      "name: 'a # not'",
    ].join('\n');
    expect(found('ci.yml', yaml)).toEqual(['# real']);
    expect(findProseComments('x.yaml', 'a: 1\n# a\nx: 1\n# b\ny: 2\n')).toEqual(
      [
        { line: 2, text: '# a' },
        { line: 4, text: '# b' },
      ]
    );
  });
});
