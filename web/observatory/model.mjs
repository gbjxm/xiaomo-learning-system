import { createHash, randomUUID } from 'node:crypto';

export const SCHEMA_VERSION = 2;
export const MATERIAL_STATUSES = ['active', 'archived', 'deleted'];
export const TOPIC_STATUSES = ['draft', 'researching', 'paused', 'stage_complete', 'archived', 'deleted'];
export class ObservatoryError extends Error {
  constructor(code, message, details = {}, retryable = false) {
    super(message); this.name = 'ObservatoryError'; this.code = code;
    this.details = details; this.retryable = retryable;
  }
  toJSON() { return { code: this.code, message: this.message, retryable: this.retryable, details: this.details }; }
}
export function fail(code, message, details = {}, retryable = false) {
  throw new ObservatoryError(code, message, details, retryable);
}
export function object(value, label, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', `${label} 必须是对象。`);
  if (allowed) for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('INVALID_INPUT', `${label} 含未支持字段：${key}。`);
  return value;
}
export function string(value, label, { optional = false, nonempty = false, max = 2_000_000 } = {}) {
  if (value === undefined && optional) return '';
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) fail('INVALID_INPUT', `${label} 必须是${nonempty ? '非空' : ''}字符串，且不超过 ${max} 字符。`);
  return value;
}
export function array(value, label, { optional = false, max = 1000 } = {}) {
  if (value === undefined && optional) return [];
  if (!Array.isArray(value) || value.length > max) fail('INVALID_INPUT', `${label} 必须是数组，且不超过 ${max} 项。`);
  return value;
}
export function id(value, label = 'ID') { return string(value, label, { nonempty: true, max: 160 }); }
export function revision(value, label = 'expectedRevision') {
  if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_INPUT', `${label} 必须是正整数。`);
  return value;
}
export function uri(value, label = 'URL', optional = false) {
  const raw = string(value, label, { optional, max: 8000 });
  if (!raw && optional) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
  } catch { fail('UNSAFE_URI', `${label} 只允许无账号信息的 http/https 网址。`); }
  return raw;
}
export function tags(value) { return [...new Set(array(value, 'tags', { optional: true }).map(v => string(v, 'tag', { nonempty: true, max: 200 })))]; }
export function newId(prefix) { return `${prefix}_${randomUUID()}`; }
export function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJSON(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function hash(value) { return createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : stableJSON(value)).digest('hex'); }
export function validateSegments(value) {
  return array(value, 'segments', { optional: true }).map((item, index) => {
    object(item, `segments[${index}]`, ['segmentId', 'kind', 'text', 'startSeconds', 'endSeconds', 'note', 'attachmentId']);
    if (!['text', 'time', 'image', 'general'].includes(item.kind)) fail('INVALID_INPUT', '关注片段 kind 必须为 text/time/image/general。');
    const segment = { segmentId: item.segmentId ? id(item.segmentId) : newId('seg'), kind: item.kind,
      text: string(item.text, 'segment.text', { optional: true }), note: string(item.note, 'segment.note', { optional: true }) };
    if (item.kind === 'time') {
      if (!Number.isFinite(item.startSeconds) || item.startSeconds < 0 || !Number.isFinite(item.endSeconds) || item.endSeconds <= item.startSeconds) fail('INVALID_INPUT', '时间片段需要递增的 startSeconds/endSeconds。');
      segment.startSeconds = item.startSeconds; segment.endSeconds = item.endSeconds;
    }
    if (item.attachmentId !== undefined) segment.attachmentId = id(item.attachmentId, 'attachmentId');
    return segment;
  });
}
export function validateMaterial(value) {
  object(value, 'material', ['title', 'original', 'originalImpression', 'tags', 'segments', 'attachmentIds']);
  object(value.original, 'original', ['kind', 'text', 'url', 'source', 'capturedAt']);
  if (!['text', 'link', 'recollection', 'mixed', 'attachment', 'image', 'video'].includes(value.original.kind)) fail('INVALID_INPUT', 'original.kind 必须为 text/link/recollection/mixed/attachment/image/video。');
  const original = { kind: value.original.kind, text: string(value.original.text, 'original.text', { optional: true }), url: uri(value.original.url, 'original.url', true) };
  const attachmentIds = array(value.attachmentIds, 'attachmentIds', { optional: true }).map(v => id(v, 'attachmentId'));
  if (!original.text.trim() && !original.url && attachmentIds.length === 0) fail('INVALID_INPUT', '收藏至少需要原文、回忆文字、链接或已登记附件；标题、标签和问题可以留空。');
  if (value.original.capturedAt !== undefined) original.capturedAt = string(value.original.capturedAt, 'capturedAt', { nonempty: true, max: 100 });
  if (value.original.source !== undefined) {
    object(value.original.source, 'original.source', ['title', 'uri', 'author', 'publishedAt', 'locator']);
    original.source = { title: string(value.original.source.title, 'source.title', { optional: true }), uri: uri(value.original.source.uri, 'source.uri', true),
      author: string(value.original.source.author, 'source.author', { optional: true }), publishedAt: string(value.original.source.publishedAt, 'source.publishedAt', { optional: true }),
      locator: string(value.original.source.locator, 'source.locator', { optional: true }) };
  }
  const impression = string(value.originalImpression, 'originalImpression', { optional: true });
  return { title: string(value.title, 'title', { optional: true, max: 1000 }), original,
    originalImpression: impression, currentImpression: impression, impressionHistory: [], notes: [], tags: tags(value.tags),
    segments: validateSegments(value.segments), attachmentIds, source: original.source ?? null, sourceHistory: [],
    capabilities: { saved: true, access: original.url ? 'not_checked' : 'local', preview: attachmentIds.length ? 'attachment_specific' : 'text', read: 'not_read', researched: false } };
}
export function validateTopic(value) {
  object(value, 'topic', ['title', 'question', 'scope', 'materialIds']);
  return { title: string(value.title, 'topic.title', { optional: true, max: 1000 }), question: string(value.question, 'topic.question', { optional: true }),
    scope: string(value.scope, 'topic.scope', { optional: true }), materialIds: [...new Set(array(value.materialIds, 'materialIds', { optional: true }).map(v => id(v, 'materialId')))] };
}
function strings(value, label) { return array(value, label, { optional: true }).map(v => string(v, label, { nonempty: true })); }
export function validateStage(value) {
  object(value, 'stage', ['focus', 'confirmed', 'candidates', 'parked', 'unknown', 'nextStep', 'paragraphs', 'sources', 'limitations', 'researchStatus']);
  const sources = array(value.sources, 'sources', { optional: true }).map(v => {
    object(v, 'source', ['sourceId', 'kind', 'title', 'uri', 'materialId', 'attachmentId', 'locator', 'accessedAt', 'verificationScope', 'licenseStatus']);
    if (!['external', 'material', 'attachment'].includes(v.kind)) fail('INVALID_INPUT', 'source.kind 必须为 external/material/attachment。');
    const source = { sourceId: id(v.sourceId, 'sourceId'), kind: v.kind, title: string(v.title, 'source.title', { optional: true }),
      locator: string(v.locator, 'source.locator', { optional: true }), accessedAt: string(v.accessedAt, 'source.accessedAt', { optional: true }),
      verificationScope: v.verificationScope === undefined ? 'unknown' : string(v.verificationScope, 'source.verificationScope', { nonempty: true, max: 1000 }),
      licenseStatus: v.licenseStatus === undefined ? 'unknown' : string(v.licenseStatus, 'source.licenseStatus', { nonempty: true, max: 1000 }) };
    if (v.kind === 'external') source.uri = uri(v.uri, 'source.uri');
    if (v.kind === 'material') source.materialId = id(v.materialId, 'source.materialId');
    if (v.kind === 'attachment') source.attachmentId = id(v.attachmentId, 'source.attachmentId');
    return source;
  });
  const sourceIds = new Set(sources.map(s => s.sourceId));
  if (sourceIds.size !== sources.length) fail('INVALID_INPUT', '同一阶段的 sourceId 不能重复。');
  const paragraphs = array(value.paragraphs, 'paragraphs', { optional: true }).map((v, i) => {
    object(v, 'paragraph', ['paragraphId', 'heading', 'markdown', 'sourceRefs', 'attachmentIds', 'basisKind']);
    const basisKind = v.basisKind ?? 'unknown';
    if (!['direct_observation', 'source_fact', 'author_interpretation', 'ai_hypothesis', 'user_impression', 'unknown', 'demo'].includes(basisKind)) fail('INVALID_INPUT', 'paragraph.basisKind 非法。');
    const refs = array(v.sourceRefs, 'sourceRefs', { optional: true }).map(ref => {
      object(ref, 'sourceRef', ['sourceId', 'locator', 'note']);
      const sourceId = id(ref.sourceId, 'sourceRef.sourceId');
      if (!sourceIds.has(sourceId)) fail('INVALID_SOURCE_REF', '段落引用的 sourceId 未在本阶段 sources 定义。', { sourceId });
      return { sourceId, locator: string(ref.locator, 'sourceRef.locator', { nonempty: true }), note: string(ref.note, 'sourceRef.note', { nonempty: true }) };
    });
    if (['direct_observation', 'source_fact', 'author_interpretation', 'user_impression'].includes(basisKind) && refs.length === 0)
      fail('INVALID_SOURCE_REF', '观察、来源事实、作者解释和用户感受段落需要具体 sourceRefs；不确定内容请明确标为未知或假设。');
    return { paragraphId: v.paragraphId ? id(v.paragraphId) : newId('para'), heading: string(v.heading, 'heading', { optional: true }),
      markdown: string(v.markdown, 'markdown', { nonempty: true }), basisKind, sourceRefs: refs,
      attachmentIds: array(v.attachmentIds, 'paragraph.attachmentIds', { optional: true }).map(a => id(a, 'attachmentId')) };
  });
  for (const source of sources) if (!paragraphs.some(p => p.sourceRefs.some(ref => ref.sourceId === source.sourceId)))
    fail('INVALID_SOURCE_REF', '每个来源须关联具体研究段落，不能只保留无法判断用途的链接清单。', { sourceId: source.sourceId });
  if (new Set(paragraphs.map(p => p.paragraphId)).size !== paragraphs.length) fail('INVALID_INPUT', 'paragraphId 不能重复。');
  const researchStatus = value.researchStatus ?? 'stage_complete';
  if (!TOPIC_STATUSES.includes(researchStatus) || researchStatus === 'deleted') fail('INVALID_INPUT', 'researchStatus 非法；删除专题须用 update-topic。');
  return { focus: string(value.focus, 'stage.focus', { nonempty: true }), confirmed: strings(value.confirmed, 'confirmed'), candidates: strings(value.candidates, 'candidates'),
    parked: strings(value.parked, 'parked'), unknown: strings(value.unknown, 'unknown'), nextStep: string(value.nextStep, 'nextStep', { nonempty: true }),
    limitations: strings(value.limitations, 'limitations'), paragraphs, sources, researchStatus };
}
