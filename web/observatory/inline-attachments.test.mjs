import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { analyzeAttachmentLinks, rewriteAttachmentLinks } from './inline-attachments.mjs';
import { initStore, ObservatoryStore, PROJECT_ROOT, ISOLATION_ROOT } from './store.mjs';
import { exportRecord, createBackup } from './portable.mjs';
import { localCommand } from './attachments.mjs';

const A = 'att_inline_image', B = 'att_inline_text', DUPLICATE = 'att_inline_duplicate';
const assetA = `assets/${'a'.repeat(64)}.png`, assetB = `assets/${'b'.repeat(64)}.txt`;
const assets = new Map([[A, assetA], [B, assetB]]);
function rewrite(markdown, prefix = '') { return rewriteAttachmentLinks(markdown, analyzeAttachmentLinks(markdown), assets, prefix); }

test('inline destinations, image positions, titles and relative paths retain surrounding Markdown', () => {
  const markdown = `before ![图](attachment:${A}) and [原件](<attachment:${B}> "说明") after\n[别处](https://example.com/a_(b)?q=attachment:UNKNOWN)`;
  assert.deepEqual([...analyzeAttachmentLinks(markdown).ids], [A, B]);
  assert.equal(rewrite(markdown), markdown.replace(`attachment:${A}`, assetA).replace(`attachment:${B}`, assetB));
  assert.equal(rewrite(markdown, '../'), markdown.replace(`attachment:${A}`, '../' + assetA).replace(`attachment:${B}`, '../' + assetB));
  for (const title of ['"caption"', "'caption'", '(caption)'])
    assert.equal(rewrite(`[原件](attachment:${B} ${title})`), `[原件](${assetB} ${title})`);
});
test('autolink becomes an actual relative link and Markdown URI escapes are decoded', () => {
  assert.equal(rewrite(`<attachment:${A}>`), `[attachment:${A}](${assetA})`);
  assert.equal(rewrite(`[图](attachment\\:${A})`), `[图](${assetA})`);
  assert.equal(rewrite(`[图](attachment&#58;${A})`), `[图](${assetA})`);
  assert.equal(rewrite(`[图](attachment:att\\_inline\\_image)`), `[图](${assetA})`);
});
test('inline-only duplicate references deduplicate IDs', () => {
  const markdown = `![一](attachment:${A}) ![二](attachment:${A}) [三](attachment:${A})`;
  assert.deepEqual([...analyzeAttachmentLinks(markdown).ids], [A]);
  assert.equal(analyzeAttachmentLinks(markdown).spans.length, 3);
});
test('nested image in external label is collected; illegal enclosing link is not', () => {
  assert.equal(rewrite(`[![图](attachment:${A})](https://example.com)`), `[![图](${assetA})](https://example.com)`);
  assert.equal(rewrite(`[outside [inside](https://example.com)](attachment:UNKNOWN)`), `[outside [inside](https://example.com)](attachment:UNKNOWN)`);
  assert.equal(rewrite(`[outside <https://example.com>](attachment:UNKNOWN)`), `[outside <https://example.com>](attachment:UNKNOWN)`);
  assert.equal(rewrite(`[outer [inner]](attachment:${A})`), `[outer [inner]](${assetA})`);
  assert.equal(rewrite(`[escaped \\] label](attachment:${A})`), `[escaped \\] label](${assetA})`);
});
test('code fences, indentation, matched code spans, comments and escaped links are unchanged', () => {
  const markdown = [
    '```md', '![example](attachment:UNKNOWN)', '```', '',
    '~~~', '[example](attachment:UNKNOWN)', '~~~', '',
    '    [example](attachment:UNKNOWN)', '',
    '`[example](attachment:UNKNOWN)` and ``a `[example](attachment:UNKNOWN)` b``',
    '\\[example](attachment:UNKNOWN)', '<!-- [example](attachment:UNKNOWN) -->',
    '<pre>[example](attachment:UNKNOWN)</pre>', '<span data-example="[example](attachment:UNKNOWN)">literal</span>',
    `![real](attachment:${A})`,
  ].join('\n');
  assert.equal(rewrite(markdown), markdown.replace(`attachment:${A}`, assetA));
});
test('unmatched backticks remain text; paragraph/list continuation is not indented code', () => {
  assert.equal(rewrite(`a lone \` and [real](attachment:${A})`), `a lone \` and [real](${assetA})`);
  assert.equal(rewrite(`paragraph\n    [real](attachment:${A})`), `paragraph\n    [real](${assetA})`);
  assert.equal(rewrite(`- item\n\n    [real](attachment:${A})`), `- item\n\n    [real](${assetA})`);
});
test('link targets and titles are opaque; prose and unused definitions are untouched', () => {
  for (const markdown of [
    '[outer](https://example.com/?q=[inner](attachment:UNKNOWN))',
    '[outer](https://example.com "example [inner](attachment:UNKNOWN)")',
    'prose attachment:UNKNOWN and https://example.com/?attachment:UNKNOWN',
    '[unused]: attachment:UNKNOWN',
    '[foo][missing]\n\n[foo]: attachment:UNKNOWN',
  ]) assert.equal(rewrite(markdown), markdown);
});
test('used reference links resolve document-wide first definitions only', () => {
  const markdown = `![picture][REF] and [ref][] and [ref]\n\n[ref]: <attachment:${A}> "title"\n[ref]: attachment:UNKNOWN\n[unused]: attachment:UNKNOWN`;
  assert.equal(rewrite(markdown), markdown.replace(`attachment:${A}`, assetA));
  assert.equal(rewrite('[ref]\n\n[ref]: https://example.com\n[ref]: attachment:UNKNOWN'), '[ref]\n\n[ref]: https://example.com\n[ref]: attachment:UNKNOWN');
  assert.equal(rewrite('paragraph\n[ref]: attachment:UNKNOWN'), 'paragraph\n[ref]: attachment:UNKNOWN');
});
test('block boundaries, container definitions and continuation destinations keep real attachments', () => {
  for (const markdown of [
    `> \`\`\`\n> example\n\n![valid](attachment:${A})`,
    `\`example\n\n![valid](attachment:${A})\n\n\``,
    `[url](https://example.org "unmatched \` title")\n\n![valid](attachment:${A})\n\n\` tail`,
    `> [img]: attachment:${A}\n> \n> ![img]`,
    `- [img]: attachment:${A}\n\n  ![img]`,
    `![img]\n\n[img]:\n  attachment:${A}`,
  ]) {
    assert.deepEqual([...analyzeAttachmentLinks(markdown).ids], [A]);
    assert.ok(rewrite(markdown).includes(assetA));
  }
});
test('unknown or malicious actual attachment destinations fail explicitly', () => {
  assert.throws(() => rewrite('[file](attachment:UNKNOWN)'), error => error.code === 'EXPORT_REFERENCE_MISSING');
  for (const destination of ['attachment:', 'attachment:../outside', 'attachment:C:/private', 'attachment://remote', 'attachment:att%2fprivate', 'attachment:att?query', `attachment:${'x'.repeat(161)}`, 'attachment&#58;..&#47;outside'])
    assert.throws(() => analyzeAttachmentLinks(`[file](${destination})`), error => error.code === 'INVALID_ATTACHMENT_REFERENCE');
  assert.throws(() => rewriteAttachmentLinks(`[file](attachment:${A})`, analyzeAttachmentLinks(`[file](attachment:${A})`), new Map([[A, 'file:///private']])), error => error.code === 'UNSAFE_FILE_PATH');
  assert.throws(() => rewrite(`[file](attachment:${A})`, '../../'), error => error.code === 'UNSAFE_FILE_PATH');
});

test('synthetic SQLite export produces complete offline ZIP assets for current and historical inline-only references', async t => {
  const base = path.resolve(process.env.INLINE_ATTACHMENT_TEST_ROOT ?? path.join(ISOLATION_ROOT, 'inline-attachment-tests'));
  const relative = path.relative(ISOLATION_ROOT, base);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'all write fixtures stay under 验证/素材观察室');
  const runRoot = path.join(base, 'inline-export-' + randomUUID());
  const dataDir = path.join(runRoot, 'fixture', 'data');
  await initStore({ dataDir, scope: 'isolated' });
  const store = new ObservatoryStore({ dataDir }); const identity = await store.identity();
  const originals = path.join(runRoot, 'fixture', 'attachments'); await fs.mkdir(originals, { recursive: true });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT6sAAAAASUVORK5CYII=', 'base64');
  const text = Buffer.from('SELF_CREATED_INLINE_ATTACHMENT_TEST\n', 'utf8');
  const originalBytes = new Map([[A, png], [B, text], [DUPLICATE, png]]);
  for (const [attachmentId, content] of originalBytes) {
    const extension = attachmentId === B ? '.txt' : '.png';
    const digest = createHash('sha256').update(content).digest('hex'); const filename = attachmentId + '-' + digest + extension;
    try { await fs.writeFile(path.join(originals, filename), content, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    await store.registerAttachment({ identity, submissionId: 'register_' + attachmentId,
      attachment: { attachmentId, originalFilename: 'TEST' + extension, relativePath: filename, sha256: digest,
        mimeType: attachmentId === B ? 'text/plain' : 'image/png', byteLength: content.length, permissionStatus: 'self_created_test_only' } });
  }
  const material = (await store.createMaterial({ identity, submissionId: 'material_test', material: {
    title: 'SELF CREATED test, not user material', original: { kind: 'text', text: 'Test collection', url: '',
      source: { title: '[JSON example](attachment:UNKNOWN)' } }, tags: [], attachmentIds: [],
  } })).receipt.snapshot;
  let topic = (await store.createTopic({ identity, submissionId: 'topic_test', topic: { title: 'SELF CREATED inline-only export',
    question: 'Software fixture only', scope: 'No actual research', materialIds: [material.materialId] } })).receipt.snapshot;
  const stage = markdown => ({ focus: 'Synthetic export test', confirmed: [], candidates: [], parked: [], unknown: [],
    nextStep: 'No user learning result', limitations: ['self-created fixture'], researchStatus: 'paused', sources: [],
    paragraphs: [{ paragraphId: 'test_paragraph', heading: 'TEST', basisKind: 'demo', markdown, sourceRefs: [], attachmentIds: [] }] });
  const oldMarkdown = `OLD inline-only image ![old](attachment:${A})\nDuplicate ![shared](attachment:${DUPLICATE})\nExternal [official](https://example.com)\n\n\`[example](attachment:UNKNOWN)\``;
  topic = (await store.submitStage({ identity, submissionId: 'stage_old', topicId: topic.topicId, expectedRevision: topic.revision,
    materialVersions: [{ materialId: material.materialId, revision: material.revision }], stage: stage(oldMarkdown) })).receipt.snapshot;
  const newMarkdown = `CURRENT inline-only file [text](attachment:${B})\nCross-stage definition below: ![reference][cross]\n\n[cross]: attachment:${A}`;
  topic = (await store.submitStage({ identity, submissionId: 'stage_new', topicId: topic.topicId, expectedRevision: topic.revision,
    materialVersions: [{ materialId: material.materialId, revision: material.revision }], stage: stage(newMarkdown) })).receipt.snapshot;
  const before = await store.readTopic(topic.topicId); const beforeMaterial = await store.readMaterial(material.materialId);
  const exported = await exportRecord(store, 'topic', topic.topicId);
  const extracted = path.join(runRoot, 'offline-copy');
  const inspect = await localCommand('python', ['-B', '-X', 'utf8', '-c',
    "import json,sys,zipfile,pathlib; p=json.load(sys.stdin); z=zipfile.ZipFile(p['zip']); z.extractall(p['target']); print(json.dumps({'names':z.namelist()},ensure_ascii=False))"],
    { input: JSON.stringify({ zip: exported.path, target: extracted }) });
  assert.equal(inspect.code, 0, inspect.stderr); const names = JSON.parse(inspect.stdout).names;
  assert.equal(names.filter(name => name.startsWith('assets/')).length, 2, 'same image bytes deduplicate across registered IDs');
  const records = JSON.parse(await fs.readFile(path.join(extracted, 'attachments.json'), 'utf8'));
  assert.deepEqual(new Set(records.map(record => record.attachmentId)), new Set([A, B, DUPLICATE]));
  for (const record of records) assert.deepEqual(await fs.readFile(path.join(extracted, record.exportedPath)), originalBytes.get(record.attachmentId));
  for (const filename of ['成果.md', `topics/${topic.topicId}.md`]) {
    const markdown = await fs.readFile(path.join(extracted, filename), 'utf8');
    assert.ok(markdown.includes('OLD inline-only image')); assert.ok(markdown.includes('CURRENT inline-only file'));
    assert.ok(markdown.includes('`[example](attachment:UNKNOWN)`')); assert.ok(markdown.includes('[official](https://example.com)'));
    assert.equal(analyzeAttachmentLinks(markdown).ids.size, 0, 'all actual exported attachment links have relative paths');
    const localLinks = [...markdown.matchAll(/(?:\]\(|\]:\s*)(?:<)?((?:\.\.\/)?assets\/[a-f0-9]{64}\.(?:png|txt))/g)].map(match => match[1]);
    assert.ok(localLinks.length >= 4);
    for (const link of localLinks) {
      const target = path.resolve(extracted, path.dirname(filename), link);
      assert.ok(target.startsWith(extracted + path.sep)); assert.ok((await fs.stat(target)).isFile());
    }
  }
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(extracted, 'record.json'), 'utf8')), before.record);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(extracted, `topics/${topic.topicId}.json`), 'utf8')), before.record);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(extracted, `materials/${material.materialId}.json`), 'utf8')), beforeMaterial.record);
  assert.deepEqual(await store.readTopic(topic.topicId), before); assert.deepEqual(await store.readMaterial(material.materialId), beforeMaterial);
  const backup = await createBackup(store);
  assert.equal(backup.manifest.formatVersion, 1); assert.equal(backup.manifest.completeDataBackup, true);
  const errors = [];
  for (const [destination, code] of [['attachment:UNKNOWN', 'EXPORT_REFERENCE_MISSING'], ['attachment:../private', 'INVALID_ATTACHMENT_REFERENCE']]) {
    let invalid = (await store.createTopic({ identity, submissionId: 'invalid_' + randomUUID(), topic: {
      title: 'Synthetic invalid export only', question: '', scope: '', materialIds: [material.materialId] } })).receipt.snapshot;
    invalid = (await store.submitStage({ identity, submissionId: 'invalid_stage_' + randomUUID(), topicId: invalid.topicId,
      expectedRevision: invalid.revision, materialVersions: [{ materialId: material.materialId, revision: material.revision }], stage: stage(`[file](${destination})`) })).receipt.snapshot;
    await assert.rejects(exportRecord(store, 'topic', invalid.topicId), error => error.code === code); errors.push({ destination, rejectedWith: code });
  }
  const evidence = { fixtureScope: 'self_created_isolated_only', projectRoot: PROJECT_ROOT, runRoot, identity,
    exportedPath: exported.path, exportedSha256: exported.sha256, files: names.length, copiedAssets: 2, attachmentRecords: 3,
    historicalStages: 2, originalTopicAndMaterialUnchanged: true, offlineLocalLinksVerified: true, backupFormatUnchanged: true, rejected: errors };
  await fs.writeFile(path.join(runRoot, 'evidence.json'), JSON.stringify(evidence, null, 2), { flag: 'wx' });
  t.diagnostic('evidence: ' + path.join(runRoot, 'evidence.json'));
});
