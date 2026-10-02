import { fail } from './model.mjs';

// Only actual Markdown link destinations are attachment references. Original
// JSON, prose mentioning attachment:, and code examples remain unchanged.
const PUNCTUATION = /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/;
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':',
  lowbar: '_', hyphen: '-', sol: '/', bsol: '\\', period: '.', percnt: '%', Tab: '\t', NewLine: '\n' };
function decode(value) {
  return value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|[A-Za-z]+);/gi, (raw, key) => {
      if (key[0] !== '#') return NAMED[key] ?? raw;
      const number = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
      return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : raw;
    });
}
function labelKey(value) { return decode(value).trim().replace(/\s+/g, ' ').toLocaleLowerCase(); }
function escaped(text, index) { let n = 0; while (index > 0 && text[--index] === '\\') n++; return n % 2 === 1; }
function attachmentId(destination) {
  const value = decode(destination);
  if (!/^attachment:/i.test(value)) return null;
  const valueId = value.slice('attachment:'.length);
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(valueId))
    fail('INVALID_ATTACHMENT_REFERENCE', '正文附件引用必须是登记的安全 ID，不能包含路径、参数或转义网址。', { destination: value.slice(0, 200) });
  return valueId;
}
function codeSpanEnd(text, start, end) {
  const boundary = /\r?\n[ \t]*(?:> ?)*\r?\n/.exec(text.slice(start, end));
  if (boundary) end = start + boundary.index;
  let count = 1; while (start + count < end && text[start + count] === '`') count++;
  for (let i = start + count; i < end;) {
    if (text[i] !== '`') { i++; continue; }
    let size = 1; while (i + size < end && text[i + size] === '`') size++;
    if (size === count) return i + size;
    i += size;
  }
  return null; // An unmatched backtick run is ordinary text.
}
function htmlTokenEnd(text, start, end) {
  if (!/^<\/?[A-Za-z][\s/>]|^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s|\/?>)/.test(text.slice(start, end))) return null;
  let quote = null;
  for (let i = start + 1; i < end; i++) {
    if (quote) { if (text[i] === quote) quote = null; }
    else if (text[i] === '"' || text[i] === "'") quote = text[i];
    else if (text[i] === '>') return i + 1;
  }
  return null;
}
function protection(text) {
  const mask = new Uint8Array(text.length); const lines = [];
  let offset = 0, fence = null, indented = false, paragraph = false, listIndent = 0, previousContainer = '';
  for (const full of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const line = full.replace(/\r?\n$/, ''); const start = offset; offset += full.length;
    const quote = /^ {0,3}(?:> ?)+/.exec(line)?.[0] ?? '';
    const quoteDepth = (quote.match(/>/g) ?? []).length;
    let contentStart = start + quote.length, content = line.slice(quote.length);
    const marker = /^( {0,3})(?:[-+*]|\d{1,9}[.)])( +)/.exec(content);
    if (marker) { listIndent = marker[0].length; content = content.slice(listIndent); contentStart += listIndent; }
    else if (listIndent && /^ +/.exec(content)?.[0].length >= listIndent) { content = content.slice(listIndent); contentStart += listIndent; }
    else if (content.trim()) listIndent = 0;
    const container = `${quoteDepth}:${listIndent}`;
    if (container !== previousContainer) paragraph = false;
    previousContainer = container;
    // A fence inside a quote/list ends when that enclosing block ends.
    if (fence && (quoteDepth < fence.quoteDepth || (fence.listIndent && content.trim() && listIndent < fence.listIndent))) fence = null;
    const beginning = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(content);
    if (fence) {
      mask.fill(1, start, offset);
      if (beginning && beginning[1][0] === fence.char && beginning[1].length >= fence.size && !beginning[2].trim()) fence = null;
      paragraph = false; continue;
    }
    if (beginning && (beginning[1][0] !== '`' || !beginning[2].includes('`'))) {
      fence = { char: beginning[1][0], size: beginning[1].length, quoteDepth, listIndent }; mask.fill(1, start, offset); paragraph = false; continue;
    }
    const codeIndented = /^(?: {4}|\t)/.test(content);
    if ((indented || !paragraph) && codeIndented) { mask.fill(1, start, offset); indented = true; paragraph = false; continue; }
    if (!content.trim()) { if (indented) mask.fill(1, start, offset); paragraph = false; continue; }
    indented = false;
    const definitionAllowed = !paragraph;
    lines.push({ start, end: start + line.length, contentStart, definitionAllowed, container });
    // Headings, thematic breaks and reference definitions do not open a prose paragraph.
    paragraph = !/^ {0,3}(?:#{1,6}(?:\s|$)|(?:[-*_] *){3,}$)/.test(content)
      && !(definitionAllowed && /^ {0,3}\[[^\]]+\]:/.test(content));
  }
  for (let i = 0; i < text.length;) {
    if (mask[i]) { i++; continue; }
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4); const stop = end < 0 ? text.length : end + 3;
      mask.fill(1, i, stop); i = stop; continue;
    }
    const raw = /^<(pre|script|style|textarea)(?:\s|>)/i.exec(text.slice(i));
    if (raw) {
      const closing = new RegExp(`</${raw[1]}\\s*>`, 'ig'); closing.lastIndex = i + raw[0].length;
      const matched = closing.exec(text); const stop = matched ? closing.lastIndex : text.length;
      mask.fill(1, i, stop); i = stop; continue;
    }
    const tagEnd = text[i] === '<' ? htmlTokenEnd(text, i, text.length) : null;
    if (tagEnd) { mask.fill(1, i, tagEnd); i = tagEnd; continue; }
    if (text[i] === '\\' && PUNCTUATION.test(text[i + 1] ?? '')) { mask[i + 1] = 1; i += 2; continue; }
    i++;
  }
  return { mask, lines };
}
function protectInlineSyntax(text, mask) {
  for (let i = 0; i < text.length;) {
    if (mask[i]) { i++; continue; }
    // Destinations and titles are opaque; their backticks are not code spans
    // that may hide unrelated text later in the document.
    if (text[i] === '(' && i && text[i - 1] === ']' && !escaped(text, i - 1)) {
      const target = inlineTarget(text, i, text.length);
      if (target) { mask.fill(1, i, target.close); i = target.close; continue; }
    }
    if (text[i] === '`' && !escaped(text, i)) {
      const stop = codeSpanEnd(text, i, text.length);
      if (stop) { mask.fill(1, i, stop); i = stop; continue; }
    }
    i++;
  }
}
function destination(text, start, end) {
  if (text[start] === '<') {
    for (let i = start + 1; i < end; i++) {
      if (text[i] === '\\' && PUNCTUATION.test(text[i + 1] ?? '')) { i++; continue; }
      if (text[i] === '\n' || text[i] === '\r' || text[i] === '<') return null;
      if (text[i] === '>') return { start: start + 1, end: i, next: i + 1 };
    }
    return null;
  }
  let depth = 0, i = start;
  for (; i < end; i++) {
    if (text[i] === '\\' && PUNCTUATION.test(text[i + 1] ?? '')) { i++; continue; }
    if (/\s/.test(text[i]) || text.charCodeAt(i) < 32) break;
    if (text[i] === '(') { if (++depth > 32) return null; }
    else if (text[i] === ')') { if (!depth) break; depth--; }
  }
  return depth ? null : { start, end: i, next: i };
}
function whitespace(text, start, end) { while (start < end && /\s/.test(text[start])) start++; return start; }
function titleEnd(text, start, end) {
  const close = { '"': '"', "'": "'", '(': ')' }[text[start]];
  if (!close) return null;
  for (let i = start + 1; i < end; i++) {
    if (text[i] === '\\' && PUNCTUATION.test(text[i + 1] ?? '')) { i++; continue; }
    if (text[i] === close) return i + 1;
    if (close === ')' && text[i] === '(') return null;
  }
  return null;
}
function inlineTarget(text, open, end) {
  const begin = whitespace(text, open + 1, end); const target = destination(text, begin, end);
  if (!target) return null;
  let next = whitespace(text, target.next, end);
  if (text[next] === ')') return { ...target, close: next + 1 };
  if (next === target.next) return null;
  const title = titleEnd(text, next, end); if (!title) return null;
  next = whitespace(text, title, end);
  return text[next] === ')' ? { ...target, close: next + 1 } : null;
}

export function analyzeAttachmentLinks(markdown) {
  if (typeof markdown !== 'string') fail('INVALID_INPUT', '附件正文必须是 Markdown 字符串。');
  const { mask, lines } = protection(markdown); const definitions = new Map();
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line.definitionAllowed || mask[line.start]) continue;
    const head = /^ {0,3}\[((?:\\.|[^\]\\]){1,999})\]:[ \t]*/.exec(markdown.slice(line.contentStart, line.end));
    if (!head) continue;
    const key = labelKey(head[1]); let targetLine = line, targetStart = line.contentStart + head[0].length;
    if (targetStart === line.end) {
      const following = lines[lineIndex + 1];
      if (!following || following.container !== line.container || mask[following.start] || !/^ {0,3}\S/.test(markdown.slice(following.contentStart, following.end))) continue;
      targetLine = following; targetStart = whitespace(markdown, following.contentStart, following.end);
    }
    const target = destination(markdown, targetStart, targetLine.end);
    if (!key || !target || target.start === target.end) continue;
    let next = whitespace(markdown, target.next, targetLine.end);
    if (next < targetLine.end) {
      if (next === target.next) continue;
      const title = titleEnd(markdown, next, targetLine.end); if (!title || whitespace(markdown, title, targetLine.end) !== targetLine.end) continue;
    }
    if (!definitions.has(key)) definitions.set(key, target);
    mask.fill(1, line.start, targetLine.end);
    if (targetLine !== line) lineIndex++;
    if (lines[lineIndex + 1]) lines[lineIndex + 1].definitionAllowed = true;
  }
  protectInlineSyntax(markdown, mask);
  const pairs = new Map(), stack = [];
  for (let i = 0; i < markdown.length; i++) {
    if (mask[i]) continue;
    if (markdown[i] === '[') stack.push(i);
    else if (markdown[i] === ']' && stack.length) pairs.set(stack.pop(), i);
  }
  const spans = new Map(), ids = new Set();
  function add(target, kind = 'destination') {
    const targetId = attachmentId(markdown.slice(target.start, target.end)); if (!targetId) return;
    ids.add(targetId); spans.set(`${target.start}:${target.end}`, { start: target.start, end: target.end, attachmentId: targetId, kind });
  }
  function scan(start, end, depth = 0) {
    if (depth > 64) fail('INVALID_EXPORT_MARKDOWN', '正文链接标签嵌套超过64层，停止导出，原文保持不变。');
    let hasLink = false;
    for (let i = start; i < end;) {
      if (mask[i]) { i++; continue; }
      if (markdown[i] === '<') {
        const close = markdown.indexOf('>', i + 1);
        if (close >= 0 && close < end && /^[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*$/.test(decode(markdown.slice(i + 1, close)))) {
          const targetId = attachmentId(markdown.slice(i + 1, close));
          if (targetId) { ids.add(targetId); spans.set(`${i}:${close + 1}`, { start: i, end: close + 1, attachmentId: targetId, kind: 'autolink' }); }
          hasLink = true; i = close + 1; continue;
        }
      }
      if (markdown[i] !== '[' || !pairs.has(i) || pairs.get(i) >= end) { i++; continue; }
      const close = pairs.get(i); const image = i > 0 && markdown[i - 1] === '!' && !escaped(markdown, i - 1);
      const child = scan(i + 1, close, depth + 1);
      let target, consumed = close + 1;
      if (markdown[close + 1] === '(') {
        target = inlineTarget(markdown, close + 1, end); if (target) consumed = target.close;
      } else if (markdown[close + 1] === '[') {
        const referenceEnd = pairs.get(close + 1);
        if (referenceEnd !== undefined && referenceEnd < end) {
          const key = labelKey(markdown.slice(close + 2, referenceEnd) || markdown.slice(i + 1, close));
          target = definitions.get(key); consumed = referenceEnd + 1;
        }
        // Explicit missing references must not degrade to shortcut references.
      } else target = definitions.get(labelKey(markdown.slice(i + 1, close)));
      if (target && (image || !child)) { add(target); if (!image) hasLink = true; }
      if (child) hasLink = true;
      i = consumed;
    }
    return hasLink;
  }
  scan(0, markdown.length);
  return { ids, spans: [...spans.values()].sort((a, b) => a.start - b.start) };
}

export function rewriteAttachmentLinks(markdown, analysis, assets, relativePrefix = '') {
  if (!['', '../'].includes(relativePrefix)) fail('UNSAFE_FILE_PATH', '导出附件只允许包内相对目录。');
  let result = markdown;
  for (const span of [...analysis.spans].sort((a, b) => b.start - a.start)) {
    const asset = assets.get(span.attachmentId);
    if (!asset) fail('EXPORT_REFERENCE_MISSING', '正文引用的附件没有登记或没有导出原件，停止导出。', { attachmentId: span.attachmentId });
    if (!/^assets\/[a-f0-9]{64}\.(?:png|jpe?g|webp|gif|mp4|webm|mp3|wav|txt|md|pdf)$/.test(asset))
      fail('UNSAFE_FILE_PATH', '导出附件资产路径不安全，不能引用本机路径。', { attachmentId: span.attachmentId });
    const relative = relativePrefix + asset;
    const replacement = span.kind === 'autolink' ? `[attachment:${span.attachmentId}](${relative})` : relative;
    result = result.slice(0, span.start) + replacement + result.slice(span.end);
  }
  return result;
}
