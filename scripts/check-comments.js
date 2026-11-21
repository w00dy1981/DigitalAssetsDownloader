const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync, statSync } = require('node:fs');
const ts = require('typescript');
const { Lexer } = require('yaml');

const DIRECTIVE =
  /^(biome-ignore|@ts-(expect-error|ignore|nocheck|check)\b|eslint-(disable|enable)|@vitest-environment|@jest-environment|(istanbul|c8|v8) ignore|@jsxImportSource|@jsx\b|[#@]__PURE__|webpack[A-Z]|@generated|@license|@preserve|<reference |yaml-language-server:)/;
const JSDOC_TYPE_TAG =
  /^@(import\s.+|(type|satisfies|returns?|this|enum)\s+\{.+\}|typedef\s+\{.+\}\s+[\w$]+|template\s+.+|(param|property|prop)\s+\{.+\}\s+\[?[\w$.]+(=[^\]]*)?\]?)$/;

const SCRIPT_KINDS = {
  ts: ts.ScriptKind.TS,
  tsx: ts.ScriptKind.TSX,
  js: ts.ScriptKind.JS,
  jsx: ts.ScriptKind.JSX,
  mjs: ts.ScriptKind.JS,
  cjs: ts.ScriptKind.JS,
  json: ts.ScriptKind.JSON,
};

/** @param {string} raw */
function isAllowed(raw) {
  if (raw.startsWith('/*!')) return true;
  const body = raw.startsWith('/*')
    ? raw
        .slice(2, -2)
        .replace(/^\*+/, '')
        .replace(/^[ \t]*\*[ \t]?/gm, '')
    : raw.replace(/^(\/\/+|#)/, '');
  const lines = body
    .split(/\n|\s(?=@)/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  if (DIRECTIVE.test(lines[0])) return true;
  return lines.every(line => JSDOC_TYPE_TAG.test(line));
}

/**
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @param {{ start: number, text: string }[]} found
 */
function triviaComments(text, start, end, found) {
  let index = start;
  while (index < end) {
    if (text.startsWith('//', index)) {
      const close = text.indexOf('\n', index);
      const stop = close === -1 || close > end ? end : close;
      found.push({ start: index, text: text.slice(index, stop) });
      index = stop;
    } else if (text.startsWith('/*', index)) {
      const close = text.indexOf('*/', index + 2);
      const stop = close === -1 ? end : close + 2;
      found.push({ start: index, text: text.slice(index, stop) });
      index = stop;
    } else if (index === 0 && text.startsWith('#!')) {
      index = text.indexOf('\n');
      if (index === -1) index = end;
    } else index += 1;
  }
}

/**
 * @param {string} file
 * @param {string} text
 * @param {ts.ScriptKind} kind
 */
function scriptComments(file, text, kind) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    kind
  );
  /** @type {{ start: number, text: string }[]} */
  const found = [];
  /** @param {ts.Node} node */
  const visit = node => {
    const children = node
      .getChildren(source)
      .filter(
        child =>
          child.kind < ts.SyntaxKind.FirstJSDocNode ||
          child.kind > ts.SyntaxKind.LastJSDocNode
      );
    if (children.length > 0) {
      for (const child of children) visit(child);
      return;
    }
    if (node.kind !== ts.SyntaxKind.JsxText)
      triviaComments(text, node.pos, node.getStart(source), found);
  };
  visit(source);
  return found;
}

/** @param {string} text */
function cssComments(text) {
  /** @type {{ start: number, text: string }[]} */
  const found = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === "'" || char === '"') {
      index += 1;
      while (index < text.length && text[index] !== char)
        index += text[index] === '\\' ? 2 : 1;
      index += 1;
    } else if (text.startsWith('/*', index)) {
      const close = text.indexOf('*/', index + 2);
      const stop = close === -1 ? text.length : close + 2;
      found.push({ start: index, text: text.slice(index, stop) });
      index = stop;
    } else index += 1;
  }
  return found;
}

/** @param {string} text */
function yamlComments(text) {
  /** @type {{ start: number, text: string }[]} */
  const found = [];
  let offset = 0;
  for (const token of new Lexer().lex(text)) {
    if (token.startsWith('#')) found.push({ start: offset, text: token });
    offset += token.length;
  }
  return found;
}

/**
 * @param {string} file
 * @param {string} text
 */
function findProseComments(file, text) {
  const extension = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
  const kind =
    SCRIPT_KINDS[/** @type {keyof typeof SCRIPT_KINDS} */ (extension)];
  const comments =
    kind !== undefined
      ? scriptComments(file, text, kind)
      : extension === 'css'
        ? cssComments(text)
        : extension === 'yml' || extension === 'yaml'
          ? yamlComments(text)
          : [];
  return comments
    .filter(comment => !isAllowed(comment.text))
    .map(comment => ({
      line: text.slice(0, comment.start).split('\n').length,
      text: comment.text.split('\n')[0].slice(0, 100),
    }));
}

/** @param {string[]} args */
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

function changedFiles() {
  const base =
    process.env.COMMENT_CHECK_BASE ??
    git(['merge-base', 'origin/main', 'HEAD'])[0];
  const files = [
    ...git(['diff', '--name-only', '--diff-filter=ACMR', base]),
    ...git(['ls-files', '--others', '--exclude-standard']),
  ];
  return [...new Set(files)].filter(
    file => existsSync(file) && statSync(file).isFile()
  );
}

module.exports = { findProseComments };

if (require.main === module) {
  const failures = changedFiles().flatMap(file =>
    findProseComments(file, readFileSync(file, 'utf8')).map(
      comment => `${file}:${comment.line}: ${comment.text}`
    )
  );
  if (failures.length > 0) {
    console.error(
      `[ERROR] Prose comments in changed files. Remove them, and fix any code they were covering for (standards/source-comments.md):\n${failures.join('\n')}`
    );
    process.exit(1);
  }
  console.log('[OK] No prose comments in changed files.');
}
