const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync, statSync } = require('node:fs');
const postcss = require('postcss');
const ts = require('typescript');
const { Lexer } = require('yaml');

/** @typedef {{ start: number, text: string }} Comment */
/** @typedef {"script" | "javascript" | "css" | "yaml"} Language */

const SCRIPT_KINDS = {
  ts: ts.ScriptKind.TS,
  mts: ts.ScriptKind.TS,
  cts: ts.ScriptKind.TS,
  tsx: ts.ScriptKind.TSX,
  js: ts.ScriptKind.JS,
  mjs: ts.ScriptKind.JS,
  cjs: ts.ScriptKind.JS,
  jsx: ts.ScriptKind.JSX,
  json: ts.ScriptKind.JSON,
  jsonc: ts.ScriptKind.JSON,
};
const JAVASCRIPT = new Set(['js', 'mjs', 'cjs', 'jsx']);

const WEBPACK_OPTION = `webpack(ChunkName|Mode|Prefetch|Preload|Include|Exclude|Exports|Ignore|FetchPriority): ("[^"]*"|'[^']*'|true|false|\\d+|/[^/]+/[a-z]*)`;
const SCRIPT_DIRECTIVES = [
  /^@ts-(expect-error|ignore)( \S.*)?$/,
  /^@ts-(check|nocheck)$/,
  /^eslint-(disable|enable)(-next-line|-line)?( [\w@/-]+(, ?[\w@/-]+)*)?( -- \S.*)?$/,
  /^@jest-environment [\w-]+$/,
  /^istanbul ignore (next|else|if|start|stop|file)$/,
  /^@jsx(ImportSource|Runtime|Frag)? [\w./@-]+$/,
  /^[#@]__(PURE|NO_SIDE_EFFECTS)__$/,
  new RegExp(`^${WEBPACK_OPTION}(, ${WEBPACK_OPTION})*$`),
  /^[#@] source(Mapping)?URL=\S+$/,
  /^<reference (path|types|lib)="[^"]+" \/>$/,
  /^@generated$/,
];
const DIRECTIVES = /** @type {Record<Language, RegExp[]>} */ ({
  script: SCRIPT_DIRECTIVES,
  javascript: SCRIPT_DIRECTIVES,
  css: [],
  yaml: [/^yaml-language-server: \$schema=\S+$/],
});
const LEGAL_NOTICE =
  /^(Copyright (\(c\) |© )?\d{4}\b.*|SPDX-License-Identifier: [\w.+-]+( (AND|OR|WITH) [\w.+-]+)*|@license [\w.+-]+)$/;
const TYPE_TAGS = new Set([
  'import',
  'type',
  'typedef',
  'param',
  'returns',
  'return',
  'template',
  'satisfies',
  'this',
  'enum',
  'property',
  'prop',
  'callback',
  'overload',
]);

/** @param {string} raw */
function commentBody(raw) {
  if (raw.startsWith('//')) return raw.replace(/^\/\/\/?/, '').trim();
  if (raw.startsWith('/*')) {
    return raw
      .slice(2, -2)
      .replace(/^[*!]+/, '')
      .split('\n')
      .map(line => line.replace(/^\s*\*?\s?/, ''))
      .join('\n')
      .trim();
  }
  return raw.replace(/^#/, '').trim();
}

/** @param {string} raw */
function isTypeAnnotation(raw) {
  if (!raw.startsWith('/**')) return false;
  const source = ts.createSourceFile(
    'type.js',
    `${raw}\nvar typed;`,
    ts.ScriptTarget.Latest,
    true
  );
  const docs = /** @type {{ jsDoc?: ts.JSDoc[] }} */ (
    /** @type {unknown} */ (source.statements[0])
  ).jsDoc;
  /** @param {ts.JSDoc["comment"]} comment */
  const hasProse = comment =>
    /[^\s*]/.test(ts.getTextOfJSDocComment(comment) ?? '');
  if (docs?.length !== 1 || hasProse(docs[0].comment) || !docs[0].tags?.length)
    return false;
  let typesOnly = true;
  /** @param {ts.Node} node */
  const visit = node => {
    if (
      node.kind >= ts.SyntaxKind.FirstJSDocTagNode &&
      node.kind <= ts.SyntaxKind.LastJSDocTagNode
    ) {
      const tag = /** @type {ts.JSDocTag} */ (node);
      typesOnly &&= TYPE_TAGS.has(tag.tagName.text) && !hasProse(tag.comment);
    }
    if (node.kind === ts.SyntaxKind.JSDocTypeExpression) {
      const type = source.text
        .slice(node.pos, node.end)
        .replace(/^[ \t]*\*/gm, '');
      typesOnly &&=
        scriptComments(
          'type.ts',
          `type Checked = ${type.slice(1, -1)};`,
          ts.ScriptKind.TS
        ).length === 0;
    }
    ts.forEachChild(node, visit);
  };
  visit(docs[0]);
  return typesOnly;
}

/**
 * @param {string} raw
 * @param {Language} language
 */
function isAllowed(raw, language) {
  const body = commentBody(raw);
  if (LEGAL_NOTICE.test(body.split('\n')[0])) return true;
  if (
    !body.includes('\n') &&
    DIRECTIVES[language].some(pattern => pattern.test(body))
  )
    return true;
  return language === 'javascript' && isTypeAnnotation(raw);
}

/**
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @param {Comment[]} found
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
  /** @type {Comment[]} */
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
  /** @type {Comment[]} */
  const found = [];
  postcss.parse(text).walkComments(comment => {
    const start = comment.source?.start?.offset ?? 0;
    const end = comment.source?.end?.offset ?? start;
    found.push({ start, text: text.slice(start, end + 1) });
  });
  return found;
}

const YAML_CONTROL_TOKENS = new Set(['\x02', '\x18', '\x1f']);

/** @param {string} text */
function yamlComments(text) {
  /** @type {Comment[]} */
  const found = [];
  let offset = 0;
  for (const token of new Lexer().lex(text)) {
    if (YAML_CONTROL_TOKENS.has(token)) continue;
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
  /** @type {[Language, Comment[]] | null} */
  const read =
    kind !== undefined
      ? [
          JAVASCRIPT.has(extension) ? 'javascript' : 'script',
          scriptComments(file, text, kind),
        ]
      : extension === 'css'
        ? ['css', cssComments(text)]
        : extension === 'yml' || extension === 'yaml'
          ? ['yaml', yamlComments(text)]
          : null;
  if (!read) return [];
  const [language, comments] = read;
  return comments
    .filter(comment => !isAllowed(comment.text, language))
    .map(comment => ({
      line: text.slice(0, comment.start).split('\n').length,
      text: comment.text.split('\n')[0].slice(0, 100),
    }));
}

/** @param {string[]} args */
function gitPaths(args) {
  return execFileSync('git', [...args, '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function changedFiles() {
  const base =
    process.env.COMMENT_CHECK_BASE ??
    execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  const files = [
    ...gitPaths(['diff', '--name-only', '--diff-filter=ACMR', base]),
    ...gitPaths(['ls-files', '--others', '--exclude-standard']),
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
