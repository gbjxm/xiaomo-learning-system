import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const pure = source.split('// BEGIN OBSERVATORY_READING_HELPERS')[1].split('// END OBSERVATORY_READING_HELPERS')[0];
const { readingIntro, readingSentence, readingInlineImages, readingProfile } = new Function(pure + '\nreturn { readingIntro, readingSentence, readingInlineImages, readingProfile };')();
const renderers = source.slice(source.indexOf('  function readingParagraph('), source.indexOf('  function revealReadingTarget('));
const esc = new Function(source.split('  const esc = ')[1].split('\n')[0].replace(/;\s*$/, '').replace(/^/, 'return '))();
const topUrl = id => '#topic/' + encodeURIComponent(id), matUrl = id => '#material/' + encodeURIComponent(id);
const currentMaterial = { materialId: 'mat_test', revision: 1 };
const dependencies = ['readingIntro', 'readingInlineImages', 'readingProfile', 'esc', 'basisKinds', 'topUrl', 'matUrl', 'attachmentCard', 'externalLink', 'API', 'mat', 'date', 'button', 'list'];
const factory = new Function(...dependencies, renderers + '\nreturn { readingParagraph, readingSources, renderReadingStage };');
const views = factory(readingIntro, readingInlineImages, readingProfile, esc, { source_fact: '来源事实', ai_hypothesis: 'AI 分析 / 假设' }, topUrl, matUrl,
  (id, _removable, compact = false) => `<figure data-test-attachment="${esc(id)}" data-compact="${compact}"></figure>`, (uri, label = uri) => `<a href="${esc(uri)}">${esc(label)}</a>`, '/api/observatory', () => currentMaterial,
  value => value, (_action, _id, label) => `<button>${esc(label)}</button>`, items => `<ul>${(items || []).map(item => `<li>${esc(item)}</li>`).join('')}</ul>`);
const intro = { paragraphId: 'intro', heading: '这份素材讲什么', markdown: '一个孩子变成鸟，衔来木石填海。\n\n原文未交代最终填平海洋。', basisKind: 'source_fact', sourceRefs: [{ sourceId: 'src', locator: '第3卷', note: '支持故事内容' }], attachmentIds: [] };
const body = { paragraphId: 'original', heading: '原文与白话', markdown: '原文。\n\n白话：解释。', basisKind: 'source_fact', sourceRefs: [{ sourceId: 'src', locator: '第3卷', note: '支持原文' }], attachmentIds: ['att_image'] };
const stage = { stageId: 'stage_test', topicRevision: 2, createdAt: 'now', focus: 'AI测试关注', confirmed: ['已确认'], candidates: ['创作候选'], unknown: ['声音未听'], limitations: ['未连续合看'], nextStep: '继续核对', paragraphs: [intro, body], sources: [{ sourceId: 'src', kind: 'external', title: '原始来源', uri: 'https://example.test/a', locator: '卷3', verificationScope: '只读电子转录，未核古籍原页', licenseStatus: 'unknown' }], materialVersions: [{ materialId: 'mat_test', revision: 1 }] };
const topic = { topicId: 'topic_test', title: '案例', question: '研究问题', scope: '当前范围', stages: [stage] };

test('only a saved first introduction opts into the new layout; older and empty stages remain legacy', () => {
  assert.equal(readingIntro(stage), intro);
  for (const old of [null, {}, { paragraphs: [] }, { paragraphs: [body, intro] }, { paragraphs: [{ ...intro, heading: '摘要' }] }, { paragraphs: [{ ...intro, markdown: ' ' }] }]) assert.equal(readingIntro(old), null);
});
test('card description uses the actual first sentence, keeping original material and feelings untouched', () => {
  const frozen = structuredClone(stage);
  assert.equal(readingSentence(intro), '一个孩子变成鸟，衔来木石填海。');
  assert.equal(readingSentence({ markdown: '**[预告](https://example.test)**展示雪地和街巷。\n\n待核声音' }), '预告展示雪地和街巷。');
  assert.deepEqual(stage, frozen);
});
test('introduction and open full body precede unknowns and management; evidence sources are last', () => {
  const html = views.renderReadingStage(stage, topic, 0);
  assert.ok(html.indexOf('id="paragraph-intro"') < html.indexOf('id="reportSection"'));
  assert.ok(html.indexOf('id="paragraph-original"') < html.indexOf('id="unknownSection"'));
  assert.ok(html.indexOf('id="unknownSection"') < html.indexOf('id="stageSection"'));
  assert.ok(html.indexOf('id="stageSection"') < html.indexOf('id="sourceSection"'));
  assert.match(html, /<section class="report-section"/);
  assert.match(html, /<details class="source-section reading-sources"[^>]*><summary>来源与引用位置 · 1 条/);
  assert.doesNotMatch(html, /<details[^>]+(?:sourceSection|paragraph-original)[^>]*\sopen(?:\s|>)/);
  assert.equal((html.match(/id="paragraph-intro"/g) || []).length, 1);
  assert.equal((html.match(/id="paragraph-original"/g) || []).length, 1);
});
test('source relationships, verification scope, licence, and all source deep links survive disclosure', () => {
  const html = views.readingSources(stage, topic);
  assert.match(html, /source-src/); assert.match(html, /只读电子转录，未核古籍原页/); assert.match(html, /unknown/);
  assert.match(html, /#topic\/topic_test\/paragraph\/intro/); assert.match(html, /#topic\/topic_test\/paragraph\/original/);
  assert.match(views.readingParagraph(body, topic), /#topic\/topic_test\/source\/src/);
});
test('untrusted headings and citation labels remain text, and attachment IDs use existing controlled preview', () => {
  const html = views.readingParagraph({ ...body, heading: '<script>bad</script>', sourceRefs: [{ sourceId: 'a/b', locator: '<img onerror=x>', note: '" unsafe' }] }, topic);
  assert.doesNotMatch(html, /<script>|<img onerror=/);
  assert.match(html, /&lt;script&gt;/); assert.match(html, /source\/a%2Fb/); assert.match(html, /data-test-attachment="att_image"/);
});
test('updated material versions keep a visible warning outside collapsed management', () => {
  const changed = { ...stage, materialVersions: [{ materialId: 'mat_test', revision: 0 }] };
  const html = views.renderReadingStage(changed, topic, 0);
  assert.ok(html.indexOf('这份研究所据素材已有更新') < html.indexOf('id="stageSection"'));
});
test('only actual inline local images use compact file links; code examples and other attachments keep previews', () => {
  const paragraph = { ...body, markdown: '![真实图片](attachment:att_image)\n\n```\n![代码示例](attachment:att_example)\n```\n\n[文字链接](attachment:att_link)', attachmentIds: ['att_image', 'att_example', 'att_link'] };
  assert.deepEqual([...readingInlineImages(paragraph.markdown)], ['att_image']);
  const html = views.readingParagraph(paragraph, topic);
  assert.match(html, /data-test-attachment="att_image" data-compact="true"/);
  assert.match(html, /data-test-attachment="att_example" data-compact="false"/);
  assert.match(html, /data-test-attachment="att_link" data-compact="false"/);
});
test('source and section deep-link targets open all enclosing disclosures before scrolling', () => {
  const fn = source.slice(source.indexOf('  function revealReadingTarget('), source.indexOf('  function renderTopic(', source.indexOf('  function revealReadingTarget(')));
  const reveal = new Function(fn + '\nreturn revealReadingTarget;')();
  const outer = { tagName: 'DETAILS', open: false, parentElement: null }, inner = { tagName: 'DETAILS', open: false, parentElement: outer };
  let highlighted = false, scrolled = false;
  const target = { tagName: 'ARTICLE', parentElement: inner, classList: { add: () => { highlighted = true; } }, scrollIntoView: () => { assert.ok(inner.open && outer.open); scrolled = true; } };
  reveal(target); assert.ok(highlighted && scrolled);
});
test('quoted original is a safe blockquote immediately followed by plain explanation; code and remote images retain their limits', () => {
  const fn = source.slice(source.indexOf('  function appendMarkdown('), source.indexOf('  async function updateMaterial('));
  const node = tag => ({ tagName: tag.toUpperCase(), children: [], value: '', append(child) { this.children.push(child); }, set textContent(value) { this.value = value; }, get textContent() { return this.value + this.children.map(child => child.textContent).join(''); } });
  const document = { createElement: node, createTextNode: value => ({ tagName: '#TEXT', textContent: value }) };
  const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
  const appendMarkdown = new Function('document', 'safeUrl', 'API', fn + '\nreturn appendMarkdown;')(document, safeUrl, '/api/observatory');
  const container = node('div');
  appendMarkdown(container, '> 其狀如烏。<script>untrusted</script>\n\n白话：样子像乌鸦。\n\n```\n> code remains literal\n```\n\n> ![远程图片](https://example.test/image.png)');
  assert.equal(container.children[0].tagName, 'BLOCKQUOTE');
  assert.equal(container.children[0].textContent, '其狀如烏。<script>untrusted</script>');
  assert.equal(container.children[1].tagName, 'P'); assert.equal(container.children[1].textContent, '白话：样子像乌鸦。');
  assert.equal(container.children[2].tagName, 'PRE'); assert.equal(container.children[2].textContent, '> code remains literal');
  const all = container.children.flatMap(function visit(child) { return [child, ...(child.children || []).flatMap(visit)]; });
  assert.ok(!all.some(child => ['SCRIPT', 'IMG'].includes(child.tagName)));
});
