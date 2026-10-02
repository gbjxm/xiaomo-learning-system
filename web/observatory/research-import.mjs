import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { attachmentRoot, getAttachmentInfo, hashFile, receiveUpload, validateFilename } from './attachments.mjs';
import { fail, hash, id, object, string } from './model.mjs';

function sameFile(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}

// This is a local-file adapter to the existing upload transaction, not a second
// attachment registry. It never associates a file with or edits a material.
export async function importResearchAttachment(store, payload) {
  object(payload, '附件导入', ['identity', 'submissionId', 'filePath', 'permissionStatus']);
  id(payload.submissionId, 'submissionId');
  const actual = await store.identity();
  if (hash(actual) !== hash(payload.identity)) fail('STORE_IDENTITY_MISMATCH', '本地附件导入身份不一致；未读取文件。');
  const filename = string(payload.filePath, 'filePath', { nonempty: true, max: 32000 });
  const windowsLocal = process.platform !== 'win32' || (/^[A-Za-z]:[\\/]/.test(filename) && !filename.slice(2).includes(':'));
  if (!path.isAbsolute(filename) || !windowsLocal || /[\x00-\x1f]/.test(filename))
    fail('INVALID_DATA_PATH', 'filePath 必须是普通本地文件的绝对路径，不接受网络、设备路径或额外数据流。');
  const spec = validateFilename(path.basename(filename));
  const permissionStatus = payload.permissionStatus === undefined ? 'unknown'
    : string(payload.permissionStatus, 'permissionStatus', { nonempty: true, max: 1000 });
  let original;
  try { original = await fsp.lstat(filename); }
  catch (error) { fail('NOT_FOUND', '本地附件文件不可读取。', { cause: error.code }); }
  if (!original.isFile() || original.isSymbolicLink()) fail('UNSAFE_FILE_PATH', '附件导入只读取普通文件，不读取目录或符号链接。');
  if (!original.size || original.size > spec.limit) fail('UPLOAD_TOO_LARGE', '文件为空或超过该类型限制。', { kind: spec.kind, limit: spec.limit });
  const canonical = await fsp.realpath(filename);
  // Parent junctions can otherwise conceal a network target on Windows.
  if (process.platform === 'win32' && (!/^[A-Za-z]:[\\/]/.test(canonical) || canonical.slice(2).includes(':')))
    fail('UNSAFE_FILE_PATH', '附件真实路径不是本地普通路径。');
  const handle = await fsp.open(canonical, 'r');
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || !sameFile(original, opened)) fail('UPLOAD_INTERRUPTED', '附件在打开前发生变化；未登记，请核对后重新提交。', {}, true);
    const req = Readable.from((async function* () {
      for await (const chunk of handle.createReadStream({ autoClose: false })) yield chunk;
      if (!sameFile(opened, await handle.stat()) || !sameFile(opened, await fsp.lstat(filename)))
        fail('UPLOAD_INTERRUPTED', '附件在读取过程中发生变化；未登记，请核对后重新提交。', {}, true);
    })());
    req.headers = { 'x-file-name': encodeURIComponent(spec.filename), 'content-type': spec.mimeType, 'content-length': String(opened.size) };
    const result = await receiveUpload(req, store, { identity: actual, submissionId: payload.submissionId, permissionStatus });
    const info = await getAttachmentInfo(store, result.attachment.attachmentId);
    const checked = result.receipt.snapshot;
    const savedPath = path.join(attachmentRoot(info.identity), ...info.record.relativePath.split('/'));
    if (hash(info.identity) !== hash(actual) || hash(info.record) !== hash(checked)
      || info.record.sha256 !== result.attachment.sha256 || info.record.byteLength !== opened.size
      || info.record.mimeType !== spec.mimeType || await hashFile(savedPath) !== checked.sha256)
      fail('WRITE_VERIFICATION_FAILED', '本地附件导入的原件、收据与登记回读不一致；保留文件及原 submissionId 核对。', { submissionId: payload.submissionId });
    return { ...result, absolutePath: savedPath,
      readingScope: '仅验证本地原件、格式、哈希和登记回读；不表示已读懂正文或审看声画。',
      permissionNotice: 'permissionStatus 仅保存来源或许可声明；不是发布资格或使用授权认证。' };
  } finally { await handle.close(); }
}
