import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ObservatoryStore, PROJECT_ROOT, rebindRestoredStore } from './store.mjs';
import { fail, newId, hash, string, id } from './model.mjs';
import { attachmentRoot, safeRegisteredFile, hashFile, localCommand, sendFileResponse, validateFilename } from './attachments.mjs';
import { analyzeAttachmentLinks, rewriteAttachmentLinks } from './inline-attachments.mjs';

const HELPER = fileURLToPath(new URL('./package_helper.py', import.meta.url));
const FORMAT = 'xiaomo-observatory-package';
const RESTORE_ROOT = path.join(PROJECT_ROOT, '验证', '素材观察室', '阶段5');
function inside(child, parent) { const r = path.relative(parent, child); return !!r && r !== '..' && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r); }
function safePackageId(value) { id(value, 'packageId'); if (!/^(?:backup|export)_[0-9a-f-]{36}$/.test(value)) fail('INVALID_PACKAGE_ID', '包 ID 格式不合法；不能用路径代替 ID。'); return value; }
async function helper(request) {
  let result;
  try { result = await localCommand('python', ['-X', 'utf8', HELPER], { input: JSON.stringify(request), timeoutMs: 300_000, outputLimit: 12 * 1024 ** 2 }); }
  catch (error) { fail('PACKAGE_TOOL_UNAVAILABLE', '本机 Python 标准库打包工具不可用；没有安装新依赖。', { cause: error.message }); }
  if (result.limited) fail('PACKAGE_OPERATION_LIMIT', '打包或校验超过资源限制；未报告成功，原始数据保留。');
  let parsed; try { parsed = JSON.parse(result.stdout); } catch { fail('PACKAGE_OPERATION_FAILED', '打包工具没有返回可验证结果。', { detail: result.stderr.slice(0, 500) }); }
  if (result.code !== 0 || !parsed.ok) fail(parsed.error?.code ?? 'PACKAGE_OPERATION_FAILED', parsed.error?.message ?? '打包工具失败。');
  return parsed.data;
}
async function packageDirectory(identity, kind) {
  const moduleRoot = path.dirname(path.dirname(identity.canonicalDbPath)); const directory = path.join(moduleRoot, kind === 'backup' ? 'backups' : 'exports');
  await fsp.mkdir(directory, { recursive: true });
  if ((await fsp.lstat(directory)).isSymbolicLink() || !inside(await fsp.realpath(directory), await fsp.realpath(moduleRoot))) fail('UNSAFE_FILE_PATH', '备份或导出目录逃出素材数据目录。');
  return directory;
}
function collectReferences(materials, topics) {
  const refs = new Set();
  for (const material of materials) {
    for (const attachmentId of material.attachmentIds ?? []) refs.add(attachmentId);
    for (const segment of material.segments ?? []) if (segment.attachmentId) refs.add(segment.attachmentId);
  }
  for (const topic of topics) for (const stage of topic.stages ?? []) {
    for (const source of stage.sources ?? []) if (source.attachmentId) refs.add(source.attachmentId);
    for (const paragraph of stage.paragraphs ?? []) for (const attachmentId of paragraph.attachmentIds ?? []) refs.add(attachmentId);
  }
  return refs;
}
function assertMaterialReferences(materials, topics) {
  const ids = new Set(materials.map(m => m.materialId));
  for (const topic of topics) {
    const referenced = [...topic.materialIds, ...topic.stages.flatMap(stage => [
      ...stage.materialVersions.map(m => m.materialId), ...stage.sources.filter(s => s.materialId).map(s => s.materialId)
    ])];
    for (const materialId of referenced) if (!ids.has(materialId)) fail('BACKUP_REFERENCE_MISSING', '当前或历史研究关联的素材记录缺失，停止备份/恢复验收。', { topicId: topic.topicId, materialId });
  }
}
async function captureSnapshot(store, kind) {
  const identity = await store.identity(); const directory = await packageDirectory(identity, kind);
  const packageId = newId(kind); const workRoot = path.join(directory, `.work-${packageId}`); await fsp.mkdir(workRoot, { recursive: false });
  const snapshotDir = path.join(workRoot, 'data'); await fsp.mkdir(snapshotDir);
  try {
    const snapshotPath = path.join(snapshotDir, 'observatory.sqlite3'); await store.backupSnapshot(snapshotPath);
    const snapshot = new ObservatoryStore({ dataDir: snapshotDir });
    const actual = await snapshot.identity();
    if (actual.storeId !== identity.storeId || actual.schemaVersion !== identity.schemaVersion) fail('BACKUP_IDENTITY_MISMATCH', '一致性快照的数据身份不符。');
    const materials = (await snapshot.listMaterials({ status: 'all' })).records; const topics = (await snapshot.listTopics()).records;
    assertMaterialReferences(materials, topics);
    const attachments = (await snapshot.listAttachments()).records;
    const ids = new Set(attachments.map(a => a.attachmentId));
    for (const attachmentId of collectReferences(materials, topics)) if (!ids.has(attachmentId)) fail('BACKUP_REFERENCE_MISSING', '快照记录引用了没有登记的附件，不能生成完整备份。', { attachmentId });
    return { identity, directory, packageId, workRoot, snapshotDir, snapshotPath, materials, topics, attachments };
  } catch (error) { await fsp.rm(workRoot, { recursive: true, force: true }); throw error; }
}
async function writeGenerated(root, relative, content) {
  const absolute = path.join(root, ...relative.split('/')); await fsp.mkdir(path.dirname(absolute), { recursive: true }); await fsp.writeFile(absolute, content, { flag: 'wx' });
  return { path: relative, sourcePath: absolute };
}
async function finishPackage(capture, kind, files, additional) {
  const filename = `${capture.packageId}.zip`; const packagePath = path.join(capture.directory, filename);
  const manifest = { format: FORMAT, formatVersion: 1, kind, packageId: capture.packageId, createdAt: new Date().toISOString(),
    identity: capture.identity, schemaVersion: capture.identity.schemaVersion, nodeVersion: process.version, ...additional };
  let result;
  try { result = await helper({ action: 'build', outputPath: packagePath, files, manifest }); }
  catch (error) { await fsp.rm(`${packagePath}.part`, { force: true }); throw error; }
  const metadata = { packageId: capture.packageId, kind, filename, path: packagePath, byteLength: result.byteLength, sha256: result.sha256,
    identity: capture.identity, createdAt: manifest.createdAt, manifest: result.manifest };
  await fsp.writeFile(path.join(capture.directory, `${capture.packageId}.json`), JSON.stringify(metadata, null, 2), { flag: 'wx' });
  return metadata;
}
export async function createBackup(store) {
  const capture = await captureSnapshot(store, 'backup');
  try {
    const files = [{ path: 'data/observatory.sqlite3', sourcePath: capture.snapshotPath }, { path: 'schema.sql', sourcePath: fileURLToPath(new URL('./schema.sql', import.meta.url)) }];
    const attachmentPaths = [];
    for (const record of capture.attachments) {
      const actual = await safeRegisteredFile(store, record.attachmentId);
      if (hash(actual.record) !== hash(record)) fail('BACKUP_ATTACHMENT_CHANGED', '附件登记在快照后发生变化，停止打包，请重新备份。', { attachmentId: record.attachmentId });
      files.push({ path: `attachments/${record.relativePath}`, sourcePath: actual.filename, sha256: record.sha256 });
      attachmentPaths.push({ attachmentId: record.attachmentId, path: `attachments/${record.relativePath}`, sha256: record.sha256, byteLength: record.byteLength });
    }
    // Preserve complete originals left by an uncertain registration; omit only active .incoming uploads.
    const root = attachmentRoot(capture.identity); const registered = new Set(capture.attachments.map(a => a.relativePath)); const pendingOriginals = [];
    if (fs.existsSync(root)) {
      if ((await fsp.lstat(root)).isSymbolicLink() || !inside(await fsp.realpath(root), await fsp.realpath(path.dirname(root)))) fail('UNSAFE_FILE_PATH', '原始附件目录逃出素材数据目录。');
    }
    if (fs.existsSync(root)) for (const entry of await fsp.readdir(root, { withFileTypes: true })) {
      if (!entry.isFile() || registered.has(entry.name)) continue;
      const match = /^(att_[0-9a-f]{40})-([0-9a-f]{64})(\.[a-z0-9]+)$/.exec(entry.name); if (!match) continue;
      const filename = path.join(root, entry.name); if (await hashFile(filename) !== match[2]) fail('BACKUP_ATTACHMENT_CHANGED', '待登记原件的哈希不符，备份停止。', { filename: entry.name });
      files.push({ path: `attachments/${entry.name}`, sourcePath: filename, sha256: match[2] }); pendingOriginals.push(entry.name);
    }
    files.push(await writeGenerated(capture.workRoot, 'configuration.json', JSON.stringify({ projectRoot: PROJECT_ROOT, dataLayout: { database: 'data/observatory.sqlite3', attachments: 'attachments/' },
      identity: capture.identity, minimumNode: '24.15.0', packageVersion: 1, restorePolicy: 'only_new_isolated_directory', privateCredentialsIncluded: false }, null, 2)));
    files.push(await writeGenerated(capture.workRoot, 'README.md', '# 素材观察室完整数据备份\n\n包含 SQLite 在线一致性快照、全部已登记原始附件（含无引用及软删除素材的附件）、待登记完整原件、结构版本和哈希清单。\n\n不含模型账号、代理、私人凭据、其他系统、现存备份、活动上传临时文件或应用源码。应用源码使用项目当前版本；本包 schema.sql 用于结构核对。\n\n恢复必须通过受控 CLI restore 到全新阶段5隔离目录；不得手动覆盖正式库。恢复保留原始 ID，重绑路径并标记 isolated。\n\n许可未知的资料不因备份获得发布许可。\n'));
    return await finishPackage(capture, 'backup', files, { completeDataBackup: true, consistency: 'sqlite_online_backup_and_all_attachment_reference_hashes',
      recordCounts: { materials: capture.materials.length, topics: capture.topics.length, stages: capture.topics.reduce((n, t) => n + t.stages.length, 0), attachments: capture.attachments.length }, attachmentPaths, pendingOriginals });
  } finally { await fsp.rm(capture.workRoot, { recursive: true, force: true }); }
}
function mdValue(value) { return value === undefined || value === null || value === '' ? '（未填写）' : String(value); }
function bullet(values) { return values?.length ? values.map(v => `- ${v}`).join('\n') : '（暂无）'; }
function fencedJson(value) {
  const raw = JSON.stringify(value, null, 2);
  const fence = '`'.repeat(Math.max(3, ...[...(raw.match(/`+/g) ?? [])].map(run => run.length + 1)));
  return `${fence}json\n${raw}\n${fence}`;
}
function attachmentMarkdown(record, assetPath) {
  const common = `原名：${record.originalFilename}；ID：${record.attachmentId}；SHA-256：${record.sha256}；许可：${record.permissionStatus || 'unknown'}（许可不明需核查）`;
  return record.mimeType.startsWith('image/') ? `![附件：${record.attachmentId}](${assetPath})\n\n${common}` : `[下载原始附件：${record.attachmentId}](${assetPath})\n\n${common}`;
}
function materialMarkdown(material, assets, attachments, relativePrefix = '') {
  const lines = [`# ${material.title || '未命名素材'}`, '', `素材 ID：${material.materialId}；版本：${material.revision}；收藏状态：${material.status}`, '',
    `创建：${material.createdAt}；更新：${material.updatedAt}`, '', '## 原始素材', '', `输入类型：${material.original.kind}`, '', mdValue(material.original.text), '',
    material.original.url ? `[原始链接](${material.original.url})（保存链接不表示已读取）` : '（无原始链接）', '', '## 最初为什么吸引我（原话）', '', mdValue(material.originalImpression), '',
    '## 当前感受（用户原话）', '', mdValue(material.currentImpression), '', '## 原话修正历史', '',
    ...(material.impressionHistory?.length ? material.impressionHistory.flatMap(h => [`时间：${h.changedAt}；作者：${h.actor}；素材版本：${h.materialRevision}`, '', '修改前：', '', mdValue(h.before), '', '修改后：', '', mdValue(h.after), '']) : ['（没有修正）', '']),
    '## 后续备注', '', ...(material.notes?.length ? material.notes.flatMap(n => [`备注 ${n.noteId}；${n.createdAt}；作者 ${n.actor}`, '', n.text, '']) : ['（暂无）', '']),
    '## 我关注的片段', '', ...(material.segments?.length ? material.segments.flatMap(s => [`### ${s.segmentId} · ${s.kind}`, '',
      ...(s.kind === 'time' ? [`时间：${s.startSeconds}—${s.endSeconds} 秒`, ''] : []), mdValue(s.text), '', `我的局部备注：${mdValue(s.note)}`, '', ...(s.attachmentId && assets.has(s.attachmentId) ? [`[对应原始附件](${relativePrefix}${assets.get(s.attachmentId)})`, ''] : [])]) : ['（暂无）', '']),
    '## 来源与标签', '', `标签：${material.tags.join('、') || '未分类'}`, '', '来源当前信息：', '', fencedJson(material.source ?? material.original.source ?? {}), '',
    '来源修正历史：', '', fencedJson(material.sourceHistory ?? []), '', '## 原始附件', ''];
  for (const attachmentId of material.attachmentIds ?? []) if (assets.has(attachmentId)) lines.push(attachmentMarkdown(attachments.get(attachmentId), relativePrefix + assets.get(attachmentId)), '');
  lines.push('## 能力范围', '', fencedJson(material.capabilities ?? {}), '', '研究结论与 AI 假设保存在专题阶段中，不覆盖上述素材与用户原话。', '');
  return lines.join('\n');
}
function topicMarkdown(topic, assets, attachments, relativePrefix = '') {
  const lines = [`# ${topic.title || '未命名专题'}`, '', `专题 ID：${topic.topicId}；版本：${topic.revision}；研究状态：${topic.status}`, '',
    '## 当前问题与范围', '', mdValue(topic.question), '', `范围：${mdValue(topic.scope)}`, '', '## 关联素材', '',
    ...topic.materialIds.map(materialId => `- [${materialId}](${relativePrefix}materials/${materialId}.md)`), '', '## 完整阶段与成果', ''];
  if (!topic.stages.length) lines.push('（尚无研究阶段；收藏、浏览或导出均不自动启动研究）', '');
  for (const stage of topic.stages) {
    lines.push(`## 阶段 ${stage.stageId}`, '', `专题版本：${stage.topicRevision}；保存：${stage.createdAt}；作者：${stage.author}；状态：${stage.researchStatus}`, '',
      '### 当前关注点', '', stage.focus, '', '### 已确认的理解', '', bullet(stage.confirmed), '', '### 候选方向（尚未采用）', '', bullet(stage.candidates), '',
      '### 暂放下', '', bullet(stage.parked), '', '### 未知与待核查', '', bullet(stage.unknown), '', '### 下一步', '', stage.nextStep, '', '### 读取范围与限制', '', bullet(stage.limitations), '',
      '### 所据素材版本', '', ...stage.materialVersions.map(m => `- ${m.materialId} · v${m.revision}`), '', '### 完整正文', '');
    for (const paragraph of stage.paragraphs) {
      lines.push(`### ${paragraph.heading || paragraph.paragraphId}`, '', `段落 ID：${paragraph.paragraphId}；判断类型：${paragraph.basisKind}`, '', paragraph.markdown, '', '对应来源及具体支持位置：', '',
        ...(paragraph.sourceRefs.length ? paragraph.sourceRefs.map(ref => `- ${ref.sourceId}；定位：${ref.locator}；支持：${ref.note}`) : ['（没有外部来源；依判断类型保留未知或假设）']), '');
      for (const attachmentId of paragraph.attachmentIds) if (assets.has(attachmentId)) lines.push(attachmentMarkdown(attachments.get(attachmentId), relativePrefix + assets.get(attachmentId)), '');
    }
    lines.push('### 本阶段实际来源', '');
    for (const source of stage.sources) {
      lines.push(`- **${source.sourceId} · ${source.title || source.kind}**`, `  - 位置：${mdValue(source.locator)}；读取范围：${source.verificationScope}`, `  - 查阅：${mdValue(source.accessedAt)}；许可：${source.licenseStatus}（未知需核查）`);
      if (source.uri) lines.push(`  - [外部资料](${source.uri})`);
      if (source.materialId) lines.push(`  - [素材记录 ${source.materialId}](${relativePrefix}materials/${source.materialId}.md)`);
      if (source.attachmentId && assets.has(source.attachmentId)) lines.push(`  - [原始附件 ${source.attachmentId}](${relativePrefix}${assets.get(source.attachmentId)})`);
      lines.push('');
    }
  }
  lines.push('来源与段落映射另见 sources.json；原始结构与版本另见 record.json。未确认候选不得作为用户已经采用的创作方向。', '');
  return lines.join('\n');
}
export async function exportRecord(store, kind, recordId) {
  if (!['material', 'topic'].includes(kind)) fail('INVALID_INPUT', '导出 kind 必须是 material 或 topic。'); id(recordId, 'recordId');
  const capture = await captureSnapshot(store, 'export');
  try {
    const record = (kind === 'material' ? capture.materials : capture.topics).find(r => (r.materialId ?? r.topicId) === recordId);
    if (!record) fail('NOT_FOUND', '未找到待导出的记录。', { recordId });
    const topics = kind === 'topic' ? [record] : capture.topics.filter(t => t.materialIds.includes(recordId));
    const materialIds = new Set([...(kind === 'material' ? [recordId] : []), ...topics.flatMap(t => t.materialIds),
      ...topics.flatMap(t => t.stages.flatMap(s => [...s.materialVersions.map(m => m.materialId), ...s.sources.filter(source => source.materialId).map(source => source.materialId)]))]);
    const materials = capture.materials.filter(m => materialIds.has(m.materialId));
    if (materials.length !== materialIds.size) fail('EXPORT_REFERENCE_MISSING', '关联素材缺失，停止导出。');
    const registered = new Map(capture.attachments.map(attachment => [attachment.attachmentId, attachment]));
    const availablePaths = new Map(capture.attachments.map(attachment => [attachment.attachmentId,
      `assets/${attachment.sha256}${validateFilename(attachment.originalFilename).extension}`]));
    // Analyze whole rendered documents, including every historical stage, so
    // reference definitions may be shared between paragraphs. JSON originals
    // and the backup/restore reference contract are deliberately unchanged.
    const documents = materials.map(material => ({ path: `materials/${material.materialId}.md`, prefix: '../',
      markdown: materialMarkdown(material, availablePaths, registered, '../') }));
    documents.push(...topics.map(topic => ({ path: `topics/${topic.topicId}.md`, prefix: '../',
      markdown: topicMarkdown(topic, availablePaths, registered, '../') })));
    let primary = kind === 'material' ? materialMarkdown(record, availablePaths, registered) : topicMarkdown(record, availablePaths, registered);
    if (kind === 'material' && topics.length) primary += '\n## 相关完整研究\n\n' + topics.map(t => `- [${t.title || t.topicId} · v${t.revision}](topics/${t.topicId}.md)`).join('\n') + '\n';
    documents.push({ path: '成果.md', prefix: '', markdown: primary });
    const relevant = collectReferences(materials, topics);
    for (const document of documents) {
      document.analysis = analyzeAttachmentLinks(document.markdown);
      for (const attachmentId of document.analysis.ids) relevant.add(attachmentId);
    }
    const assets = new Map(); const attachmentRecords = new Map(); const files = []; const copied = new Set();
    for (const attachmentId of relevant) {
      if (!registered.has(attachmentId)) fail('EXPORT_REFERENCE_MISSING', '正文引用的附件没有在当前素材库登记，停止导出。', { attachmentId });
      const actual = await safeRegisteredFile(store, attachmentId); const record = registered.get(attachmentId);
      if (!record || hash(actual.record) !== hash(record)) fail('EXPORT_ATTACHMENT_CHANGED', '附件登记与快照不一致，停止导出。', { attachmentId });
      const asset = `assets/${record.sha256}${validateFilename(record.originalFilename).extension}`; assets.set(attachmentId, asset); attachmentRecords.set(attachmentId, record);
      if (!copied.has(asset)) { files.push({ path: asset, sourcePath: actual.filename, sha256: record.sha256 }); copied.add(asset); }
    }
    files.push(await writeGenerated(capture.workRoot, 'record.json', JSON.stringify(record, null, 2)));
    const sources = topics.flatMap(t => t.stages.flatMap(stage => stage.sources.map(source => ({ topicId: t.topicId, topicRevision: stage.topicRevision, stageId: stage.stageId, ...source,
      ...(source.attachmentId ? { attachmentPath: assets.get(source.attachmentId) } : {}),
      supportedParagraphs: stage.paragraphs.filter(p => p.sourceRefs.some(ref => ref.sourceId === source.sourceId)).map(p => ({ paragraphId: p.paragraphId, heading: p.heading, basisKind: p.basisKind, sourceRefs: p.sourceRefs.filter(ref => ref.sourceId === source.sourceId) })) }))));
    for (const material of materials) if (material.source?.uri || material.original.url) sources.push({ materialId: material.materialId, materialRevision: material.revision, kind: 'original_material', ...material.source,
      uri: material.source?.uri || material.original.url, verificationScope: 'saved_original_metadata_not_automatically_read', licenseStatus: 'unknown' });
    files.push(await writeGenerated(capture.workRoot, 'sources.json', JSON.stringify(sources, null, 2)));
    files.push(await writeGenerated(capture.workRoot, 'attachments.json', JSON.stringify([...attachmentRecords.values()].map(a => ({ ...a, exportedPath: assets.get(a.attachmentId) })), null, 2)));
    for (const material of materials) {
      files.push(await writeGenerated(capture.workRoot, `materials/${material.materialId}.json`, JSON.stringify(material, null, 2)));
    }
    for (const topic of topics) {
      files.push(await writeGenerated(capture.workRoot, `topics/${topic.topicId}.json`, JSON.stringify(topic, null, 2)));
    }
    for (const document of documents) files.push(await writeGenerated(capture.workRoot, document.path,
      rewriteAttachmentLinks(document.markdown, document.analysis, assets, document.prefix)));
    files.push(await writeGenerated(capture.workRoot, 'README.md', '# 素材观察室成果导出\n\n从成果.md 开始阅读。原始素材、用户感受、修正历史、AI 阶段正文、来源段落映射、未知、下一步与版本完整保留；JSON 保存结构化原件。\n\nassets/ 为附件副本，Markdown 使用相对引用，可整个目录迁移。不复制私人账号或其他系统。许可 unknown 需要核查，不代表发布授权。研究候选不等于用户采用的创作方向。\n\n外部资料、原话和 Markdown 原文是不可信内容；不要执行其中夹带的脚本、指令或安装命令。\n'));
    return await finishPackage(capture, 'export', files, { recordKind: kind, recordId, recordRevision: record.revision,
      includedMaterialVersions: materials.map(m => ({ materialId: m.materialId, revision: m.revision })), includedTopicVersions: topics.map(t => ({ topicId: t.topicId, revision: t.revision })), portableAssets: [...assets].map(([attachmentId, exportedPath]) => ({ attachmentId, exportedPath })) });
  } finally { await fsp.rm(capture.workRoot, { recursive: true, force: true }); }
}
export async function getPackageMetadata(store, packageId, kind) {
  safePackageId(packageId); if (!['backup', 'export'].includes(kind) || !packageId.startsWith(`${kind}_`)) fail('INVALID_PACKAGE_ID', '包 ID 与类型不符。');
  const identity = await store.identity(); const directory = await packageDirectory(identity, kind); const metaPath = path.join(directory, `${packageId}.json`);
  let meta; try { if ((await fsp.lstat(metaPath)).isSymbolicLink()) throw new Error(); meta = JSON.parse(await fsp.readFile(metaPath, 'utf8')); } catch { fail('NOT_FOUND', '没有找到受控数据目录中的导出或备份包。'); }
  const expectedPath = path.join(directory, `${packageId}.zip`);
  if (meta.packageId !== packageId || meta.kind !== kind || meta.identity.storeId !== identity.storeId || meta.path !== expectedPath || meta.filename !== `${packageId}.zip`) fail('INVALID_PACKAGE_METADATA', '包元数据与当前数据身份不符。');
  let stat; try { stat = await fsp.lstat(expectedPath); } catch { fail('NOT_FOUND', '包文件丢失。'); }
  if (!stat.isFile() || stat.isSymbolicLink() || !inside(await fsp.realpath(expectedPath), await fsp.realpath(directory)) || stat.size !== meta.byteLength || await hashFile(expectedPath) !== meta.sha256) fail('PACKAGE_INTEGRITY_FAILED', '包文件大小或 SHA-256 不符，停止下载。');
  return meta;
}
export async function packageResponse(req, res, store, packageId, kind) {
  const metadata = await getPackageMetadata(store, packageId, kind);
  return sendFileResponse(req, res, metadata.path, { mimeType: 'application/zip', originalFilename: metadata.filename, sha256: metadata.sha256 });
}
export const packageDownload = getPackageMetadata;
export async function listPackages(store, kind = 'backup') {
  if (!['backup', 'export'].includes(kind)) fail('INVALID_INPUT', '包列表类型必须为 backup 或 export。');
  const identity = await store.identity(); const directory = await packageDirectory(identity, kind); const records = [];
  for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !new RegExp(`^${kind}_[0-9a-f-]{36}\\.json$`).test(entry.name)) continue;
    let metadata; try { metadata = JSON.parse(await fsp.readFile(path.join(directory, entry.name), 'utf8')); } catch { continue; }
    if (metadata.identity?.storeId !== identity.storeId || metadata.kind !== kind || `${metadata.packageId}.json` !== entry.name) continue;
    records.push({ packageId: metadata.packageId, filename: metadata.filename, kind, byteLength: metadata.byteLength, sha256: metadata.sha256, createdAt: metadata.createdAt, integrity: 'verify_on_download' });
  }
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); return { identity, records };
}
export async function readExportMarkdown(store, packageId) {
  const metadata = await getPackageMetadata(store, packageId, 'export');
  // This optional single-file read uses the already verified package and does not extract anywhere.
  const script = "import json,sys,zipfile; p=json.load(sys.stdin); z=zipfile.ZipFile(p['path']); print(json.dumps({'markdown':z.read('成果.md').decode('utf-8')},ensure_ascii=False))";
  const result = await localCommand('python', ['-X', 'utf8', '-c', script], { input: JSON.stringify({ path: metadata.path }), outputLimit: 8 * 1024 ** 2 });
  if (result.code !== 0 || result.limited) fail('EXPORT_READ_FAILED', '单文件 Markdown 读取失败，可下载完整导出包。');
  return { ...metadata, markdown: JSON.parse(result.stdout).markdown };
}
export async function restoreBackup(packagePath, targetDataDir) {
  string(packagePath, 'packagePath', { nonempty: true, max: 10000 }); string(targetDataDir, 'targetDataDir', { nonempty: true, max: 10000 });
  if (!path.isAbsolute(packagePath) || !path.isAbsolute(targetDataDir) || path.basename(targetDataDir) !== 'data') fail('INVALID_RESTORE_PATH', '恢复包与目标需要绝对路径；目标必须是全新隔离目录中的 data。');
  const targetRoot = path.dirname(path.resolve(targetDataDir)); const isolationRoot = await fsp.realpath(RESTORE_ROOT);
  if (!inside(targetRoot, RESTORE_ROOT) || fs.existsSync(targetRoot)) fail('RESTORE_TARGET_NOT_EMPTY', '只允许恢复到阶段5内全新隔离目录；禁止覆盖现有或正式数据。');
  let parent = targetRoot; const suffix = [];
  while (!fs.existsSync(parent)) { suffix.unshift(path.basename(parent)); const next = path.dirname(parent); if (next === parent) fail('INVALID_RESTORE_PATH', '恢复目标没有可核对的父目录。'); parent = next; }
  if (!inside(path.join(await fsp.realpath(parent), ...suffix), isolationRoot)) fail('UNSAFE_FILE_PATH', '恢复目标经实际路径解析后逃出阶段5隔离根。');
  const checked = await helper({ action: 'inspect', packagePath: path.resolve(packagePath), requireBackup: true });
  const identity = checked.manifest.identity;
  if (!identity || identity.projectRoot !== PROJECT_ROOT || !identity.storeId || identity.schemaVersion !== checked.manifest.schemaVersion) fail('BACKUP_IDENTITY_MISMATCH', '备份不是当前项目的数据或结构身份不符。');
  const extracted = await helper({ action: 'extract', packagePath: path.resolve(packagePath), targetDir: targetRoot, allowedRoot: isolationRoot });
  try {
    const rebound = await rebindRestoredStore({ dataDir: path.resolve(targetDataDir), expectedStoreId: identity.storeId });
    const store = new ObservatoryStore({ dataDir: targetDataDir }); const actual = await store.identity();
    if (actual.scope !== 'isolated' || actual.storeId !== identity.storeId) fail('RESTORE_VERIFICATION_FAILED', '恢复目录身份未正确重绑。');
    const materials = (await store.listMaterials({ status: 'all' })).records; const topics = (await store.listTopics()).records; const attachments = (await store.listAttachments()).records;
    assertMaterialReferences(materials, topics);
    for (const attachmentId of collectReferences(materials, topics)) if (!attachments.some(a => a.attachmentId === attachmentId)) fail('RESTORE_REFERENCE_MISSING', '恢复后的记录有未登记附件引用。', { attachmentId });
    for (const attachment of attachments) await safeRegisteredFile(store, attachment.attachmentId);
    const counts = { materials: materials.length, topics: topics.length, stages: topics.reduce((n, t) => n + t.stages.length, 0), attachments: attachments.length };
    if (hash(counts) !== hash(checked.manifest.recordCounts)) fail('RESTORE_VERIFICATION_FAILED', '恢复后的记录数与完整包不符。');
    return { identity: actual, originalIdentity: identity, targetDataDir: path.resolve(targetDataDir), restoredPackageId: checked.manifest.packageId,
      verification: { files: extracted.verifiedFiles, packageHashesVerified: true, allAttachmentHashesVerified: true, referencesVerified: true, recordCounts: counts }, rebind: rebound };
  } catch (error) {
    // Keep a failed recovery isolated for diagnosis; it never becomes the production entry.
    error.details = { ...(error.details ?? {}), isolatedRecoveryDirectory: targetRoot, recoveryStatus: 'verification_failed_not_enabled' }; throw error;
  }
}
